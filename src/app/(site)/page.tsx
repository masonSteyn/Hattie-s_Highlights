import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getFeaturedPhotos, getHome } from "@/lib/content";

import "./home.css";

/**
 * Home. Full-bleed hero, one intro line, a starred-work grid, one closing CTA.
 * That is the whole page — no testimonial carousel, no stat counters, no
 * services accordion.
 */
export default async function HomePage() {
  const [home, featured] = await Promise.all([getHome(), getFeaturedPhotos(6)]);
  const [lead, ...rest] = featured;

  return (
    <>
      <section className="hero">
        <Image
          src={home.hero.src}
          alt={home.hero.alt}
          width={home.hero.width}
          height={home.hero.height}
          placeholder="blur"
          blurDataURL={home.hero.lqip}
          priority
          sizes="100vw"
        />
        <div className="heroScrim" aria-hidden="true" />
        <div className="heroContent">
          {/* One h1 per page, describing the page rather than the brand. */}
          <h1 className="display heroHeadline">
            {home.headlineBefore}{" "}
            <span className="script">{home.headlineScript}</span>
            {home.headlineAfter ? ` ${home.headlineAfter}` : null}
          </h1>
          <Link href="/booking" className="btn btnBooking">
            Book a session
            <ArrowRight size={16} strokeWidth={1.25} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="intro">
        <p className="introText">{home.intro}</p>
      </section>

      <section className="work" aria-labelledby="recent-work">
        <div className="workHead">
          <h2 id="recent-work" className="eyebrow">
            Recent work
          </h2>
          <Link href="/portfolio" className="workLink">
            See the full portfolio
          </Link>
        </div>

        {lead ? (
          <div className="lead">
            <Link href="/portfolio" className="frame">
              <Image
                src={lead.image.src}
                alt={lead.image.alt}
                width={lead.image.width}
                height={lead.image.height}
                placeholder="blur"
                blurDataURL={lead.image.lqip}
                // Near the fold on a laptop, so it does not wait for the
                // intersection observer.
                loading="eager"
                sizes="(max-width: 767px) 100vw, 60vw"
              />
            </Link>
            {lead.caption ? <p className="caption">{lead.caption}</p> : null}
          </div>
        ) : null}

        <ul className="masonry">
          {rest.map((photo) => (
            <li key={photo._id} className="cell">
              <Link href="/portfolio" className="frame">
                <Image
                  src={photo.image.src}
                  alt={photo.image.alt}
                  width={photo.image.width}
                  height={photo.image.height}
                  placeholder="blur"
                  blurDataURL={photo.image.lqip}
                  loading="lazy"
                  sizes="(max-width: 767px) 100vw, 34vw"
                />
              </Link>
              {photo.caption ? <p className="caption">{photo.caption}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="closing" aria-labelledby="closing-cta">
        <div className="closingInner">
          <h2 id="closing-cta" className="display closingHeading">
            {home.closingHeading}
          </h2>
          <p className="lede">{home.closingBody}</p>
          <div>
            <Link href="/booking" className="btn">
              Check a date
              <ArrowRight size={16} strokeWidth={1.25} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
