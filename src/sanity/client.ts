import { createClient } from "next-sanity";

import { apiVersion, dataset, isSanityConfigured, projectId } from "../../sanity/env";

/**
 * Read-only client for the public site.
 *
 * No token: the dataset is public, so reads need no credential and there is
 * nothing here that could leak into a bundle. Writes happen only inside the
 * Studio, authenticated by Sanity against the signed-in user — the public site
 * is read-only, always.
 */
export const sanityClient = isSanityConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
      perspective: "published",
    })
  : null;

/** Runs a query, or returns null when no Sanity project is configured yet. */
export async function query<T>(
  groq: string,
  params: Record<string, unknown> = {},
  tags: string[] = [],
): Promise<T | null> {
  if (!sanityClient) return null;
  return sanityClient.fetch<T>(groq, params, {
    next: { revalidate: 60, tags },
  });
}
