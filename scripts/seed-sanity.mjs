/**
 * Fills a brand-new Sanity project with everything the site is currently
 * showing: the photos, the categories, the session types, and all the page
 * copy.
 *
 * The point is what Hattie sees the first time she opens the admin. An empty
 * Studio is a form with thirty blank fields and no clue what goes in them. A
 * seeded one is her site, laid out exactly as it appears, ready to be edited a
 * field at a time.
 *
 *   node scripts/seed-sanity.mjs --dry-run   # show what would be created
 *   node scripts/seed-sanity.mjs             # actually create it
 *
 * Needs SANITY_API_WRITE_TOKEN in .env.local. That token is the one genuinely
 * dangerous credential in this project — it can write to and delete from the
 * dataset. Create it, run this once, then delete it from Sanity. The site never
 * uses it; only this script does.
 */

import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { createClient } from "@sanity/client";

const DRY_RUN = process.argv.includes("--dry-run");

/* ── Environment ─────────────────────────────────────────────────────────── */

function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    /* No .env.local — fall back to the real environment. */
  }
}
loadEnv();

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_API_WRITE_TOKEN;

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

if (!projectId) fail("NEXT_PUBLIC_SANITY_PROJECT_ID is not set. Run `npx sanity@latest init` first.");
if (!token && !DRY_RUN) {
  fail(
    "SANITY_API_WRITE_TOKEN is not set.\n" +
      "    Create one at https://sanity.io/manage → your project → API → Tokens (Editor).\n" +
      "    Add it to .env.local, run this once, then delete the token.",
  );
}

const client = DRY_RUN
  ? null
  : createClient({ projectId, dataset, token, apiVersion: "2026-01-01", useCdn: false });

/* ── Fixture content ─────────────────────────────────────────────────────── */

const assets = JSON.parse(readFileSync("src/lib/fixtures/assets.json", "utf8"));

const CATEGORIES = [
  { key: "weddings", title: "Weddings" },
  { key: "portraits", title: "Portraits" },
  { key: "events", title: "Events" },
  { key: "nature", title: "Nature" },
];

const SESSION_TYPES = [
  {
    key: "weddings",
    title: "Weddings",
    description: "Full-day coverage, two shooters, and an online gallery within three weeks.",
    startingPrice: 2800,
  },
  {
    key: "portraits",
    title: "Portraits",
    description: "Seniors, families, headshots. About ninety minutes, one location.",
    startingPrice: 350,
  },
  {
    key: "events",
    title: "Events",
    description: "Showers, reunions, milestone parties. Priced by the hour.",
    startingPrice: 200,
  },
];

// asset key → categories. Mirrors src/lib/fixtures/content.ts.
const PHOTOS = [
  ["p1", ["portraits"], true],
  ["w1", ["weddings"], false],
  ["p5", ["portraits"], true],
  ["n3", ["nature"], true],
  ["p3", ["portraits"], true],
  ["w3", ["weddings"], false],
  ["p6", ["nature"], true],
  ["e3", ["events", "weddings"], false],
  ["p4", ["portraits"], true],
  ["w2", ["weddings"], false],
  ["n4", ["nature"], false],
  ["e1", ["events"], false],
  ["w4", ["weddings", "events"], false],
  ["n1", ["nature"], false],
  ["e2", ["events"], false],
  ["w5", ["weddings"], false],
  ["p2", ["nature"], false],
  ["n2", ["nature"], false],
  ["e4", ["events", "weddings"], false],
];

/**
 * The orderable-document-list plugin sorts on a lexicographic `orderRank`.
 * Zero-padded indexes sort correctly and get rewritten the moment Hattie drags
 * anything, so they only need to be right once.
 */
const rank = (i) => String(i).padStart(6, "0");

/* ── Upload ──────────────────────────────────────────────────────────────── */

let uploaded = 0;

