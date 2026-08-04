import type { Metadata } from "next";
import { Instrument_Serif, Inter, Petit_Formal_Script } from "next/font/google";

import { AvailabilityBanner } from "@/components/AvailabilityBanner";
import { LogoBand } from "@/components/LogoBand";
import { Sidebar } from "@/components/Sidebar";
import { getSettings } from "@/lib/content";

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

export const metadata: Metadata = {
  title: {
    default: "Hattie's Highlights",
    template: "%s · Hattie's Highlights",
  },
  description:
    "Portrait, wedding, and event photography. Natural light, unhurried sessions.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();

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
      </body>
    </html>
  );
}
