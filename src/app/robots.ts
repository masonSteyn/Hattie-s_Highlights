import type { MetadataRoute } from "next";

import { absoluteUrl, siteUrl } from "@/lib/site-url";

/**
 * robots.txt.
 *
 * Note what is deliberately absent: there is no `Disallow: /settings`.
 *
 * That looks like an oversight and is not. The editor is already excluded by
 * `X-Robots-Tag: noindex, nofollow, noarchive`, set on the route in
 * next.config.ts — and a crawler can only obey a header it is allowed to fetch.
 * Disallowing the path here would stop Googlebot requesting it, so it would
 * never see the noindex, and a single inbound link would be enough to get the
 * bare URL listed with no snippet. Allowing the crawl is what actually keeps it
 * out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
