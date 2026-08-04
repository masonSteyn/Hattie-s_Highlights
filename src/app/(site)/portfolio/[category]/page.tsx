import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortfolioView } from "@/components/PortfolioView";
import { getCategories } from "@/lib/content";

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
  const match = (await getCategories()).find((c) => c.slug === category);
  if (!match) return {};

  return {
    title: match.title,
    description: `${match.title} photography by Hattie's Highlights.`,
  };
}

export default async function CategoryPage(
  props: PageProps<"/portfolio/[category]">,
) {
  const { category } = await props.params;
  const exists = (await getCategories()).some((c) => c.slug === category);
  if (!exists) notFound();

  return <PortfolioView category={category} />;
}
