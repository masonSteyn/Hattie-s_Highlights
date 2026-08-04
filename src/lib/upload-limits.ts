/**
 * How large an upload may be, in the one place every layer reads it from.
 *
 * Three separate ceilings apply to a photo on its way to the server, and only
 * the smallest of them matters:
 *
 *  1. **Next's Server Action body limit — 1MB by default.** This is the one
 *     that bit. It is enforced before any application code runs, so a file over
 *     it never reaches the validation below and fails as a thrown request
 *     rather than a helpful message. It is raised in next.config.ts.
 *  2. **Vercel's platform limit, about 4.5MB.** A hard ceiling on the request
 *     body that no amount of configuration lifts, which is why the value here
 *     cannot simply be made large.
 *  3. **This limit**, which is what the editor and the server both check.
 *
 * `maxBytes` is deliberately set *below* the configured Server Action limit,
 * with room for multipart overhead — the boundary markers and headers that
 * FormData adds around the file. If it ever exceeds it, files in the gap go
 * back to failing with "the upload did not complete" and no explanation.
 * `npm run check:limits` fails the build rather than let that drift back in.
 */

export const UPLOAD_LIMITS = {
  /**
   * 3.5MB, against a 4MB Server Action limit. The gap absorbs multipart
   * overhead so a file that passes this check cannot be rejected by transport.
   */
  maxBytes: Math.round(3.5 * 1024 * 1024),
  /** Guards the image pipeline against a decompression bomb. */
  maxDimension: 12_000,
  maxPixels: 60_000_000,
} as const;

/** Rendered in megabytes, since bytes mean nothing to the person reading it. */
const mb = (bytes: number) => {
  const value = bytes / 1024 / 1024;
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} MB`;
};

/**
 * The one wording for "too big", shared by the browser check and the server
 * check so they cannot contradict each other.
 *
 * It says what to do about it: "too large" on its own leaves someone with a
 * photo they cannot upload and no idea what would work.
 */
export function tooLargeMessage(bytes: number): string {
  return `That photo is ${mb(bytes)}. The most that can be uploaded is ${mb(
    UPLOAD_LIMITS.maxBytes,
  )} — export it at a smaller size or a lower quality and try again.`;
}
