"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authConfig } from "@/lib/auth";
import { getSiteContent, type SiteContent } from "@/lib/content";
import { publishFiles, publishBlockedReason, publishConfigured, type GitFile } from "@/lib/github";
import { prepareUpload } from "@/lib/image-metadata";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { endSession, isSignedIn, startSession } from "@/lib/session";

export type Result = { ok: boolean; message?: string; url?: string };

const OK = (message?: string, url?: string): Result => ({ ok: true, message, url });
const NO = (message: string): Result => ({ ok: false, message });

/* ── Signing in ──────────────────────────────────────────────────────────── */

export async function signIn(_prev: Result, formData: FormData): Promise<Result> {
  const config = authConfig();
  if (!config.ready) {
    return NO(`The editor is not set up yet. Missing: ${config.missing.join(", ")}.`);
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown";

  const limit = await rateLimit(`login:${ip}`, "login");
  if (!limit.ok) return NO("Too many attempts. Wait a few minutes and try again.");

  if (!(await verifyPassword(String(formData.get("password") ?? ""), process.env.EDITOR_PASSWORD_HASH!))) {
    return NO("That password is not right.");
  }

  if (!(await startSession())) return NO("Could not start a session. Check EDITOR_SESSION_SECRET.");

  // The page that rendered the form is a server component that already ran, so
  // setting the cookie is not enough — navigating re-runs it with the session.
  redirect("/settings");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/settings");
}

/* ── Publishing ──────────────────────────────────────────────────────────── */

/** Sent by the editor: the whole content store, plus any new image bytes. */
type Draft = {
  content: SiteContent;
  /** Files the browser staged but has not uploaded yet, keyed by target path. */
  newImages: { path: string; dataUrl: string }[];
};

const MAX_IMAGES_PER_PUBLISH = 40;

/**
 * Everything Hattie changed since she last published, in one commit.
 *
 * Batching matters for two reasons. Each publish is a Vercel rebuild, so
 * committing per keystroke would mean a rebuild per keystroke. And a single
 * commit is a single thing to revert if she changes her mind.
 */
export async function publish(_prev: Result, formData: FormData): Promise<Result> {
  if (!(await isSignedIn())) return NO("Your session has expired. Please sign in again.");
  if (!publishConfigured()) return NO(publishBlockedReason() ?? "Publishing is not available.");

  let draft: Draft;
  try {
    draft = JSON.parse(String(formData.get("draft") ?? "")) as Draft;
  } catch {
    return NO("Could not read the changes. Please reload and try again.");
  }

  if (!draft?.content?.photos) return NO("Those changes look incomplete. Please reload.");
  if (draft.newImages.length > MAX_IMAGES_PER_PUBLISH) {
    return NO(`That is ${draft.newImages.length} photos at once. Publish up to ${MAX_IMAGES_PER_PUBLISH} at a time.`);
  }

  const files: GitFile[] = [];
  const content = draft.content;

  // ── Images ──────────────────────────────────────────────────────────────
  // Validation and metadata stripping happen here, on the server, so it does
  // not matter what the browser sent: the bytes that get committed are the
  // bytes this produced.
  const sharp = (await import("sharp")).default;

  for (const incoming of draft.newImages) {
    const base64 = incoming.dataUrl.split(",")[1] ?? "";
    const raw = new Uint8Array(Buffer.from(base64, "base64"));

    const prepared = prepareUpload(raw);
    if (!prepared.ok) return NO(`${incoming.path.split("/").pop()}: ${prepared.reason}`);

    // Derive the same metadata the site needs to reserve layout space and show
    // a blur placeholder — the job a CMS would otherwise do at ingest.
    const buffer = Buffer.from(prepared.bytes);
    const lqipBuffer = await sharp(buffer).resize(20, 20, { fit: "inside" }).jpeg({ quality: 40 }).toBuffer();
    const lqip = `data:image/jpeg;base64,${lqipBuffer.toString("base64")}`;

    // Stamp the real values over whatever the browser guessed.
    const apply = (img: { src: string; width: number; height: number; lqip: string }) => {
      if (img.src !== incoming.path.replace(/^public/, "")) return;
      img.width = prepared.width;
      img.height = prepared.height;
      img.lqip = lqip;
    };
    for (const photo of content.photos) apply(photo.image);
    apply(content.home.hero);
    apply(content.about.portrait);

    files.push({
      path: incoming.path,
      content: buffer.toString("base64"),
      encoding: "base64",
    });
  }

  // ── Content ─────────────────────────────────────────────────────────────
  content.photos.forEach((photo, index) => (photo.order = index));

  files.push({
    path: "content/site.json",
    content: `${JSON.stringify(content, null, 2)}\n`,
    encoding: "utf-8",
  });

  const summary =
    draft.newImages.length > 0
      ? `Update site content and add ${draft.newImages.length} photo${draft.newImages.length === 1 ? "" : "s"}`
      : "Update site content";

  const result = await publishFiles(files, `${summary}\n\nPublished from the editor.`);

  if (!result.ok) return NO(result.error);

  return OK(
    `Published ${result.files} file${result.files === 1 ? "" : "s"} as ${result.sha}. ` +
      "The site rebuilds automatically — give it a minute or two.",
    result.url,
  );
}

/** Read-only status for the editor to show before anything is attempted. */
export async function publishStatus(): Promise<{ ready: boolean; reason: string | null }> {
  return { ready: publishConfigured(), reason: publishBlockedReason() };
}

/** The last published state, for the editor to reset a draft back to. */
export async function currentContent(): Promise<SiteContent> {
  return getSiteContent();
}
