import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getAbout } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

import "./about.css";

/* Her portrait is the right social card for this page, not the hero. */
export async function generateMetadata(): Promise<Metadata> {
  const about = await getAbout();

  return pageMetadata({
    title: "About",
    description:
      "Hattie photographs weddings, portraits, and events — mostly outdoors, mostly late in the day.",
    path: "/about",
    image: about.portrait,
  });
}

export default async function AboutPage() {
  const about = await getAbout();

  return (
    <article className="about">
      <div className="aboutGrid">
        {/* The portrait leads and stays large. It is the only image on the page,
            so it carries it. */}
        <div className="aboutPortrait">
          <Image
            src={about.portrait.src}
            alt={about.portrait.alt}
            width={about.portrait.width}
            height={about.portrait.height}
            placeholder="blur"
            blurDataURL={about.portrait.lqip}
            priority
            sizes="(max-width: 899px) 100vw, 42vw"
          />
        </div>

        <div className="aboutCopy">
          <p className="eyebrow">Who you would be working with</p>
          <h1 className="display aboutTitle">{about.heading}</h1>

          {about.body.map((paragraph, i) => (
            <p key={i} className="aboutParagraph">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      {/* The one pull-quote this page is allowed. Script, set large enough to
          read, and short enough not to become an endurance test. */}
      <figure className="pullQuote">
        <blockquote className="script pullQuoteText">{about.pullQuote}</blockquote>
      </figure>

      <div className="aboutClose">
        <p className="lede">
          If that sounds like the right fit, the calendar is the fastest way in.
        </p>
        <Link href="/booking" className="btn btnBooking">
          Book a session
        </Link>
      </div>
    </article>
  );
}
