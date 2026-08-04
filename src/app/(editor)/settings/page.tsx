import type { Metadata } from "next";

import { authConfig } from "@/lib/auth";
import { getAbout, getCategories, getHome, getPhotos, getSettings } from "@/lib/content";
import { isSignedIn } from "@/lib/session";
import { writeBlockedReason } from "@/sanity/write";

import { Editor } from "./Editor";
import { SignInForm } from "./SignInForm";
import { SetupNotice } from "./SetupNotice";

import "./editor.css";

export const metadata: Metadata = {
  title: "Edit your site",
  // The editor must never be indexed, linked from search, or previewed by a
  // crawler following the ⚙ in the sidebar.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Rendered per request — it reads a session cookie, so it can never be static.
 */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = authConfig();
  if (!config.ready) return <SetupNotice missing={config.missing} />;

  if (!(await isSignedIn())) return <SignInForm />;

  const [settings, home, about, photos, categories] = await Promise.all([
    getSettings(),
    getHome(),
    getAbout(),
    getPhotos(),
    getCategories(),
  ]);

  return (
    <Editor
      settings={settings}
      home={home}
      about={about}
      photos={photos}
      categories={categories}
      readOnlyReason={writeBlockedReason()}
    />
  );
}
