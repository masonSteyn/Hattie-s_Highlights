/**
 * FIXTURE TOOLING — delete along with src/lib/fixtures once Sanity is wired.
 *
 * Reads every image in public/mock, records its real dimensions, and generates a
 * base64 LQIP. This is a local stand-in for the metadata Sanity returns for an
 * uploaded asset, so the site can render blur-up placeholders and reserve exact
 * layout space before any CMS exists.
 *
 *   node scripts/build-fixtures.mjs
 */

import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const MOCK_DIR = "public/mock";
const OUT = "src/lib/fixtures/assets.json";

// Alt text is a CMS field in production. These stand in for what Hattie would
// write, and are deliberately descriptive rather than decorative.
const ALT = {
  hero: "A couple walking a gravel path at golden hour, backs to the camera",
  p1: "A woman outdoors at golden hour, backlit by the last of the sun",
  p2: "A ridge line at sunset with low cloud sitting in the valley",
  p3: "A portrait taken beside open water, soft afternoon light",
  p4: "A studio portrait in low warm light, subject turned three-quarters away",
  p5: "A portrait against a deep red wall, shoulders squared to the camera",
  p6: "A broad fig tree from below, sun breaking through the canopy",
  portrait: "Hattie, outdoors with a camera in her lap, looking at the frame",
  w1: "A bride and groom under a lifted veil, photographed in black and white",
  w2: "Two hands resting on a bouquet, wedding bands and a wristwatch in frame",
  w3: "A bride on a pebble beach, veil running the full length of the shore",
  w4: "Confetti falling as a couple kiss, guests crowded in close on both sides",
  w5: "A couple walking beneath a palm at dusk, still laughing at something",
  e1: "A plated course at a long dinner, candles and glassware down the table",
  e2: "Guests blowing bubbles around a couple in low winter sun",
  e3: "A reception table set with linen, wildflowers, and mismatched glassware",
  e4: "Two ceremony chairs on cut grass, name cards tied to the backs",
  n1: "Late sun coming through a stand of tall pines",
  n2: "A boardwalk running into dense rainforest",
  n3: "Layered ridge lines fading into haze at the end of the day",
  n4: "Fog sitting on the tops of a conifer forest",
};

const out = {};

for (const file of readdirSync(MOCK_DIR).filter((f) => f.endsWith(".jpg")).sort()) {
  const key = file.replace(/\.jpg$/, "");
  const path = join(MOCK_DIR, file);
  const { width, height } = await sharp(path).metadata();
  const lqip = await sharp(path)
    .resize(20, 20, { fit: "inside" })
    .jpeg({ quality: 40 })
    .toBuffer();

  if (!ALT[key]) throw new Error(`No alt text for ${key} — every image needs one.`);

  out[key] = {
    src: `/mock/${file}`,
    width,
    height,
    lqip: `data:image/jpeg;base64,${lqip.toString("base64")}`,
    alt: ALT[key],
  };
}

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${Object.keys(out).length} assets to ${OUT}`);
