/**
 * Content access layer — the only module that knows where content comes from.
 *
 * Everything lives in `content/site.json`, committed to the repo alongside the
 * photographs in `public/photos`. That has three consequences worth stating:
 *
 *  - **No network, no service, no bill.** The store is imported at build time,
 *    so a page render costs nothing beyond reading memory. Nothing here can be
 *    slow, rate-limited, or down.
 *  - **Every change is a commit.** The editor publishes by committing to the
 *    repo, so the content has a full history and any change can be reverted by
 *    someone who knows git. That is the closest thing to an undo button a
 *    non-technical editor is going to get.
 *  - **Publishing is a deploy.** A change is live once Vercel finishes
 *    rebuilding, roughly a minute or two, rather than instantly.
 *
 * Components never see any of this. They call these functions and get plain
 * objects.
 */

import store from "../../content/site.json";
import type {
  AboutContent,
  BookingContent,
  BudgetRange,
  Category,
  ContactContent,
  HomeContent,
  Photo,
  SessionType,
  SiteSettings,
} from "./types";

/* The JSON is the source of truth for shape as well as content; these casts are
   the one place the two are tied together. */
const site = store as unknown as {
  photos: Photo[];
  categories: Category[];
  sessionTypes: SessionType[];
  home: HomeContent;
  about: AboutContent;
  booking: BookingContent;
  contact: ContactContent;
  settings: SiteSettings;
};

export type SiteContent = typeof site;

/** The whole store, for the editor to load current values from. */
export function getSiteContent(): SiteContent {
  return site;
}

export async function getSettings(): Promise<SiteSettings> {
  return site.settings;
}

export async function getHome(): Promise<HomeContent> {
  return site.home;
}

export async function getAbout(): Promise<AboutContent> {
  return site.about;
}

export async function getBooking(): Promise<BookingContent> {
  return site.booking;
}

export async function getContact(): Promise<ContactContent> {
  return site.contact;
}

export async function getCategories(): Promise<Category[]> {
  return [...site.categories].sort((a, b) => Number(a.order) - Number(b.order));
}

export async function getSessionTypes(): Promise<SessionType[]> {
  return [...site.sessionTypes].sort((a, b) => Number(a.order) - Number(b.order));
}

/**
 * Budget ranges have no editable form on purpose. They decide how enquiries are
 * bucketed, which is a decision about the business rather than about content.
 */
const budgetRanges: BudgetRange[] = [
  { value: "under-500", label: "Under $500" },
  { value: "500-1500", label: "$500 – $1,500" },
  { value: "1500-3000", label: "$1,500 – $3,000" },
  { value: "3000-plus", label: "$3,000+" },
  { value: "unsure", label: "Not sure yet" },
];

export async function getBudgetRanges(): Promise<BudgetRange[]> {
  return budgetRanges;
}

/**
 * Home teaser grid: starred photos, in her order.
 *
 * Every starred photo, not a fixed handful. This used to stop at six while the
 * editor said "11 showing on the home page" — so five stars did nothing, and
 * the only way to discover that was to count the home page by hand. Starring is
 * the control; how many are starred is her decision to make.
 */
export async function getFeaturedPhotos(limit?: number): Promise<Photo[]> {
  const featured = site.photos
    .filter((p) => p.featured)
    .sort((a, b) => Number(a.order) - Number(b.order));

  return limit === undefined ? featured : featured.slice(0, limit);
}

/**
 * MOCK_PHOTOS cycles the library up to a given count so the portfolio can be
 * load-tested at a realistic size. Development only.
 */
function withStressCount(list: Photo[]): Photo[] {
  const target = Number(process.env.MOCK_PHOTOS);
  if (!Number.isFinite(target) || target <= list.length) return list;

  return Array.from({ length: target }, (_, i) => {
    const source = list[i % list.length];
    return { ...source, _id: `${source._id}-x${i}`, order: i };
  });
}

export async function getPhotos(category?: string): Promise<Photo[]> {
  const filtered = site.photos
    .filter((p) => !category || p.categories.includes(category))
    .sort((a, b) => Number(a.order) - Number(b.order));

  return withStressCount(filtered);
}
