/**
 * Content access layer — the only module that knows where content comes from.
 *
 * Each function asks Sanity first and falls back to the local fixtures when
 * there is no project configured, or when a document has not been created yet.
 * Pages and components see one shape either way, which is what let the whole
 * site be built and reviewed before any accounts existed.
 *
 * Once the dataset is populated the fallbacks stop being reached; deleting
 * `fixtures/` is then a one-line change here rather than a rewrite.
 */

import { isSanityConfigured } from "../../sanity/env";
import { query } from "../sanity/client";
import {
  aboutQuery,
  bookingQuery,
  categoriesQuery,
  contactQuery,
  featuredPhotosQuery,
  homeQuery,
  photosQuery,
  sessionTypesQuery,
  settingsQuery,
} from "../sanity/queries";
import * as fixture from "./fixtures/content";
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

export { isSanityConfigured };

/**
 * Sanity returns null for a document that has not been created yet, and empty
 * arrays for types with no entries. Both mean "nothing published", and both
 * should show the fixture rather than a blank page.
 */
async function fromSanityOr<T>(
  groq: string,
  fallback: T,
  params: Record<string, unknown> = {},
  tags: string[] = [],
): Promise<T> {
  if (!isSanityConfigured) return fallback;
  const result = await query<T>(groq, params, tags);
  if (result === null || result === undefined) return fallback;
  if (Array.isArray(result) && result.length === 0) return fallback;
  return result;
}

export async function getSettings(): Promise<SiteSettings> {
  return fromSanityOr(settingsQuery, fixture.settings, {}, ["settings"]);
}

export async function getHome(): Promise<HomeContent> {
  return fromSanityOr(homeQuery, fixture.home, {}, ["home", "photo"]);
}

export async function getAbout(): Promise<AboutContent> {
  return fromSanityOr(aboutQuery, fixture.about, {}, ["about"]);
}

export async function getBooking(): Promise<BookingContent> {
  return fromSanityOr(bookingQuery, fixture.booking, {}, ["booking"]);
}

export async function getContact(): Promise<ContactContent> {
  return fromSanityOr(contactQuery, fixture.contact, {}, ["contact"]);
}

export async function getCategories(): Promise<Category[]> {
  return fromSanityOr(categoriesQuery, fixture.categories, {}, ["category"]);
}

export async function getSessionTypes(): Promise<SessionType[]> {
  return fromSanityOr(sessionTypesQuery, fixture.sessionTypes, {}, ["sessionType"]);
}

/**
 * Budget ranges have no CMS document behind them on purpose. They are the one
 * list Hattie has no reason to edit — changing them changes how enquiries are
 * bucketed, which is a decision about the business rather than about content.
 */
export async function getBudgetRanges(): Promise<BudgetRange[]> {
  return fixture.budgetRanges;
}

/** Home teaser grid: starred photos, in her drag order, capped. */
export async function getFeaturedPhotos(limit = 6): Promise<Photo[]> {
  const fallback = fixture.photos
    .filter((p) => p.featured)
    .sort((x, y) => Number(x.order) - Number(y.order))
    .slice(0, limit);

  return fromSanityOr(featuredPhotosQuery, fallback, { limit }, ["photo"]);
}

/**
 * MOCK_PHOTOS exists so the portfolio can be load-tested at a realistic library
 * size without inventing a hundred stock images: it cycles the available set up
 * to the requested count with unique ids. Fixture-only — it has no effect once
 * Sanity is supplying the photos.
 */
function withStressCount(list: Photo[]): Photo[] {
  const target = Number(process.env.MOCK_PHOTOS);
  if (isSanityConfigured || !Number.isFinite(target) || target <= list.length) return list;

  return Array.from({ length: target }, (_, i) => {
    const source = list[i % list.length];
    return { ...source, _id: `${source._id}-x${i}`, order: i };
  });
}

export async function getPhotos(category?: string): Promise<Photo[]> {
  const fallback = fixture.photos
    .filter((p) => !category || p.categories.includes(category))
    .sort((x, y) => Number(x.order) - Number(y.order));

  const photos = await fromSanityOr(
    photosQuery,
    fallback,
    { category: category ?? null },
    ["photo"],
  );

  return withStressCount(photos);
}
