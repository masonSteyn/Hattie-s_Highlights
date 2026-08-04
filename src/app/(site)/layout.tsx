import type { Metadata } from "next";
import { Instrument_Serif, Inter, Petit_Formal_Script } from "next/font/google";

import { AvailabilityBanner } from "@/components/AvailabilityBanner";
import { LogoBand } from "@/components/LogoBand";
import { Sidebar } from "@/components/Sidebar";
import { getHome, getSessionTypes, getSettings } from "@/lib/content";
import { placeName, siteDescription } from "@/lib/metadata";
import { siteUrl } from "@/lib/site-url";
import { buildBusinessSchema, serializeJsonLd } from "@/lib/structured-data";

import "../globals.css";
import "../shell.css";
import "../ui.css";

/* ═══════════════════════════════════════════════════════════════════════════
   LAYOUT — logo band above, sidebar beneath it
   ═══════════════════════════════════════════════════════════════════════════

   The brief asks for two things that normally fight: a persistent left sidebar
   and a logo centered at the very top of the viewport. Reconciled by giving the
   logo the full width and letting the sidebar start below it, so the mark is
   unambiguously the first thing the eye lands on and the sidebar reads as
   subordinate navigation rather than a competing column.

   DESKTOP (≥1024px)
   ┌──────────────────────────────────────────────────────────────────────┐
   │                  [availability banner — sage, one line, optional]    │
   ├──────────────────────────────────────────────────────────────────────┤
   │                                                                      │
   │                       ✿ Hattie's Highlights ✿           logo band,   │
   │                             (centered)                   full width, │
   │                                                          148px       │
   ├─────────────────┬────────────────────────────────────────────────────┤
   │                 │                                                    │
   │  SIDEBAR        │  MAIN                                              │
   │  264px          │                                                    │
   │  sticky,        │  Full-bleed sections span from the sidebar's right │
   │  own scroll     │  edge to the viewport edge — no max-width cage.    │
   │                 │                                                    │
   │  Home           │  ┌──────────────────────────────────────────────┐  │
   │  Portfolio      │  │                                              │  │
   │  About          │  │            hero photograph                   │  │
   │  Booking        │  │                                              │  │
   │  Contact        │  └──────────────────────────────────────────────┘  │
   │                 │                                                    │
   │  ·············  │     text sections inset by --gutter                │
   │  IG  FB  Email  │                                                    │
   │                 │                                                    │
   └─────────────────┴────────────────────────────────────────────────────┘
     ↑ hairline right border, sage @ 22%

   MOBILE (<1024px)
   ┌────────────────────────────────┐
   │ [availability banner]          │
   ├────────────────────────────────┤
   │ ☰      ✿ Hattie's ✿            │  sticky bar, 68px. The hamburger is
   ├────────────────────────────────┤  absolutely positioned so the logo stays
   │                                │  optically centred in the viewport.
   │  MAIN — single column          │
   │                                │
   └────────────────────────────────┘
   The panel slides in from the left, covers the screen, traps focus, and closes
   on link tap and on Escape.
   ═══════════════════════════════════════════════════════════════════════════ */

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const script = Petit_Formal_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

/**
 * Site-wide defaults.
 *
 * Generated rather than static so the homepage title can name where Hattie
 * works — "Photographer in <city>" is the single highest-value string on a
 * local service site, and it is the reason `business.city` exists in the store.
 * Until she fills that field in, the title falls back to the plain business
 * name rather than inventing a location.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const { name } = settings.business;
  const place = placeName(settings.business);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: place ? `${name} — Photographer in ${place}` : name,
      template: `%s · ${name}`,
    },
    description: siteDescription(place),
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, sessionTypes, home] = await Promise.all([
    getSettings(),
    getSessionTypes(),
    getHome(),
  ]);

  const businessSchema = buildBusinessSchema({
    settings,
    sessionTypes,
    description: siteDescription(placeName(settings.business)),
    heroSrc: home.hero.src,
  });

  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${script.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>

        <AvailabilityBanner banner={settings.availability} />
        <LogoBand />

        <div className="shell" data-banner={settings.availability.enabled ? "true" : undefined}>
          <Sidebar social={settings.business.social} />
          <main id="main" className="main">
            {children}
          </main>
        </div>

        {/* Last in the body so it cannot come between the skip link and the
            content it skips to. Crawlers read JSON-LD wherever it sits. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(businessSchema) }}
        />
      </body>
    </html>
  );
}
