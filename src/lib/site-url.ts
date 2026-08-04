/**
 * The site's canonical origin — the one absolute URL that sitemap entries,
 * canonical tags, Open Graph images, and JSON-LD all have to agree on.
 *
 * Resolved in this order:
 *
 *  1. `NEXT_PUBLIC_SITE_URL`, when set. This is the override to reach for the
 *     day a real domain replaces the vercel.app one — set it and redeploy, no
 *     code change.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel injects at build time and
 *     which tracks the project's production domain automatically. It arrives
 *     without a scheme, hence the prefixing below.
 *  3. The known production URL, so a local build or a clone with no environment
 *     at all still emits absolute URLs rather than `undefined`.
 *
 * Note that this deliberately does NOT fall back to localhost in development.
 * A canonical tag or a sitemap entry pointing at localhost is worse than one
 * pointing at production — the former is broken for every reader, the latter is
 * merely premature. Anyone who genuinely wants local URLs can set the env var.
 */

const FALLBACK_ORIGIN = "https://hatties-highlights.vercel.app";

function resolveOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return normalize(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return normalize(vercel);

  return FALLBACK_ORIGIN;
}

/** Adds a scheme if one is missing and drops any trailing slash, so callers can
 *  always write `${siteUrl}/path` without doubling or losing a separator. */
function normalize(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

export const siteUrl = resolveOrigin();

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Whether a URL points at something more specific than a bare site root.
 *
 * The content store ships with placeholder social and scheduling links that are
 * just the provider's homepage — `https://facebook.com/` with no page after it.
 * Rendering those into `sameAs` would be publishing a claim that Hattie's
 * Facebook presence *is* facebook.com, which is both false and the kind of thing
 * structured data gets penalised for. Anything without a path segment is treated
 * as "not filled in yet" and dropped.
 */
export function isSpecificUrl(value: string | undefined): value is string {
  if (!value?.trim()) return false;

  try {
    const { pathname, search } = new URL(value);
    return pathname.replace(/\/+$/, "").length > 0 || search.length > 0;
  } catch {
    return false;
  }
}
