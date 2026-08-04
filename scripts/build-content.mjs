/**
 * Builds content/site.json from the photos in public/photos.
 *
 * Run once to create the store; after that the editor maintains it. Re-running
 * preserves everything already in the file and only fills in metadata for
 * photos it has not seen before, so it is safe to use after dropping new files
 * into public/photos by hand.
 *
 *   node scripts/build-content.mjs
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const STORE = "content/site.json";
const PHOTO_DIR = "public/photos";

const ALT = {
  hero: "A couple walking a gravel path at golden hour, backs to the camera",
  portrait: "Hattie, outdoors with a camera in her lap, looking at the frame",
  p1: "A woman outdoors at golden hour, backlit by the last of the sun",
  p2: "A ridge line at sunset with low cloud sitting in the valley",
  p3: "A portrait taken beside open water, soft afternoon light",
  p4: "A studio portrait in low warm light, subject turned three-quarters away",
  p5: "A portrait against a deep red wall, shoulders squared to the camera",
  p6: "A broad fig tree from below, sun breaking through the canopy",
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

const CATEGORIES = { p: "portraits", w: "weddings", e: "events", n: "nature" };
const FEATURED = new Set(["p1", "p5", "n3", "p3", "p6", "p4"]);
const ORDER = [
  "p1", "w1", "p5", "n3", "p3", "w3", "p6", "e3", "p4", "w2",
  "n4", "e1", "w4", "n1", "e2", "w5", "p2", "n2", "e4",
];

/** Dimensions plus a blur placeholder — the same metadata a CMS would return. */
export async function describeImage(path) {
  const { width, height } = await sharp(path).metadata();
  const lqip = await sharp(path).resize(20, 20, { fit: "inside" }).jpeg({ quality: 40 }).toBuffer();
  return { width, height, lqip: `data:image/jpeg;base64,${lqip.toString("base64")}` };
}

if (process.argv[1]?.endsWith("build-content.mjs")) {
  const existing = existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : null;
  const known = new Map((existing?.photos ?? []).map((p) => [p.image.src, p]));

  const files = readdirSync(PHOTO_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const photos = [];

  for (const file of files) {
    const key = file.replace(/\.[^.]+$/, "");
    if (key === "hero" || key === "portrait") continue;

    const src = `/photos/${file}`;
    if (known.has(src)) {
      photos.push(known.get(src));
      continue;
    }

    const meta = await describeImage(join(PHOTO_DIR, file));
    photos.push({
      // Shape matches src/lib/types.ts exactly, so no component cares that the
      // store is a JSON file rather than a CMS.
      _id: key,
      image: { src, ...meta, alt: ALT[key] ?? "" },
      categories: [CATEGORIES[key[0]] ?? "portraits"],
      featured: FEATURED.has(key),
      order: ORDER.indexOf(key) === -1 ? 999 : ORDER.indexOf(key),
    });
  }

  photos.sort((a, b) => a.order - b.order);
  photos.forEach((p, i) => (p.order = i));

  const image = async (key) => ({
    src: `/photos/${key}.jpg`,
    ...(await describeImage(join(PHOTO_DIR, `${key}.jpg`))),
    alt: ALT[key],
  });

  const store = existing ?? {};
  store.photos = photos;
  store.categories = store.categories ?? [
    { _id: "weddings", title: "Weddings", slug: "weddings", order: 0 },
    { _id: "portraits", title: "Portraits", slug: "portraits", order: 1 },
    { _id: "events", title: "Events", slug: "events", order: 2 },
    { _id: "nature", title: "Nature", slug: "nature", order: 3 },
  ];
  store.sessionTypes = store.sessionTypes ?? [
    { _id: "weddings", title: "Weddings", description: "Full-day coverage, two shooters, and an online gallery within three weeks.", startingPrice: 2800, order: 0 },
    { _id: "portraits", title: "Portraits", description: "Seniors, families, headshots. About ninety minutes, one location.", startingPrice: 350, order: 1 },
    { _id: "events", title: "Events", description: "Showers, reunions, milestone parties. Priced by the hour.", startingPrice: 200, order: 2 },
  ];
  store.home = store.home ?? {
    hero: await image("hero"),
    headlineBefore: "The parts you",
    headlineScript: "remember",
    headlineAfter: "",
    intro: "I photograph weddings, portraits, and the ordinary afternoons in between — mostly outdoors, mostly in whatever light the day gives us.",
    closingHeading: "Dates open through fall",
    closingBody: "Tell me when and where, and I will tell you within a day whether I am free.",
  };
  store.about = store.about ?? {
    portrait: await image("portrait"),
    heading: "About Hattie",
    body: [
      "TODO: Hattie to replace — I have been photographing people for about eight years, which started the way most of these things start: a hand-me-down camera and a friend who needed headshots and could not pay me.",
      "TODO: Hattie to replace — I shoot mostly outdoors and mostly late in the day, because that is when people stop performing. If you are worried you are not photogenic, you are in good company. Almost nobody likes being photographed for the first ten minutes. That is what the first ten minutes are for.",
      "TODO: Hattie to replace — Practically: I answer emails within a day, I send galleries within three weeks, and I will tell you if I think another photographer is a better fit for what you want. I would rather do that than take the booking.",
    ],
    pullQuote: "Nobody likes the first ten minutes",
  };
  store.booking = store.booking ?? {
    heading: "Booking",
    intro: [
      "Pick a time below and we will talk for twenty minutes — what you want, where, roughly when, and whether I am the right person for it. No deposit at this stage.",
      "If nothing on the calendar works, email me and we will find something. Weekends book out first, usually three to four months ahead.",
    ],
    fallbackNote: "Calendar not loading?",
  };
  store.contact = store.contact ?? {
    heading: "Contact",
    intro: "The more you can tell me here, the more useful my first reply is — I would rather quote you properly than send you a rate card.",
    autoResponseSubject: "Thanks — I have your message",
    autoResponseBody:
      "Thanks for getting in touch. I have your message and I answer everything within one working day, usually sooner. If it has been longer than that, something has gone wrong on my end — please reply to this email and nudge me.\n\n— Hattie",
  };
  store.settings = store.settings ?? {
    availability: { enabled: true, text: "Booking fall 2026 — 3 dates left" },
    schedulingUrl: "https://calendly.com/",
    business: {
      name: "Hattie's Highlights",
      city: "TODO_CITY",
      region: "TODO_STATE",
      serviceArea: "TODO_CITY and surrounding counties",
      phone: "",
      hours: "By appointment",
      email: "hello@hattieshighlights.com",
      social: [
        { label: "Instagram", href: "https://instagram.com/" },
        { label: "Facebook", href: "https://facebook.com/" },
      ],
    },
  };

  writeFileSync(STORE, `${JSON.stringify(store, null, 2)}\n`);
  console.log(`Wrote ${STORE}: ${photos.length} photos, ${store.categories.length} categories`);
}
