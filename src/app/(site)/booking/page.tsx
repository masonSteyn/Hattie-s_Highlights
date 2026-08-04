import type { Metadata } from "next";

import { getBooking, getSessionTypes, getSettings } from "@/lib/content";
import { resolveSchedulingEmbed } from "@/lib/scheduling";

import "./booking.css";

export const metadata: Metadata = {
  title: "Booking",
  description:
    "Session types, starting prices, and a calendar — book a call with Hattie's Highlights.",
};

const price = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default async function BookingPage() {
  const [booking, sessionTypes, settings] = await Promise.all([
    getBooking(),
    getSessionTypes(),
    getSettings(),
  ]);

  // The URL comes from the CMS, so it is validated against an allowlist of
  // scheduling hosts before it is ever rendered as an iframe source.
  const embed = resolveSchedulingEmbed(settings.schedulingUrl);

  return (
    <div className="booking">
      <header className="pageHead">
        <p className="eyebrow">What happens next</p>
        <h1 className="display pageTitle">{booking.heading}</h1>
      </header>

      <section className="bookingIntro" aria-labelledby="what-to-expect">
        <h2 id="what-to-expect" className="sr-only">
          What to expect
        </h2>
        {booking.intro.map((paragraph, i) => (
          <p key={i} className="bookingParagraph">
            {paragraph}
          </p>
        ))}
      </section>

      {/* One list, driven by the session-type documents. The same data renders
          the Contact form dropdown, so prices cannot drift between pages. */}
      <section className="sessions" aria-labelledby="session-types">
        <h2 id="session-types" className="eyebrow">
          Session types
        </h2>
        <dl className="sessionList">
          {sessionTypes.map((session) => (
            <div key={session._id} className="session">
              <dt className="sessionName">
                <span className="display sessionTitle">{session.title}</span>
                <span className="sessionPrice">
                  from {price.format(session.startingPrice)}
                </span>
              </dt>
              <dd className="sessionDescription">{session.description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="scheduler" aria-labelledby="pick-a-time">
        <h2 id="pick-a-time" className="eyebrow">
          Pick a time
        </h2>

        {embed.ok ? (
          <div className="schedulerFrame">
            <iframe
              src={embed.url}
              title={`Booking calendar — ${embed.host}`}
              loading="lazy"
              // The scheduler is third-party content: no same-origin access, no
              // top-level navigation, only what it needs to run.
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <p className="schedulerMissing">{embed.reason}</p>
        )}

        {/* Always rendered, not only on failure. An iframe that fails to load
            usually fails silently, so the way out has to be visible before
            anyone discovers they need it. */}
        <p className="fallback">
          {booking.fallbackNote}{" "}
          <a className="fallbackLink" href={`mailto:${settings.business.email}`}>
            {settings.business.email}
          </a>{" "}
          — tell me the date and I will check it by hand.
        </p>
      </section>
    </div>
  );
}
