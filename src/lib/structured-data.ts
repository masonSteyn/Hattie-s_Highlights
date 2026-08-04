import type { SessionType, SiteSettings } from "./types";
import { absoluteUrl, isSpecificUrl, siteUrl } from "./site-url";

/**
 * schema.org markup for the business.
 *
 * The governing rule here is that **every field is omitted unless it holds real
 * data Hattie has entered**. The content store ships with `city`, `region`,
 * `serviceArea`, and `phone` empty, and with a Facebook link that is still the
 * bare `https://facebook.com/`. Structured data is a set of machine-readable
 * claims about a real business; filling those gaps with plausible guesses would
 * put false claims in front of Google under Hattie's name. So the builder emits
 * a smaller, true graph today and a richer one the moment the editor's "Your
 * details" tab is filled in — with no code change needed.
 */

type Json = Record<string, unknown>;

/** Drops keys whose values are empty, so no blank fields reach the output. */
function compact(input: Json): Json {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value == null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value as Json).length > 0;
      return true;
    }),
  );
}

/**
 * Returns `{}` — not a bare `{"@type": "PostalAddress"}` — when neither field is
 * filled in. The `@type` key alone is enough to make the object look non-empty
 * to `compact`, so it is only added once there is something to describe.
 */
function postalAddress(business: SiteSettings["business"]): Json {
  const fields = compact({
    addressLocality: business.city,
    addressRegion: business.region,
  });

  if (Object.keys(fields).length === 0) return {};
  return { "@type": "PostalAddress", ...fields };
}

/**
 * Session types become `Offer` nodes. `startingPrice` is a floor rather than a
 * fixed fee, which is exactly what schema.org's `minPrice` means — using
 * `price` would advertise a fixed rate the business does not offer.
 */
function offers(sessionTypes: SessionType[]): Json[] {
  return sessionTypes.map((session) =>
    compact({
      "@type": "Offer",
      name: session.title,
      description: session.description,
      priceSpecification: compact({
        "@type": "PriceSpecification",
        minPrice: session.startingPrice,
        priceCurrency: "USD",
        valueAddedTaxIncluded: false,
      }),
    }),
  );
}

/** "$300 – $2,500", derived from real session prices, or omitted when there are none. */
function priceRange(sessionTypes: SessionType[]): string {
  const prices = sessionTypes
    .map((s) => s.startingPrice)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return "";

  const format = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? `From ${format(low)}` : `${format(low)} – ${format(high)}`;
}

export function buildBusinessSchema({
  settings,
  sessionTypes,
  description,
  heroSrc,
}: {
  settings: SiteSettings;
  sessionTypes: SessionType[];
  description: string;
  heroSrc: string;
}): Json {
  const { business } = settings;
  const address = postalAddress(business);

  return compact({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    // A stable identifier, so anything else on the site can point at this node
    // rather than describing the business a second time.
    "@id": `${siteUrl}/#business`,
    name: business.name,
    url: siteUrl,
    image: absoluteUrl(heroSrc),
    description,
    email: business.email,
    telephone: business.phone,
    address,
    areaServed: business.serviceArea,
    priceRange: priceRange(sessionTypes),
    makesOffer: offers(sessionTypes),
    // Placeholder socials — a provider homepage with nothing after the slash —
    // are dropped rather than published as identity claims.
    sameAs: business.social.map((s) => s.href).filter(isSpecificUrl),
  });
}

/**
 * Serialises for embedding in a `<script type="application/ld+json">`.
 *
 * `<` is escaped because content here is Hattie's free text: a stray `</script>`
 * inside a caption would otherwise close the block early and turn the rest of
 * her copy into markup. The escape is invisible to JSON parsers.
 */
export function serializeJsonLd(schema: Json): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}
