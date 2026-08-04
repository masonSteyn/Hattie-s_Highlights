"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authConfig } from "@/lib/auth";
import type { SiteContent } from "@/lib/content";
import {
  createBlob,
  publishBlockedReason,
  publishConfigured,
  publishFiles,
  type GitBlobRef,
  type GitFile,
} from "@/lib/github";
import { prepareUpload } from "@/lib/image-metadata";
import { resolveSchedulingEmbed } from "@/lib/scheduling";
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

/* ── Staging one photo ───────────────────────────────────────────────────── */

export type StagedPhoto = {
  path: string;
  sha: string;
  width: number;
  height: number;
  lqip: string;
  /** A small JPEG the editor can show, and keep in localStorage, until the
   *  real file is live. Full-size data URLs would blow the storage quota. */
  preview: string;
};

export type StageResult = { ok: true; photo: StagedPhoto } | { ok: false; message: string };

/**
 * Handles a single photo: validate, strip, upload as a git blob, describe.
 *
 * One photo per request on purpose. A Server Action body is capped at 1MB by
 * Next and 4.5MB by Vercel, and a camera export is ~19MB once base64-encoded —
 * so batching them into the publish call failed before any of this code ran,
 * surfacing only as "a server error occurred". Sending them one at a time
 * removes the ceiling and gives real per-file progress into the bargain.
 *
 * Nothing is committed here. A blob with no tree pointing at it is invisible
 * and eventually collected, so abandoning a draft leaves no trace.
 */
export async function stagePhoto(formData: FormData): Promise<StageResult> {
  if (!(await isSignedIn())) {
    return { ok: false, message: "Your session has expired. Please sign in again." };
  }
  if (!publishConfigured()) {
    return { ok: false, message: publishBlockedReason() ?? "Publishing is not available." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "That file did not arrive. Try again." };
  }

  const prepared = prepareUpload(new Uint8Array(await file.arrayBuffer()));
  if (!prepared.ok) return { ok: false, message: `${file.name}: ${prepared.reason}` };

  const sharp = (await import("sharp")).default;
  const buffer = Buffer.from(prepared.bytes);

  const [lqipBuffer, previewBuffer] = await Promise.all([
    sharp(buffer).resize(20, 20, { fit: "inside" }).jpeg({ quality: 40 }).toBuffer(),
    sharp(buffer).resize(400, 400, { fit: "inside" }).jpeg({ quality: 60 }).toBuffer(),
  ]);

  const uploaded = await createBlob(prepared.bytes);
  if (!uploaded.ok) return { ok: false, message: uploaded.error };

  const safeName =
    file.name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "photo";
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const ext = prepared.format === "jpeg" ? "jpg" : prepared.format;

  return {
    ok: true,
    photo: {
      path: `public/photos/${safeName}-${stamp}.${ext}`,
      sha: uploaded.sha,
      width: prepared.width,
      height: prepared.height,
      lqip: `data:image/jpeg;base64,${lqipBuffer.toString("base64")}`,
      preview: `data:image/jpeg;base64,${previewBuffer.toString("base64")}`,
    },
  };
}

/* ── Publishing ──────────────────────────────────────────────────────────── */

/** Sent by the editor: the content store, plus references to already-uploaded
 *  photos. Deliberately text-only — no image bytes cross this boundary. */
type Draft = { content: SiteContent; blobs: GitBlobRef[] };

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

  // Paths are decided server-side in stagePhoto, but the reference list arrives
  // from the browser — so re-check it rather than trusting it to write wherever
  // it likes in the repository.
  for (const blob of draft.blobs ?? []) {
    if (!/^public\/photos\/[a-z0-9-]+\.(jpg|png|webp)$/.test(blob.path)) {
      return NO("One of those photos has an unexpected name. Please reload and try again.");
    }
    if (!/^[0-9a-f]{40}$/.test(blob.sha)) {
      return NO("One of those photos did not upload cleanly. Please reload and try again.");
    }
  }

  /* Business details have consequences beyond the page they appear on, so they
     are checked here rather than trusted from the browser. Each failure names
     the field and says what is wrong with it — these are rare edits made by
     someone who will not try twice. */

  const business = draft.content.settings.business;

  // Every contact-form enquiry is sent here. A typo means they vanish.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(business.email.trim())) {
    return NO(`"${business.email}" does not look like an email address. Enquiries would not reach you.`);
  }

  // The scheduling URL ends up as an iframe source, so it is held to the same
  // allowlist the Booking page checks before rendering it.
  const scheduling = resolveSchedulingEmbed(draft.content.settings.schedulingUrl);
  if (!scheduling.ok) {
    return NO(`Booking calendar link: ${scheduling.reason}`);
  }

  for (const link of business.social) {
    const href = link.href.trim();
    if (href && !/^https:\/\//.test(href)) {
      return NO(`The ${link.label} link needs to start with https://`);
    }
  }

  // Positions are renumbered from the order shown in the editor.
  draft.content.photos.forEach((photo, index) => (photo.order = index));

  // `preview` is a thumbnail the editor shows while a photo is staged. It has
  // no business in the committed store — left in, every photo would carry a
  // redundant base64 blob for the life of the repository.
  const stripPreview = (img: { preview?: string }) => {
    delete img.preview;
  };
  draft.content.photos.forEach((photo) => stripPreview(photo.image));
  stripPreview(draft.content.home.hero);
  stripPreview(draft.content.about.portrait);

  const files: GitFile[] = [
    {
      path: "content/site.json",
      content: `${JSON.stringify(draft.content, null, 2)}\n`,
      encoding: "utf-8",
    },
  ];

  const count = draft.blobs?.length ?? 0;
  const summary =
    count > 0
      ? `Update site content and add ${count} photo${count === 1 ? "" : "s"}`
      : "Update site content";

  const result = await publishFiles(
    files,
    `${summary}\n\nPublished from the editor.`,
    draft.blobs ?? [],
  );

  if (!result.ok) return NO(result.error);

  return OK(
    `Published as ${result.sha}. The site rebuilds automatically — give it a minute or two.`,
    result.url,
  );
}
