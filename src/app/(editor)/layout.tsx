import { Instrument_Serif, Inter } from "next/font/google";

import "../globals.css";
import "./editor-base.css";

/**
 * Root layout for the editor.
 *
 * Its own <html>: this is a tool, not a page of the site, and it should not
 * inherit the sidebar, the availability banner, or the logo band.
 * It does keep the site's typefaces and colours, so it feels like the same
 * place rather than like a different piece of software.
 */
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata = {
  title: "Edit your site",
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function EditorRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
