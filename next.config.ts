import type { NextConfig } from "next";

/**
 * The scheduling allowlist, spelled out here rather than imported.
 *
 * Next compiles this file to next.config.compiled.js and requires that, in a
 * context where neither a relative `.ts` nor a relative `.json` import
 * resolves, and where process.cwd() is not guaranteed to be the project root.
 * Any of those makes `next dev` fail to load its own config. So the list is
 * duplicated from scheduling-providers.json — which is what the app and the
 * Studio validator read — and `npm run check:providers` fails if the two ever
 * drift apart.
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
const sanityApi = "https://*.api.sanity.io https://*.apicdn.sanity.io";

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
 * The Studio needs a looser policy than the public site, so it gets its own
 * header block instead of loosening the policy for every visitor.
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
  `img-src 'self' blob: data: https://cdn.sanity.io`,
  `connect-src 'self' ${analyticsOrigin} ${sanityApi}`,
  `frame-src ${schedulerOrigins.join(" ")}`,
  `media-src 'self'`,
  `manifest-src 'self'`,
  `upgrade-insecure-requests`,
].join("; ");

const studioCsp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  // The Studio compiles schema definitions in the browser.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://core.sanity-cdn.com`,
  `style-src 'self' 'unsafe-inline'`,
  // The Studio's design system serves its own webfonts from this host.
  `font-src 'self' data: https://design-system-static.sanity.io`,
  `img-src 'self' blob: data: https://cdn.sanity.io https://*.sanity.io`,
  `connect-src 'self' ${sanityApi} https://*.sanity.io wss://*.api.sanity.io https://core.sanity-cdn.com https://design-system-static.sanity.io`,
  `frame-src 'self' https://*.sanity.io`,
  `worker-src 'self' blob:`,
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

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, a stray lockfile in a parent folder
  // makes Turbopack infer that folder as the root and quietly resolve modules
  // from the wrong tree.
  turbopack: { root: process.cwd() },

  images: {
    // Sanity's CDN is the only remote origin images may be optimised from.
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io", pathname: "/images/**" }],
    formats: ["image/avif", "image/webp"],
    // Next 16 allows only [75] by default; the gallery uses 75, the hero 80.
    qualities: [75, 80],
  },

  async headers() {
    return [
      {
        source: "/studio/:path*",
        headers: [
          ...sharedHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: studioCsp },
          // Belt and braces: the admin must never be indexed.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
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
        // Everything except /studio. Without the negative lookahead this rule
        // also matches the Studio and, since it is declared second, its CSP
        // wins — which silently breaks the editor.
        source: "/:path((?!studio|settings).*)",
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
