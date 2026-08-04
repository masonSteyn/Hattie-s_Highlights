"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";

import { authConfig } from "@/lib/auth";
import { prepareUpload } from "@/lib/image-metadata";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { endSession, isSignedIn, startSession } from "@/lib/session";
import { getPhotos } from "@/lib/content";
import {
  createPhoto,
  deleteDocument,
  imageField,
  patchDocument,
  rankBetween,
  uploadImageAsset,
  writeBlockedReason,
  writeEnabled,
} from "@/sanity/write";

export type Result = { ok: boolean; message?: string };

const OK = (message?: string): Result => ({ ok: true, message });
const NO = (message: string): Result => ({ ok: false, message });

/**
 * Every mutating action starts here.
 *
 * One gate, one place to audit. An action that forgets to call this is a hole,
 * so the rule is that nothing in this file touches `@/sanity/write` before
 * `await guard()` has returned null.
 */
async function guard(): Promise<Result | null> {
  if (!(await isSignedIn())) return NO("Your session has expired. Please sign in again.");
  if (!writeEnabled()) return NO(writeBlockedReason() ?? "Saving is unavailable.");
  return null;
}

/** Refresh every page that reads photos or settings. */
function refreshContent() {
  for (const tag of ["photo", "home", "about", "settings"]) updateTag(tag);
}

/* ── Signing in ──────────────────────────────────────────────────────────── */

export async function signIn(_prev: Result, formData: FormData): Promise<Result> {
  const config = authConfig();
  if (!config.ready) {
    return NO(`The editor is not set up yet. Missing: ${config.missing.join(", ")}.`);
  }

  // Rate limited by IP. Combined with a ~50ms hash, this puts online guessing
  // far out of reach; it is the main defence, since there is no lockout to
  // trigger and no account to lock.
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown";

  const limit = await rateLimit(`login:${ip}`, "login");
  if (!limit.ok) {
    return NO("Too many attempts. Wait a few minutes and try again.");
  }

  const password = String(formData.get("password") ?? "");
  const valid = await verifyPassword(password, process.env.EDITOR_PASSWORD_HASH!);

  if (!valid) {
    // Deliberately vague, and identical for an empty password, a wrong one, and
    // a malformed stored hash.
    return NO("That password is not right.");
  }

  if (!(await startSession())) return NO("Could not start a session. Check EDITOR_SESSION_SECRET.");

  // Setting the cookie is not enough on its own: the page that rendered the
  // form is a server component that has already run, so without navigating,
  // the session exists but the login form stays on screen. Redirecting re-runs
  // the page, which now sees the cookie.
  redirect("/settings");
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/settings");
}

/* ── Text ────────────────────────────────────────────────────────────────── */

export async function saveAvailability(_prev: Result, formData: FormData): Promise<Result> {
  const blocked = await guard();
  if (blocked) return blocked;

  const enabled = formData.get("enabled") === "on";
  const text = String(formData.get("text") ?? "").trim().slice(0, 90);

  if (enabled && !text) return NO("Add some words, or switch the banner off.");

  await patchDocument("siteSettings", { availability: { enabled, text } });
  refreshContent();
  return OK(enabled ? "Banner is showing." : "Banner is hidden.");
}

export async function saveHomeText(_prev: Result, formData: FormData): Promise<Result> {
  const blocked = await guard();
  if (blocked) return blocked;

  const headlineScript = String(formData.get("headlineScript") ?? "").trim();
  if (headlineScript.split(/\s+/).filter(Boolean).length > 2) {
    return NO("Keep the handwritten word to one or two — longer runs are hard to read.");
  }

  await patchDocument("homePage", {
    headlineBefore: String(formData.get("headlineBefore") ?? "").trim().slice(0, 60),
    headlineScript: headlineScript.slice(0, 18),
    headlineAfter: String(formData.get("headlineAfter") ?? "").trim().slice(0, 60),
    intro: String(formData.get("intro") ?? "").trim().slice(0, 280),
    closingHeading: String(formData.get("closingHeading") ?? "").trim().slice(0, 80),
    closingBody: String(formData.get("closingBody") ?? "").trim().slice(0, 280),
  });
  refreshContent();
  return OK("Home page saved.");
}

