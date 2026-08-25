import "server-only";

import { createHash } from "node:crypto";

/**
 * A fingerprint of the content store, used to tell whether an editor session is
 * still working from the version of the site it was shown.
 *
 * ── The problem it solves ──────────────────────────────────────────────────
 *
 * Publishing writes the whole of content/site.json from a snapshot the browser
 * took when the editor loaded. Nothing checked that the snapshot was still
 * current, so the last publish won outright: a tab left open from an hour ago
 * would quietly overwrite every photo added since, and the only trace was the
 * image files left orphaned in the repository.
 *
 * That is not hypothetical. It removed real photographs from the live site
 * several times, and it reads as "my uploads are not sticking" rather than as
 * a conflict, because the upload genuinely worked.
 *
 * ── Why the fingerprint is of the *rendered* content ───────────────────────
 *
 * It deliberately describes what the editor was showing, not what the
 * repository holds. Those differ for a minute or two after every publish,
 * because the editor reads content baked into the build and the rebuild has to
 * finish first. Fingerprinting the rendered content means an editor still
 * serving the pre-publish build is correctly treated as out of date, rather
 * than being handed a matching token and allowed to write stale content back.
 *
 * Keys are sorted before hashing so the result depends only on the values, not
 * on the order a JSON parser happened to produce.
 */

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function contentFingerprint(store: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(store))).digest("hex").slice(0, 32);
}
