/**
 * Shrinking a photo in the browser, before it is uploaded.
 *
 * Runs in the browser only — it needs a canvas.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * Vercel caps a request body at about 4.5MB and no configuration lifts it, so
 * a camera original — routinely 8MB to 25MB — cannot be sent at all. Without
 * this, the honest answer to "can Hattie upload the photo she just took" is no.
 *
 * ── What it costs ──────────────────────────────────────────────────────────
 *
 * Re-encoding is lossy, so a photo that goes through here is no longer the
 * bytes the camera wrote. That matters, because losslessness is a deliberate
 * property of this project: `stripMetadata` removes EXIF by cutting whole
 * segments out of the container specifically so every pixel byte survives.
 *
 * So this is kept to the files that have no other option:
 *
 *   • Small enough to send, and no rotation to bake in → **untouched**, and the
 *     lossless path still applies exactly as before.
 *   • Too large to send → re-encoded, because the alternative is not uploading.
 *   • Carrying an EXIF rotation → re-encoded, see below.
 *
 * ── The rotation case ──────────────────────────────────────────────────────
 *
 * A camera does not rotate pixels; it records how the body was held in the EXIF
 * `Orientation` tag and leaves the pixels alone. `stripJpeg` drops APP1, which
 * is where that tag lives — so stripping the metadata of a sideways photo
 * silently loses the only record that it was sideways, and it displays rotated.
 *
 * Decoding with `imageOrientation: "from-image"` applies the rotation to the
 * pixels themselves, which both fixes that and makes the tag genuinely
 * redundant. It is the one case where re-encoding is the *more* correct
 * behaviour rather than a compromise.
 */

import { UPLOAD_LIMITS } from "./upload-limits";

/** Long edge to aim for first, then progressively smaller. The largest image
 *  the site ever renders is the 2400px hero, so 3200 leaves headroom for a
 *  high-density display without storing a 24-megapixel original. */
const EDGE_STEPS = [3200, 2560, 2048, 1600, 1200] as const;

/** JPEG quality ladder. 0.85 is visually indistinguishable for photographs;
 *  below about 0.6 it starts to show on skin tones, so it stops there. */
const QUALITY_STEPS = [0.85, 0.78, 0.7, 0.62] as const;

/** Aim under the limit rather than at it, so the multipart envelope cannot
 *  push a file that just fits back over the edge. */
const TARGET_BYTES = Math.floor(UPLOAD_LIMITS.maxBytes * 0.9);

export type Prepared =
  | { kind: "unchanged"; file: File }
  | { kind: "resized"; file: File; fromBytes: number; toBytes: number; width: number; height: number }
  | { kind: "failed"; reason: string };

/* ── EXIF orientation ──────────────────────────────────────────────────────
   Only needed to answer "does this file need re-encoding at all". Applying the
   rotation is the decoder's job, not ours. */

/**
 * Reads the JPEG `Orientation` tag: 1 when upright or absent, 2–8 otherwise.
 *
 * Walks to the APP1 segment, then reads IFD0 out of the TIFF header inside it.
 * Anything unexpected returns 1 — a file we cannot parse is one we should leave
 * alone rather than re-encode on a guess.
 */
export function readJpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1; // not a JPEG

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return 1; // out of step with the markers
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (size < 2) return 1;

    if (marker === 0xe1) {
      const start = offset + 4;
      // "Exif\0\0" — APP1 also carries XMP, which this is not.
      if (
        start + 6 > view.byteLength ||
        view.getUint32(start) !== 0x45786966 ||
        view.getUint16(start + 4) !== 0x0000
      ) {
        return 1;
      }

      const tiff = start + 6;
      if (tiff + 8 > view.byteLength) return 1;
      const le = view.getUint16(tiff) === 0x4949; // "II" little-endian, "MM" big
      const ifd = tiff + view.getUint32(tiff + 4, le);
      if (ifd + 2 > view.byteLength) return 1;

      const entries = view.getUint16(ifd, le);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > view.byteLength) return 1;
        if (view.getUint16(entry, le) === 0x0112) {
          const value = view.getUint16(entry + 8, le);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }

    // Start of scan: image data follows, and there is no metadata past it.
    if (marker === 0xda) return 1;
    offset += 2 + size;
  }
  return 1;
}

