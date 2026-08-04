import type { Metadata } from "next";

import { authConfig } from "@/lib/auth";
import { getSiteContent } from "@/lib/content";
import { publishBlockedReason, publishConfigured } from "@/lib/github";
import { isSignedIn } from "@/lib/session";

import { Editor } from "./Editor";
import { SignInForm } from "./SignInForm";
import { SetupNotice } from "./SetupNotice";

import "./editor.css";

export const metadata: Metadata = {
  title: "Edit your site",
  robots: { index: false, follow: false, nocache: true },
};

/** Reads a session cookie, so it can never be static. */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = authConfig();
  if (!config.ready) return <SetupNotice missing={config.missing} />;
  if (!(await isSignedIn())) return <SignInForm />;

  return (
    <Editor
      published={getSiteContent()}
      publishReady={publishConfigured()}
      publishReason={publishBlockedReason()}
    />
  );
}