export async function saveAboutText(_prev: Result, formData: FormData): Promise<Result> {
  const blocked = await guard();
  if (blocked) return blocked;

  // One textarea, blank lines between paragraphs — much easier to work with on
  // a phone than an array of separate boxes.
  const body = String(formData.get("body") ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (body.length === 0) return NO("The About page needs at least one paragraph.");

  await patchDocument("aboutPage", {
    heading: String(formData.get("heading") ?? "").trim().slice(0, 60) || "About",
    body,
    pullQuote: String(formData.get("pullQuote") ?? "").trim().slice(0, 60),
  });
  refreshContent();
  return OK("About page saved.");
}

/* ── Photos ──────────────────────────────────────────────────────────────── */

/**
 * Validates and strips metadata on the server, before anything reaches storage.
 *
 * Doing it here rather than in the browser makes it unbypassable: it does not
 * matter what a client sends, because the bytes that get stored are the ones
 * this function produced.
 */
async function scrub(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const prepared = prepareUpload(bytes);
  if (!prepared.ok) return { ok: false as const, reason: `${file.name}: ${prepared.reason}` };
  return { ok: true as const, prepared };
}

export async function uploadPhotos(_prev: Result, formData: FormData): Promise<Result> {
  const blocked = await guard();
  if (blocked) return blocked;

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return NO("Choose at least one photo.");

  const category = String(formData.get("category") ?? "").trim();
  if (!category) return NO("Pick a category.");

  const alt = String(formData.get("alt") ?? "").trim();
  if (alt.length < 8) {
    return NO("Describe the photo in a few words — screen readers and Google both use it.");
  }

  const existing = await getPhotos();
  let rank = rankBetween(
    existing.length ? String(existing[existing.length - 1].order) : undefined,
    undefined,
  );

  const failures: string[] = [];
  let saved = 0;

  for (const file of files) {
    const result = await scrub(file);
    if (!result.ok) {
      failures.push(result.reason);
      continue;
    }

    const { prepared } = result;
    const assetId = await uploadImageAsset(
      prepared.bytes,
      file.name,
      `image/${prepared.format}`,
    );
    await createPhoto({
      image: imageField(assetId, alt),
      categories: [category],
      featured: false,
      orderRank: rank,
    });
    rank = rankBetween(rank, undefined);
    saved += 1;
  }

  refreshContent();

  if (saved === 0) return NO(failures.join(" · "));
  const noun = `${saved} photo${saved === 1 ? "" : "s"}`;
  return failures.length
    ? OK(`Added ${noun}. Skipped: ${failures.join(" · ")}`)
    : OK(`Added ${noun}.`);
}

export async function replaceImage(_prev: Result, formData: FormData): Promise<Result> {
  const blocked = await guard();
  if (blocked) return blocked;

  const documentId = String(formData.get("documentId") ?? "");
  const fieldName = String(formData.get("fieldName") ?? "");
  if (!["homePage", "aboutPage"].includes(documentId)) return NO("Unknown page.");
  if (!["hero", "portrait"].includes(fieldName)) return NO("Unknown image.");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return NO("Choose a photo first.");

  const alt = String(formData.get("alt") ?? "").trim();
  if (alt.length < 8) return NO("Describe the photo in a few words.");

  const result = await scrub(file);
  if (!result.ok) return NO(result.reason);

  const assetId = await uploadImageAsset(
    result.prepared.bytes,
    file.name,
    `image/${result.prepared.format}`,
  );
  await patchDocument(documentId, { [fieldName]: imageField(assetId, alt) });
  refreshContent();
  return OK("Photo swapped.");
}

export async function setFeatured(_prev: Result, formData: FormData): Promise<Result> {
  const blocked = await guard();
  if (blocked) return blocked;

  const id = String(formData.get("id") ?? "");
  if (!id) return NO("Missing photo.");

  await patchDocument(id, { featured: formData.get("featured") === "true" });
  refreshContent();
  return OK();
}

export async function saveAltText(_prev: Result, formData: FormData): Promise<Result> {
  const blocked = await guard();
  if (blocked) return blocked;

  const id = String(formData.get("id") ?? "");
  const alt = String(formData.get("alt") ?? "").trim();
  if (!id) return NO("Missing photo.");
  if (alt.length < 8) return NO("A few more words, please.");

  await patchDocument(id, { "image.alt": alt });
  refreshContent();
  return OK("Description saved.");
}

export async function deletePhoto(_prev: Result, formData: FormData): Promise<Result> {
  const blocked = await guard();
  if (blocked) return blocked;

  const id = String(formData.get("id") ?? "");
  // Typing DELETE is the only irreversible confirmation in the editor, and it
  // is here because Sanity has no undo that Hattie could reach on her own.
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return NO('Type DELETE to confirm.');
  }
  if (!id) return NO("Missing photo.");

  await deleteDocument(id);
  refreshContent();
  return OK("Photo deleted.");
}

export async function movePhoto(_prev: Result, formData: FormData): Promise<Result> {
  const blocked = await guard();
  if (blocked) return blocked;

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !["up", "down"].includes(direction)) return NO("Could not move that.");

  const photos = await getPhotos();
  const index = photos.findIndex((p) => p._id === id);
  if (index === -1) return NO("Could not find that photo.");

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= photos.length) return OK();

  // Slot between the neighbour being passed and the one beyond it.
  const beyond = direction === "up" ? target - 1 : target + 1;
  const [lo, hi] =
    direction === "up"
      ? [photos[beyond] ? String(photos[beyond].order) : undefined, String(photos[target].order)]
      : [String(photos[target].order), photos[beyond] ? String(photos[beyond].order) : undefined];

  await patchDocument(id, { orderRank: rankBetween(lo, hi) });
  refreshContent();
  return OK();
}
