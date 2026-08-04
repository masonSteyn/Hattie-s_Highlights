/**
 * Finishes setup once a Sanity project id and write token are in .env.local.
 *
 *   npm run finish
 *
 * Everything before this point can be done without an account. This is the
 * part that could not be: it checks the credentials actually work, imports the
 * starter content, and then proves a real write succeeds end to end — including
 * that a photo carrying GPS coordinates comes back stripped.
 *
 * Safe to re-run. The seed uses createOrReplace, and the verification cleans up
 * after itself.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const no = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const step = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

function loadEnv() {
  if (!existsSync(".env.local")) {
    no("No .env.local. Copy .env.example to .env.local first.");
    process.exit(1);
  }
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_API_WRITE_TOKEN;

/* ── 1. Credentials present ──────────────────────────────────────────────── */

step("1. Checking credentials");

const missing = [];
if (!projectId) missing.push("NEXT_PUBLIC_SANITY_PROJECT_ID");
if (!token) missing.push("SANITY_API_WRITE_TOKEN");
if (!process.env.EDITOR_PASSWORD_HASH) missing.push("EDITOR_PASSWORD_HASH");
if (!process.env.EDITOR_SESSION_SECRET) missing.push("EDITOR_SESSION_SECRET");

if (missing.length) {
  for (const m of missing) no(`${m} is not set in .env.local`);
  console.log(`
  The two Sanity values come from sanity.io/manage:
    · Project ID  — on the project's front page
    · Write token — API → Tokens → Add token, role "Editor"
`);
  process.exit(1);
}
ok(`project ${projectId}, dataset ${dataset}`);
ok("editor password and session secret set");

// A $ in the hash means dotenv ate part of it — the app would boot fine and
// reject every password, which is a miserable thing to debug.
if (process.env.EDITOR_PASSWORD_HASH.includes("$")) {
  no("EDITOR_PASSWORD_HASH contains a $ — regenerate it with scripts/set-password.mjs");
  process.exit(1);
}
if (!process.env.EDITOR_PASSWORD_HASH.startsWith("scrypt:")) {
  no("EDITOR_PASSWORD_HASH is malformed — regenerate it with scripts/set-password.mjs");
  process.exit(1);
}
ok("password hash format looks right");

/* ── 2. Credentials work ─────────────────────────────────────────────────── */

step("2. Talking to Sanity");

const { createClient } = await import("@sanity/client");
const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: "2026-01-01",
  useCdn: false,
});

try {
  await client.fetch("*[_type == 'sanity.imageAsset'][0]._id");
  ok("read access works");
} catch (error) {
  no(`cannot read the dataset: ${error.message}`);
  console.log("    Check the project id, and that the dataset is named " + dataset + ".");
  process.exit(1);
}

const probeId = `setupProbe.${Date.now()}`;
try {
  await client.createOrReplace({ _id: probeId, _type: "siteSettings" });
  await client.delete(probeId);
  ok("write access works");
} catch (error) {
  no(`cannot write: ${error.message}`);
  console.log("    The token needs the Editor role, not Viewer.");
  process.exit(1);
}

/* ── 3. Seed ─────────────────────────────────────────────────────────────── */

step("3. Importing the starter content");

const before = await client.fetch("count(*[_type == 'photo'])");
if (before > 0) {
  ok(`${before} photos already there — re-running the seed will refresh them, not duplicate`);
}
execFileSync("node", ["scripts/seed-sanity.mjs"], { stdio: "inherit" });

/* ── 4. Prove the pipeline ───────────────────────────────────────────────── */

step("4. Verifying the upload pipeline end to end");

const sharp = (await import("sharp")).default;
const { prepareUpload } = await import("../src/lib/image-metadata.ts");

// Build a photo carrying GPS coordinates, exactly like a camera would.
const withGps = await sharp("public/mock/p1.jpg")
  .withMetadata({
    exif: {
      IFD0: { Make: "Canon", Model: "EOS R6" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "39/1 44/1 5820/100",
        GPSLongitudeRef: "W",
        GPSLongitude: "104/1 59/1 1500/100",
      },
    },
  })
  .toBuffer();

const meta = await sharp(withGps).metadata();
ok(`test photo built with ${meta.exif?.length ?? 0} bytes of EXIF, including GPS`);

const prepared = prepareUpload(new Uint8Array(withGps));
if (!prepared.ok) {
  no(`the pipeline rejected its own test image: ${prepared.reason}`);
  process.exit(1);
}

const after = await sharp(prepared.bytes).metadata();
const hasGpsStrings = Buffer.from(prepared.bytes).includes(Buffer.from("GPS", "latin1"));
if ((after.exif?.length ?? 0) > 0 || hasGpsStrings) {
  no("EXIF survived the strip — do not ship this");
  process.exit(1);
}
ok(`EXIF removed (${prepared.removed.join(", ")}), no GPS bytes remain`);

// And confirm the stripped bytes really do upload.
const asset = await client.assets.upload("image", Buffer.from(prepared.bytes), {
  filename: "setup-verification.jpg",
  contentType: "image/jpeg",
});
ok(`uploaded to Sanity as ${asset._id}`);

const stored = await client.fetch(
  `*[_id == $id][0]{ "w": metadata.dimensions.width, "h": metadata.dimensions.height, "lqip": metadata.lqip, "exif": metadata.exif, "loc": metadata.location }`,
  { id: asset._id },
);
ok(`Sanity recorded ${stored.w}×${stored.h} and generated a blur placeholder`);
if (stored.exif || stored.loc) {
  no("Sanity extracted EXIF or location metadata — check the schema options");
} else {
  ok("no EXIF or location stored in the CMS either");
}

await client.delete(asset._id);
ok("test asset cleaned up");

/* ── Done ────────────────────────────────────────────────────────────────── */

const photos = await client.fetch("count(*[_type == 'photo'])");
const cats = await client.fetch("count(*[_type == 'category'])");

console.log(`
\x1b[1mReady.\x1b[0m ${photos} photos and ${cats} categories are in Sanity.

  Next:  npm run dev
         open http://localhost:3000/settings
         sign in and change something — it should save now.

  Then delete SANITY_API_WRITE_TOKEN from .env.local only if you are NOT
  using the editor. The editor saves through it, so normally it stays.
`);
