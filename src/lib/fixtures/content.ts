/**
 * Local fixture content.
 *
 * This is what the site serves when no Sanity project is configured. Every
 * export matches the shape the GROQ queries return, so `content.ts` can hand
 * back either source without a component knowing which it got — and so the site
 * builds, runs, and can be reviewed before any accounts exist.
 *
 * Delete this file, /public/mock, and scripts/build-fixtures.mjs once the
 * dataset is populated.
 */

import assets from "./assets.json";
import type {
  AboutContent,
  BookingContent,
  BudgetRange,
  Category,
  ContactContent,
  HomeContent,
  ImageAsset,
  Photo,
  SessionType,
  SiteSettings,
} from "../types";

const a = assets as Record<string, ImageAsset>;

export const categories: Category[] = [
  { _id: "cat-weddings", title: "Weddings", slug: "weddings", order: 0 },
  { _id: "cat-portraits", title: "Portraits", slug: "portraits", order: 1 },
  { _id: "cat-events", title: "Events", slug: "events", order: 2 },
  { _id: "cat-nature", title: "Nature", slug: "nature", order: 3 },
];

/**
 * `order` is the drag order from the admin, lowest first. A photo can carry more
 * than one category — w4 below is both a wedding and an event, and appears under
 * either filter without being duplicated.
 */
export const photos: Photo[] = [
  { _id: "ph-01", image: a.p1, categories: ["portraits"], featured: true, order: 0 },
  { _id: "ph-02", image: a.w1, categories: ["weddings"], featured: false, order: 1 },
  { _id: "ph-03", image: a.p5, categories: ["portraits"], featured: true, order: 2 },
  { _id: "ph-04", image: a.n3, categories: ["nature"], featured: true, order: 3 },
  { _id: "ph-05", image: a.p3, categories: ["portraits"], featured: true, order: 4 },
  { _id: "ph-06", image: a.w3, categories: ["weddings"], featured: false, order: 5 },
  { _id: "ph-07", image: a.p6, categories: ["nature"], featured: true, order: 6 },
  { _id: "ph-08", image: a.e3, categories: ["events", "weddings"], featured: false, order: 7 },
  { _id: "ph-09", image: a.p4, categories: ["portraits"], featured: true, order: 8 },
  { _id: "ph-10", image: a.w2, categories: ["weddings"], featured: false, order: 9 },
  { _id: "ph-11", image: a.n4, categories: ["nature"], featured: false, order: 10 },
  { _id: "ph-12", image: a.e1, categories: ["events"], featured: false, order: 11 },
  { _id: "ph-13", image: a.w4, categories: ["weddings", "events"], featured: false, order: 12 },
  { _id: "ph-14", image: a.n1, categories: ["nature"], featured: false, order: 13 },
  { _id: "ph-15", image: a.e2, categories: ["events"], featured: false, order: 14 },
  { _id: "ph-16", image: a.w5, categories: ["weddings"], featured: false, order: 15 },
  { _id: "ph-17", image: a.p2, categories: ["nature"], featured: false, order: 16 },
  { _id: "ph-18", image: a.n2, categories: ["nature"], featured: false, order: 17 },
  { _id: "ph-19", image: a.e4, categories: ["events", "weddings"], featured: false, order: 18 },
];

export const sessionTypes: SessionType[] = [
  {
    _id: "st-wedding",
    title: "Weddings",
    description: "Full-day coverage, two shooters, and an online gallery within three weeks.",
    startingPrice: 2800,
    order: 0,
  },
  {
    _id: "st-portrait",
    title: "Portraits",
    description: "Seniors, families, headshots. About ninety minutes, one location.",
    startingPrice: 350,
    order: 1,
  },
  {
    _id: "st-event",
    title: "Events",
    description: "Showers, reunions, milestone parties. Priced by the hour.",
    startingPrice: 200,
    order: 2,
  },
];

export const home: HomeContent = {
  hero: a.hero,
  headlineBefore: "The parts you",
  headlineScript: "remember",
  headlineAfter: "",
  intro:
    "I photograph weddings, portraits, and the ordinary afternoons in between — mostly outdoors, mostly in whatever light the day gives us.",
  closingHeading: "Dates open through fall",
  closingBody:
    "Tell me when and where, and I will tell you within a day whether I am free.",
};

/* TODO: Hattie to replace — all About copy below is placeholder written in her
   voice. It is here so the page can be judged with real sentence lengths in it,
   not so it can ship. */
export const about: AboutContent = {
  portrait: a.portrait,
  // The h1 should describe the page rather than the brand, and carry a term
  // someone might actually search.
  heading: "About Hattie",
  body: [
    "TODO: Hattie to replace — I have been photographing people for about eight years, which started the way most of these things start: a hand-me-down camera and a friend who needed headshots and could not pay me.",
    "TODO: Hattie to replace — I shoot mostly outdoors and mostly late in the day, because that is when people stop performing. If you are worried you are not photogenic, you are in good company. Almost nobody likes being photographed for the first ten minutes. That is what the first ten minutes are for.",
    "TODO: Hattie to replace — Practically: I answer emails within a day, I send galleries within three weeks, and I will tell you if I think another photographer is a better fit for what you want. I would rather do that than take the booking.",
    "TODO: Hattie to replace — When I am not working I am usually out walking with the same camera, taking pictures of trees that no one asked for.",
  ],
  pullQuote: "Nobody likes the first ten minutes",
};

export const booking: BookingContent = {
  heading: "Booking",
  intro: [
    "Pick a time below and we will talk for twenty minutes — what you want, where, roughly when, and whether I am the right person for it. No deposit at this stage.",
    "If nothing on the calendar works, email me and we will find something. Weekends book out first, usually three to four months ahead.",
  ],
  fallbackNote: "Calendar not loading?",
};

export const contact: ContactContent = {
  heading: "Contact",
  intro:
    "The more you can tell me here, the more useful my first reply is — I would rather quote you properly than send you a rate card.",
  autoResponseSubject: "Thanks — I have your message",
  autoResponseBody:
    "Thanks for getting in touch. I have your message and I answer everything within one working day, usually sooner. If it has been longer than that, something has gone wrong on my end — please reply to this email and nudge me.\n\n— Hattie",
};

/** Drives the Contact form dropdown. Kept as data so the labels stay editable. */
export const budgetRanges: BudgetRange[] = [
  { value: "under-500", label: "Under $500" },
  { value: "500-1500", label: "$500 – $1,500" },
  { value: "1500-3000", label: "$1,500 – $3,000" },
  { value: "3000-plus", label: "$3,000+" },
  { value: "unsure", label: "Not sure yet" },
];

export const settings: SiteSettings = {
  availability: {
    enabled: true,
    text: "Booking fall 2026 — 3 dates left",
  },
  business: {
    name: "Hattie's Highlights",
    // TODO: Hattie to replace — drives SEO titles and LocalBusiness schema.
    city: "TODO_CITY",
    region: "TODO_STATE",
    serviceArea: "TODO_CITY and surrounding counties",
    phone: "TODO_PHONE",
    email: "hello@hattieshighlights.com",
    hours: "By appointment",
    social: [
      { label: "Instagram", href: "https://instagram.com/" },
      { label: "Facebook", href: "https://facebook.com/" },
      { label: "Email", href: "mailto:hello@hattieshighlights.com" },
    ],
  },
  schedulingUrl: "https://calendly.com/",
};
