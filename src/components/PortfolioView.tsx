import Link from "next/link";

import { Gallery } from "@/components/Gallery";
import { getCategories, getPhotos } from "@/lib/content";

/**
 * Shared by /portfolio and /portfolio/[category]. Both are statically
 * generated, so filtering costs a prefetched navigation rather than a
 * client-side re-render of a hundred image nodes.
 */
export async function PortfolioView({ category }: { category?: string }) {
  const [categories, photos] = await Promise.all([
    getCategories(),
    getPhotos(category),
  ]);

  const active = categories.find((c) => c.slug === category);

  return (
    <>
      <header className="pageHead">
        <p className="eyebrow">Selected work</p>
        <h1 className="display pageTitle">{active ? active.title : "Portfolio"}</h1>

        <nav className="filter" aria-label="Filter by category">
          <Link
            href="/portfolio"
            className="filterLink"
            aria-current={category ? undefined : "page"}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c._id}
              href={`/portfolio/${c.slug}`}
              className="filterLink"
              aria-current={c.slug === category ? "page" : undefined}
            >
              {c.title}
            </Link>
          ))}
        </nav>

        <p className="count" role="status">
          {photos.length} {photos.length === 1 ? "photograph" : "photographs"}
        </p>
      </header>

      {photos.length > 0 ? (
        <Gallery photos={photos} />
      ) : (
        <p className="empty">
          Nothing in this category yet — try another, or{" "}
          <Link href="/portfolio">see everything</Link>.
        </p>
      )}
    </>
  );
}