async function uploadImage(key) {
  const asset = assets[key];
  if (!asset) fail(`No fixture asset named "${key}".`);

  const path = join("public", asset.src.replace(/^\//, ""));
  const bytes = readFileSync(path);

  if (DRY_RUN) {
    console.log(`    would upload ${basename(path)} (${(bytes.length / 1024).toFixed(0)} KB)`);
    return { _type: "image", asset: { _type: "reference", _ref: `image-${key}-dryrun` }, alt: asset.alt };
  }

  const result = await client.assets.upload("image", bytes, {
    filename: basename(path),
    contentType: "image/jpeg",
  });
  uploaded += 1;
  process.stdout.write(`\r    uploaded ${uploaded} image${uploaded === 1 ? "" : "s"}…`);

  return { _type: "image", asset: { _type: "reference", _ref: result._id }, alt: asset.alt };
}

async function commit(docs) {
  if (DRY_RUN) {
    for (const doc of docs) console.log(`    would create ${doc._type} — ${doc._id}`);
    return;
  }
  // createOrReplace makes the script safe to re-run: it converges on this
  // content rather than piling up duplicates.
  const tx = docs.reduce((t, doc) => t.createOrReplace(doc), client.transaction());
  await tx.commit();
}

/* ── Run ─────────────────────────────────────────────────────────────────── */

async function main() {
  console.log(
    `\n  ${DRY_RUN ? "DRY RUN — nothing will be written" : `Seeding ${projectId}/${dataset}`}\n`,
  );

  console.log("  Categories");
  await commit(
    CATEGORIES.map((c, i) => ({
      _id: `category-${c.key}`,
      _type: "category",
      title: c.title,
      slug: { _type: "slug", current: c.key },
      orderRank: rank(i),
    })),
  );

  console.log("  Session types");
  await commit(
    SESSION_TYPES.map((s, i) => ({
      _id: `sessionType-${s.key}`,
      _type: "sessionType",
      title: s.title,
      description: s.description,
      startingPrice: s.startingPrice,
      orderRank: rank(i),
    })),
  );

  console.log(`  Photos (${PHOTOS.length})`);
  const photoDocs = [];
  for (const [i, [key, categories, featured]] of PHOTOS.entries()) {
    photoDocs.push({
      _id: `photo-${key}`,
      _type: "photo",
      image: await uploadImage(key),
      categories: categories.map((c) => ({
        _type: "reference",
        _ref: `category-${c}`,
        _key: `${key}-${c}`,
      })),
      featured,
      orderRank: rank(i),
    });
  }
  if (!DRY_RUN) process.stdout.write("\n");
  await commit(photoDocs);

  console.log("  Pages");
  await commit([
    {
      _id: "homePage",
      _type: "homePage",
      hero: await uploadImage("hero"),
      headlineBefore: "The parts you",
      headlineScript: "remember",
      headlineAfter: "",
      intro:
        "I photograph weddings, portraits, and the ordinary afternoons in between — mostly outdoors, mostly in whatever light the day gives us.",
      closingHeading: "Dates open through fall",
      closingBody: "Tell me when and where, and I will tell you within a day whether I am free.",
    },
    {
      _id: "aboutPage",
      _type: "aboutPage",
      portrait: await uploadImage("portrait"),
      heading: "About Hattie",
      body: [
        "TODO: Hattie to replace — I have been photographing people for about eight years, which started the way most of these things start: a hand-me-down camera and a friend who needed headshots and could not pay me.",
        "TODO: Hattie to replace — I shoot mostly outdoors and mostly late in the day, because that is when people stop performing. If you are worried you are not photogenic, you are in good company. Almost nobody likes being photographed for the first ten minutes. That is what the first ten minutes are for.",
        "TODO: Hattie to replace — Practically: I answer emails within a day, I send galleries within three weeks, and I will tell you if I think another photographer is a better fit for what you want. I would rather do that than take the booking.",
        "TODO: Hattie to replace — When I am not working I am usually out walking with the same camera, taking pictures of trees that no one asked for.",
      ],
      pullQuote: "Nobody likes the first ten minutes",
    },
    {
      _id: "bookingPage",
      _type: "bookingPage",
      heading: "Booking",
      intro: [
        "Pick a time below and we will talk for twenty minutes — what you want, where, roughly when, and whether I am the right person for it. No deposit at this stage.",
        "If nothing on the calendar works, email me and we will find something. Weekends book out first, usually three to four months ahead.",
      ],
      fallbackNote: "Calendar not loading?",
    },
    {
      _id: "contactPage",
      _type: "contactPage",
      heading: "Contact",
      intro:
        "The more you can tell me here, the more useful my first reply is — I would rather quote you properly than send you a rate card.",
      autoResponseSubject: "Thanks — I have your message",
      autoResponseBody:
        "Thanks for getting in touch. I have your message and I answer everything within one working day, usually sooner. If it has been longer than that, something has gone wrong on my end — please reply to this email and nudge me.\n\n— Hattie",
    },
    {
      _id: "siteSettings",
      _type: "siteSettings",
      availability: { enabled: true, text: "Booking fall 2026 — 3 dates left" },
      schedulingUrl: "https://calendly.com/",
      contactEmail: "hello@hattieshighlights.com",
      business: {
        name: "Hattie's Highlights",
        city: "TODO_CITY",
        region: "TODO_STATE",
        serviceArea: "TODO_CITY and surrounding counties",
        phone: "",
        hours: "By appointment",
        social: [
          { _key: "instagram", label: "Instagram", href: "https://instagram.com/" },
          { _key: "facebook", label: "Facebook", href: "https://facebook.com/" },
        ],
      },
    },
  ]);

  console.log(
    DRY_RUN
      ? "\n  Dry run complete — nothing was written.\n"
      : `\n  Done. Open http://localhost:3000/studio to see it.\n` +
          `  Remember to delete the write token from sanity.io/manage now that seeding is finished.\n`,
  );
}

main().catch((error) => {
  console.error("\n  ✗ Seeding failed:", error.message || error);
  process.exit(1);
});
