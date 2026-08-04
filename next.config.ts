import type { NextConfig } from "next";

/**
 * The scheduling allowlist, spelled out here rather than imported.
 *
 * Next compiles this file to next.config.compiled.js and requires that, in a
 * context where neither a relative `.ts` nor a relative `.json` import
 * resolves, and where process.cwd() is not guaranteed to be the project root.
 * Any of those makes `next dev` fail to load its own config. So the list is
 * duplicated from scheduling-providers.json — which is what the app reads —
 * and `npm run check:providers` fails if the two ever drift apart.
 */
const SCHEDULING_PROVIDERS = [
  "calendly.com",
  "cal.com",
  "savvycal.com",
  "tidycal.com",
  "acuityscheduling.com",
  "squarespacescheduling.com",
  "youcanbook.me",
  "zcal.co",
];

const isDev = process.env.NODE_ENV !== "production";

/** Hosts the scheduler iframe may come from — the same allowlist the CMS field
 *  is validated against, so the CSP cannot drift away from the validator. */
const schedulerOrigins = SCHEDULING_PROVIDERS.flatMap((host) => [
  `https://${host}`,
  `https://*.${host}`,
]);

const analyticsOrigin = "https://plausible.io";

/**
 * Content Security Policy.
 *
 * Two compromises, both called out rather than hidden:
 *
 *  - 'unsafe-inline' in style-src. Next inlines critical CSS per route and
 *    next/image sets inline styles on every image. A nonce-based style policy
 *    means giving up static rendering, which is what makes this site fast.
 *    Style injection is a far weaker primitive than script injection, and
 *    script-src stays strict.
 *  - 'unsafe-eval' in development only. Turbopack's HMR runtime needs it; it is
 *    absent from the production policy.
 *
 * The editor gets its own header block so it can be marked noindex and
 * no-store without loosening anything for visitors.
 */
const publicCsp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `script-src 'self' 'unsafe-inline' ${analyticsOrigin}${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  // next/font self-hosts every family, so no external font origin is needed.
  `font-src 'self' data:`,
  `img-src 'self' blob: data:`,
  `connect-src 'self' ${analyticsOrigin}`,
  `frame-src ${schedulerOrigins.join(" ")}`,
  `media-src 'self'`,
  `manifest-src 'self'`,
  `upgrade-insecure-requests`,
].join("; ");

const sharedHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Nothing on this site needs any of these.
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    // Two years, subdomains included, preload-eligible.
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/**
 * Ceiling on a Server Action request body.
 *
 * Next defaults this to 1MB, and the limit is enforced before any application
 * code runs — so a photo over it never reached the upload validator and failed
 * as a bare thrown request, surfacing as "the upload did not complete". Every
 * photo above 1MB was rejected while the validator advertised a 40MB limit.
 *
 * 4MB rather than higher because Vercel caps a request body at about 4.5MB no
 * matter what this says, and being rejected by the platform instead of by Next
 * puts us straight back to an unexplained failure.
 *
 * Kept in step with UPLOAD_LIMITS.maxBytes by `npm run check:limits`, which is
 * the only thing standing between a future edit and the same silent bug. It is
 * duplicated rather than imported for the reason given above SCHEDULING_PROVIDERS.
 */
const SERVER_ACTION_BODY_LIMIT = "4mb";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, a stray lockfile in a parent folder
  // makes Turbopack infer that folder as the root and quietly resolve modules
  // from the wrong tree.
  turbopack: { root: process.cwd() },

  experimental: {
    serverActions: { bodySizeLimit: SERVER_ACTION_BODY_LIMIT },
  },

  images: {
    // Every image is served from /public in this repo, so no remote origin is
    // permitted at all.
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
    // Next 16 allows only [75] by default; the gallery uses 75, the hero 80.
    qualities: [75, 80],
  },

  async headers() {
    return [
      {
        // The editor. It renders site images, so it keeps the public policy;
        // what it needs on top is to stay out of every index, at the header
        // level rather than relying on a meta tag a crawler may ignore.
        source: "/settings",
        headers: [
          ...sharedHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: publicCsp },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          // Never let a session-bearing page sit in a shared cache.
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        // Everything except /settings. The negative lookahead matters: without
        // it this rule also matches the editor and, being declared second, its
        // headers win — losing the noindex and no-store above.
        source: "/:path((?!settings).*)",
        headers: [
          ...sharedHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: publicCsp },
        ],
      },
    ];
  },
};

export default nextConfig;
