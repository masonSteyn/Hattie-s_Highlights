import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortfolioView } from "@/components/PortfolioView";
import { getCategories, getPhotos, getSettings } from "@/lib/content";
import { pageMetadata, placeName } from "@/lib/metadata";

import "../portfolio.css";

/**
 * One static route per CMS category. Adding "Newborn" in the admin adds a
 * filter and a page; nothing here needs to know the category names.
 */
export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata(
  props: PageProps<"/portfolio/[category]">,
): Promise<Metadata> {
  const { category } = await props.params;
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);
  const match = categories.find((c) => c.slug === category);
  if (!match) return {};

  /* "Wedding photography in <city>" is the shape of the query these pages can
     realistically win, so the location goes in here as well as on the home
     page — but only once there is a location to name. */
  const place = placeName(settings.business);
  const subject = `${match.title} photography`;

  /* Lead with the category's own work rather than the site hero, so each
     category shares as a different picture. */
  const [first] = await getPhotos(category);

  return pageMetadata({
    title: match.title,
    description: place
      ? `${subject} in ${place} by ${settings.business.name}.`
      : `${subject} by ${settings.business.name}.`,
    path: `/portfolio/${category}`,
    image: first?.image,
  });
}

export default async function CategoryPage(
  props: PageProps<"/portfolio/[category]">,
) {
  const { category } = await props.params;
  const exists = (await getCategories()).some((c) => c.slug === category);
  if (!exists) notFound();

  return <PortfolioView category={category} />;
}
