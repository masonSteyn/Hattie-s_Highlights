import type { Metadata } from "next";

import { getHome, getSettings } from "./content";
import { absoluteUrl } from "./site-url";
import type { ImageAsset } from "./types";

/**
 * Per-page metadata, built in one place.
 *
 * This exists because of two Next metadata rules that interact badly and fail
 * silently — nothing errors, the share cards are just wrong:
 *
 *  1. `openGraph` is inherited wholesale, and `title` does NOT flow into
 *     `og:title`. A page that sets only `title` keeps the *layout's* og:title,
 *     so every page would share as "Hattie's Highlights".
 *  2. A page that sets `openGraph` at all **replaces** the parent's entire
 *     object rather than merging into it — so it also has to re-supply the
 *     image, or the card loses its picture.
 *
 * Doing this by hand on six pages means six chances to get it wrong. Calling
 * one function means the canonical URL, the og:title, and the image cannot drift
 * apart from the page's real title.
 */

/** "Boulder, Colorado" when both are filled in, either one alone, or "". */
export function placeName(business: { city: string; region: string }): string {
  return [business.city, business.region]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(", ");
}

/** The site-wide description, named location included once there is one. */
export function siteDescription(place: string): string {
  return place
    ? `Portrait, wedding, and event photography in ${place}. Natural light, unhurried sessions.`
    : "Portrait, wedding, and event photography. Natural light, unhurried sessions.";
}

type PageMetadataOptions = {
  /** Page title without the site suffix. Omit on the home page, which uses the
   *  layout's default title rather than templating one. */
  title?: string;
  /** Omit to inherit the site-wide description. */
  description?: string;
  /** Site-relative path, used for the canonical URL and og:url. */
  path: string;
  /** Social card image. Falls back to the home hero. */
  image?: ImageAsset;
};

export async function pageMetadata({
  title,
  description: explicitDescription,
  path,
  image,
}: PageMetadataOptions): Promise<Metadata> {
  const [settings, home] = await Promise.all([getSettings(), getHome()]);
  const siteName = settings.business.name;
  const card = image ?? home.hero;
  const description =
    explicitDescription ?? siteDescription(placeName(settings.business));

  /* Open Graph has no title template, so the suffix that `title.template` adds
     to the <title> tag has to be applied by hand here. */
  const socialTitle = title ? `${title} · ${siteName}` : siteName;

  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName,
      locale: "en_US",
      url: absoluteUrl(path),
      title: socialTitle,
      description,
      images: [
        {
          url: absoluteUrl(card.src),
          width: card.width,
          height: card.height,
          alt: card.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [absoluteUrl(card.src)],
    },
  };
}
