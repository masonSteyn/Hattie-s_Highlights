import type { MetadataRoute } from "next";

import { getAbout, getCategories, getHome, getPhotos } from "@/lib/content";
import { absoluteUrl } from "@/lib/site-url";

/**
 * sitemap.xml, including image entries.
 *
 * The image extension matters more here than on a typical site: this is a
 * photographer's portfolio, so Google Images is a real discovery channel rather
 * than an afterthought, and the photographs are otherwise reachable only by
 * rendering a client-side gallery.
 *
 * `lastModified` is build time throughout. That is not a fudge — this site has
 * no content database and no revalidation, so the only way content changes is a
 * publish, and a publish is what triggers the build. Build time and last edit
 * are the same instant to within a couple of minutes.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, allPhotos, home, about] = await Promise.all([
    getCategories(),
    getPhotos(),
    getHome(),
    getAbout(),
  ]);

  const lastModified = new Date();

  /**
   * One photo can sit in several categories, and MOCK_PHOTOS clones the library
   * to load-test the grid — both would otherwise put the same file in the
   * sitemap repeatedly. Deduplicating by source path is enough to fix both.
   */
  const imagesFor = (photos: { image: { src: string } }[]) => [
    ...new Set(photos.map((p) => absoluteUrl(p.image.src))),
  ];

  const categoryPages = await Promise.all(
    categories.map(async (category) => ({
      url: absoluteUrl(`/portfolio/${category.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      images: imagesFor(await getPhotos(category.slug)),
    })),
  );

  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
      images: [absoluteUrl(home.hero.src)],
    },
    {
      // Booking sits level with the home page: it is the page the whole site is
      // trying to move people towards.
      url: absoluteUrl("/booking"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/portfolio"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
      images: imagesFor(allPhotos),
    },
    ...categoryPages,
    {
      url: absoluteUrl("/contact"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/about"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.7,
      images: [absoluteUrl(about.portrait.src)],
    },
  ];
}
