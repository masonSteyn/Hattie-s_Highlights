/**
 * Sanity connection details.
 *
 * The project id and dataset are public by design — they identify a dataset,
 * they do not grant access to it. Reads of a public dataset need no credential
 * at all, and every write is authenticated by Sanity against the signed-in
 * user. There is no token in the browser bundle, and none is needed.
 *
 * `isSanityConfigured` is what lets the site run before a project exists: with
 * no project id, the content layer falls back to local fixtures instead of
 * crashing at build time.
 */
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
export const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? "2026-01-01";

export const isSanityConfigured = projectId.length > 0;

export const studioBasePath = "/studio";