/* ── Encoding ──────────────────────────────────────────────────────────────── */

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Draws the bitmap scaled so its long edge is at most `edge`, never enlarging. */
function drawAt(bitmap: ImageBitmap, edge: number): HTMLCanvasElement {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Does the image actually use its alpha channel?
 *
 * Flattening a transparent PNG into JPEG paints the transparent parts black,
 * which is a spectacular way to ruin a cut-out portrait. JPEG is much smaller
 * for photographs, so the question is worth asking rather than assuming either
 * way. Only asked of formats that can carry alpha, and only of the already
 * downscaled canvas, so it is a few megabytes to scan rather than a few hundred.
 */
function usesAlpha(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) return true;
  }
  return false;
}

/* ── The one entry point ───────────────────────────────────────────────────── */

/**
 * Does this file have to be re-encoded, or can its original bytes be sent?
 *
 * Separate from the re-encoding itself for two reasons: the caller needs the
 * answer *before* it starts showing a "Resizing…" notice, or it claims to be
 * resizing every photo including the ones it passes straight through; and the
 * decision is the part worth testing on its own, since getting it wrong either
 * way is silent — too eager and every upload is needlessly lossy, too shy and
 * sideways photos stay sideways.
 *
 * Uses no canvas, so it runs anywhere.
 */
export async function needsReencode(file: File): Promise<boolean> {
  if (file.size > UPLOAD_LIMITS.maxBytes) return true;

  if (file.type === "image/jpeg") {
    try {
      // Only the header is needed, so this reads the first 128KB rather than
      // pulling a 25MB file into memory to answer one question.
      const head = new Uint8Array(await file.slice(0, 128 * 1024).arrayBuffer());
      return readJpegOrientation(head) !== 1;
    } catch {
      // Unreadable header: leave it alone rather than re-encode on a guess.
      return false;
    }
  }

  return false;
}

/**
 * Re-encodes the file, shrinking it until it fits.
 *
 * Never throws. A failure here should read as "this photo did not work", not
 * take the editor down with it. Call only when `needsReencode` said so.
 */
export async function reencode(file: File): Promise<Prepared> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return {
      kind: "failed",
      reason: "that image could not be opened. It may be damaged, or in a format this browser cannot read.",
    };
  }

  try {
    if (bitmap.width * bitmap.height > UPLOAD_LIMITS.maxPixels) {
      return {
        kind: "failed",
        reason: `that image is ${bitmap.width}×${bitmap.height}, which is too large to process.`,
      };
    }

    const canAlpha = file.type === "image/png" || file.type === "image/webp";
    let smallest: Blob | null = null;
    let smallestCanvas: HTMLCanvasElement | null = null;

    /* Decided once, from the largest rendering, rather than at every step.
       `usesAlpha` reads back and walks every pixel, so asking it once per size
       in the ladder means scanning tens of millions of pixels to answer the
       same question five times. Scaling an opaque image cannot introduce
       transparency, so the first answer holds for all the smaller ones. */
    let type: string | null = null;
    const typeFor = (canvas: HTMLCanvasElement) => {
      // A photograph saved as PNG is several times larger than the same
      // photograph as JPEG, which is often the difference between fitting and
      // not — so JPEG unless the image genuinely needs an alpha channel.
      type ??= canAlpha && usesAlpha(canvas) ? "image/png" : "image/jpeg";
      return type;
    };

    for (const edge of EDGE_STEPS) {
      const canvas = drawAt(bitmap, edge);
      const encodeAs = typeFor(canvas);
      const qualities = encodeAs === "image/png" ? [undefined] : QUALITY_STEPS;

      for (const quality of qualities) {
        const blob = await toBlob(canvas, encodeAs, quality);
        if (!blob) continue;
        if (!smallest || blob.size < smallest.size) {
          smallest = blob;
          smallestCanvas = canvas;
        }
        if (blob.size <= TARGET_BYTES) {
          return resized(file, blob, canvas);
        }
      }

      // Already at the smallest step and still too big: hand back the best
      // attempt and let the caller's size check produce the message.
      if (edge === EDGE_STEPS[EDGE_STEPS.length - 1] && smallest && smallestCanvas) {
        return resized(file, smallest, smallestCanvas);
      }
    }

    return { kind: "failed", reason: "that photo could not be made small enough to upload." };
  } catch {
    return { kind: "failed", reason: "that photo could not be resized." };
  } finally {
    bitmap.close();
  }
}

function resized(original: File, blob: Blob, canvas: HTMLCanvasElement): Prepared {
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const base = original.name.replace(/\.[^.]+$/, "") || "photo";

  return {
    kind: "resized",
    file: new File([blob], `${base}.${ext}`, { type: blob.type }),
    fromBytes: original.size,
    toBytes: blob.size,
    width: canvas.width,
    height: canvas.height,
  };
}
