/**
 * The shape of everything Hattie controls.
 *
 * These types are the contract between the site and the CMS. Right now they are
 * satisfied by the fixtures in `content.ts`; in stage 4 they will be satisfied
 * by GROQ queries against Sanity. Nothing in the page components should know
 * which of the two it is talking to.
 */

export type ImageAsset = {
  /** Sanity asset _id once wired; a /public path while on fixtures. */
  src: string;
  /** Native dimensions. Kept so the grid can respect real aspect ratios and
   *  reserve space before the image loads. */
  width: number;
  height: number;
  /** Base64 LQIP. Sanity extracts this at ingest; generated at build time for
   *  the fixtures. */
  lqip: string;
  /** Hattie writes this. It is the alt attribute and nothing else. */
  alt: string;
};

export type Photo = {
  _id: string;
  image: ImageAsset;
  /** Slugs of the categories this photo belongs to. A photo can be in more
   *  than one. */
  categories: string[];
  /** Starred in the admin. Featured photos populate the home teaser grid —
   *  she curates the home page by starring, not by editing a second list. */
  featured: boolean;
  /** Manual drag order, lowest first. Sanity's orderable list stores this as a
   *  lexical rank string; the fixtures use numbers. Both sort correctly. */
  order: number | string;
  /** Optional caption. Rendered as text, never as HTML. */
  caption?: string;
};

export type Category = {
  _id: string;
  title: string;
  slug: string;
  order: number | string;
};

export type SessionType = {
  _id: string;
  title: string;
  description: string;
  /** Stored in whole currency units. Rendered as "from $X". */
  startingPrice: number;
  order: number | string;
};

export type AvailabilityBanner = {
  enabled: boolean;
  text: string;
};

export type HomeContent = {
  hero: ImageAsset;
  /** Headline is split so exactly one word can carry the script face. */
  headlineBefore: string;
  headlineScript: string;
  headlineAfter: string;
  intro: string;
  closingHeading: string;
  closingBody: string;
};

export type AboutContent = {
  portrait: ImageAsset;
  heading: string;
  /** Paragraphs, edited as rich text in the admin. Rendered as text nodes. */
  body: string[];
  /** At most one per page — the single place the script face is allowed to run
   *  long, and even here it is capped at about six words. */
  pullQuote: string;
};

export type BookingContent = {
  heading: string;
  /** What to expect, above the scheduler. */
  intro: string[];
  /** Shown under the embed when the iframe cannot load. */
  fallbackNote: string;
};

export type ContactContent = {
  heading: string;
  intro: string;
  /** Copy of the auto-response the sender receives. Editable in Settings. */
  autoResponseSubject: string;
  autoResponseBody: string;
};

export type BudgetRange = {
  value: string;
  label: string;
};

export type BusinessDetails = {
  name: string;
  city: string;
  region: string;
  serviceArea: string;
  phone: string;
  email: string;
  hours: string;
  social: { label: string; href: string }[];
};

export type SiteSettings = {
  availability: AvailabilityBanner;
  business: BusinessDetails;
  /** Validated against an allowlist of scheduling hosts before it is ever
   *  rendered into an iframe. */
  schedulingUrl: string;
};
