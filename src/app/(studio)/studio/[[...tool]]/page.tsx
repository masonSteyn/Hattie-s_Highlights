import type { Metadata, Viewport } from "next";

import { isSanityConfigured } from "../../../../../sanity/env";
import { Studio } from "./Studio";

/**
 * The Studio, served from this same deployment at /studio.
 *
 * Authentication is Sanity's own: the user signs in with Google (or whichever
 * providers the project allows) against Sanity, not against anything written
 * here. There is no password to store, no session to expire, and no reset flow
 * that could leak whether an account exists — which was the whole argument for
 * a hosted CMS rather than a custom admin.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Hattie's Highlights — admin",
  // The admin has no business in search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // The Studio manages its own scrolling; this keeps the editor usable on a
  // phone, which is where a lot of photos will be added from.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function StudioPage() {
  // Without a project id the Studio cannot mount at all. Showing the setup
  // steps beats a 500 for whoever opens this before the project exists.
  if (!isSanityConfigured) return <StudioSetupNotice />;
  return <Studio />;
}

function StudioSetupNotice() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: "42rem",
        margin: "0 auto",
        padding: "4rem 1.5rem",
        lineHeight: 1.7,
        color: "#2b2724",
        background: "#fff7e6",
        minHeight: "100vh",
      }}
    >
      <p
        style={{
          fontSize: "0.6875rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          opacity: 0.6,
        }}
      >
        Admin — not set up yet
      </p>
      <h1 style={{ fontSize: "2rem", fontWeight: 400, margin: "0.75rem 0 1.5rem" }}>
        Connect a Sanity project
      </h1>
      <p>
        The site is running on the sample photos and copy bundled with the repo. To switch it to the
        real content manager:
      </p>
      <ol style={{ paddingLeft: "1.25rem", margin: "1.5rem 0" }}>
        <li>
          Run <code>npx sanity@latest init</code> and choose the default dataset configuration.
        </li>
        <li>
          Copy <code>.env.example</code> to <code>.env.local</code> and paste the project id into{" "}
          <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code>.
        </li>
        <li>Restart the dev server and reload this page.</li>
      </ol>
      <p style={{ opacity: 0.75, fontSize: "0.9375rem" }}>
        Nothing else needs changing — the site reads from Sanity as soon as a project id is present,
        and falls back to the bundled content for anything not yet created there.
      </p>
    </main>
  );
}
