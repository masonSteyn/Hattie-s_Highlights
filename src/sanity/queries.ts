import { defineQuery } from "next-sanity";

/**
 * GROQ.
 *
 * `IMAGE` projects an asset into exactly the shape `ImageAsset` expects: the
 * base CDN url plus real dimensions and the LQIP that Sanity extracts at
 * ingest. Because dimensions come back with the query, every <Image> can
 * reserve its exact space before the file arrives — which is what keeps
 * cumulative layout shift at zero on a page of a hundred photographs.
 */
const IMAGE = /* groq */ `{
  "src": asset->url,
  "width": asset->metadata.dimensions.width,
  "height": asset->metadata.dimensions.height,
  "lqip": asset->metadata.lqip,
  alt
}`;

const SEO = /* groq */ `{
  title,
  description,
  "shareImage": shareImage.asset->url
}`;

export const settingsQuery = defineQuery(`
  *[_type == "siteSettings"][0]{
    availability{ enabled, text },
    "schedulingUrl": schedulingUrl,
    business{
      name, city, region, serviceArea, phone, hours,
      "email": ^.contactEmail,
      social[]{ label, href }
    },
    defaultSeo ${SEO}
  }
`);

export const homeQuery = defineQuery(`
  *[_type == "homePage"][0]{
    hero ${IMAGE},
    headlineBefore, headlineScript, headlineAfter,
    intro, closingHeading, closingBody,
    seo ${SEO}
  }
`);

export const aboutQuery = defineQuery(`
  *[_type == "aboutPage"][0]{
    portrait ${IMAGE},
    heading, body, pullQuote,
    seo ${SEO}
  }
`);

export const bookingQuery = defineQuery(`
  *[_type == "bookingPage"][0]{ heading, intro, fallbackNote, seo ${SEO} }
`);

export const contactQuery = defineQuery(`
  *[_type == "contactPage"][0]{
    heading, intro, autoResponseSubject, autoResponseBody, seo ${SEO}
  }
`);

export const categoriesQuery = defineQuery(`
  *[_type == "category"] | order(orderRank){
    _id, title, "slug": slug.current, "order": orderRank
  }
`);

export const sessionTypesQuery = defineQuery(`
  *[_type == "sessionType"] | order(orderRank){
    _id, title, description, startingPrice, "order": orderRank
  }
`);

export const featuredPhotosQuery = defineQuery(`
  *[_type == "photo" && featured == true] | order(orderRank) [0...$limit]{
    _id,
    image ${IMAGE},
    "categories": categories[]->slug.current,
    featured,
    "order": orderRank,
    caption
  }
`);

/**
 * One query for both the "all" view and a filtered one: when $category is null
 * the category clause is skipped entirely, so there is no second query to keep
 * in step with this one.
 */
export const photosQuery = defineQuery(`
  *[_type == "photo" && (!defined($category) || $category in categories[]->slug.current)]
  | order(orderRank){
    _id,
    image ${IMAGE},
    "categories": categories[]->slug.current,
    featured,
    "order": orderRank,
    caption
  }
`);

export const legalPageQuery = defineQuery(`
  *[_type == "legalPage" && slug.current == $slug][0]{
    title, body, updatedAt, "slug": slug.current
  }
`);

export const legalSlugsQuery = defineQuery(`
  *[_type == "legalPage" && defined(slug.current)]{ "slug": slug.current }
`);
