import "server-only";

import { createClient } from "@sanity/client";

import { apiVersion, dataset, isSanityConfigured, projectId } from "../../sanity/env";

/**
 * The only module that can change content.
 *
 * It holds the Sanity write token, which is why it is `server-only` and why
 * nothing here is ever imported by a client component. Hattie never sees a
 * token, never signs in to Sanity, and never learns that Sanity exists — she
 * signs in to this site with a password and edits through our own screens. The
 * CMS is infrastructure, not something she has an account with.
 *
 * Every export assumes the caller has already checked the session. That check
 * lives in the server actions, one layer up, so there is exactly one place to
 * audit it.
 */

const token = process.env.SANITY_API_WRITE_TOKEN;

export function writeEnabled() {
  return Boolean(isSanityConfigured && token);
}

/** Why writing is unavailable, phrased for the person looking at the screen. */
export function writeBlockedReason(): string | null {
  if (!isSanityConfigured) return "The content store is not connected yet (no Sanity project id).";
  if (!token) return "The content store is read-only (no write token configured).";
  return null;
}

function client() {
  if (!writeEnabled()) throw new Error(writeBlockedReason() ?? "Writing is not available.");
  return createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    // Writes must never be served from or cached by the CDN.
    useCdn: false,
  });
}

/* ── Images ──────────────────────────────────────────────────────────────── */

export async function uploadImageAsset(bytes: Uint8Array, filename: string, contentType: string) {
  const asset = await client().assets.upload("image", Buffer.from(bytes), {
    filename,
    contentType,
  });
  return asset._id;
}

/** The shape Sanity stores for an image field. */
export function imageField(assetId: string, alt: string) {
  return {
    _type: "image",
    asset: { _type: "reference", _ref: assetId },
    alt,
  };
}

/* ── Documents ───────────────────────────────────────────────────────────── */

export async function patchDocument(id: string, fields: Record<string, unknown>) {
  await client().patch(id).set(fields).commit();
}

export async function createPhoto(doc: {
  image: ReturnType<typeof imageField>;
  categories: string[];
  featured: boolean;
  orderRank: string;
}) {
  return client().create({
    _type: "photo",
    image: doc.image,
    categories: doc.categories.map((slug) => ({
      _type: "reference",
      _ref: `category-${slug}`,
      _key: `${slug}-${Math.random().toString(36).slice(2, 8)}`,
    })),
    featured: doc.featured,
    orderRank: doc.orderRank,
  });
}

export async function deleteDocument(id: string) {
  await client().delete(id);
}

/**
 * Reordering.
 *
 * Ranks are plain zero-padded strings. Rather than shuffle neighbours, a moved
 * photo is given a rank half-way between the two it lands between — so a move
 * writes one document instead of rewriting the whole gallery, which matters
 * when there are a hundred of them and the connection is a phone on hotel wifi.
 */
export function rankBetween(before: string | undefined, after: string | undefined): string {
  const lo = before ? Number(before) : 0;
  const hi = after ? Number(after) : lo + 2_000_000;
  const mid = Math.floor((lo + hi) / 2);
  return String(mid).padStart(9, "0");
}

/** Ranks for a freshly seeded or re-normalised list, spaced to leave room. */
export function rankForIndex(index: number): string {
  return String((index + 1) * 1_000_000).padStart(9, "0");
}
