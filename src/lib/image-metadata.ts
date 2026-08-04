/**
 * Format sniffing, dimension reading, and metadata stripping — all by walking
 * the container's own byte structure.
 *
 * Why not just re-encode with sharp? Because re-encoding a JPEG is lossy, and
 * the brief asks for the original to be stored untouched. Removing whole
 * segments from the container leaves every entropy-coded pixel byte exactly as
 * the camera wrote it while deleting the metadata blocks outright. It is also
 * isomorphic — no native dependency — so the same function runs in the Studio
 * before a byte leaves Hattie's laptop, and on the server if we ever need it.
 *
 * The thing this actually protects: a Lightroom export carries GPS coordinates
 * from the shoot. Publishing those alongside a family's portraits discloses
 * where those people were.
 */

export type ImageFormat = "jpeg" | "png" | "webp";

export type ProbeResult =
  | { ok: true; format: ImageFormat; width: number; height: number }
  | { ok: false; reason: string };

/* ── Format sniffing ─────────────────────────────────────────────────────────
   By magic bytes, never by extension or by the browser-supplied MIME type —
   both are attacker-controlled and neither says anything about the contents. */

export function sniffFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && PNG.every((b, i) => bytes[i] === b)) return "png";
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[offset + i]);
  return out;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u32le = (b: Uint8Array, i: number) =>
  (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/* ── Dimensions ───────────────────────────────────────────────────────────── */

export function probe(bytes: Uint8Array): ProbeResult {
  const format = sniffFormat(bytes);
  if (!format) {
    return {
      ok: false,
      reason: "That does not look like a JPEG, PNG, or WebP.",
    };
  }

  try {
    const size =
      format === "jpeg"
        ? jpegSize(bytes)
        : format === "png"
          ? pngSize(bytes)
          : webpSize(bytes);
    if (!size) return { ok: false, reason: "Could not read the image dimensions." };
    return { ok: true, format, ...size };
  } catch {
    return { ok: false, reason: "That image file looks damaged." };
  }
}

function jpegSize(b: Uint8Array) {
  let i = 2;
  while (i < b.length - 1) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];
    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = u16be(b, i + 2);
    // SOF0..SOF15, excluding the DHT/JPG/DAC markers interleaved in that range.
    const isSOF =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    i += 2 + length;
  }
  return null;
}

function pngSize(b: Uint8Array) {
  // IHDR is required to be the first chunk.
  if (ascii(b, 12, 4) !== "IHDR") return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function webpSize(b: Uint8Array) {
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8X") {
    return {
      width: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
      height: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
    };
  }
  if (chunk === "VP8 ") {
    return { width: u16be(b, 27) & 0x3fff, height: u16be(b, 29) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = u32le(b, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/* ── Stripping ───────────────────────────────────────────────────────────── */

export type StripResult = {
  bytes: Uint8Array;
  /** Segment/chunk names that were removed, for reporting and for tests. */
  removed: string[];
};

export function stripMetadata(bytes: Uint8Array, format: ImageFormat): StripResult {
  if (format === "jpeg") return stripJpeg(bytes);
  if (format === "png") return stripPng(bytes);
  return stripWebp(bytes);
}

/**
 * JPEG: drop APP1 (EXIF and XMP), APP13 (IPTC / Photoshop resources), and COM.
 *
 * Deliberately KEPT: APP0 (JFIF), APP2 (ICC colour profile) and APP14 (Adobe
 * colour transform). Those are not metadata about the subject, they are
 * instructions for decoding the pixels correctly — strip them and skin tones
 * shift.
 */
function stripJpeg(b: Uint8Array): StripResult {
  const keep: Uint8Array[] = [b.subarray(0, 2)]; // SOI
  const removed: string[] = [];
  let i = 2;

  while (i < b.length - 1) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      keep.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }

    // Start of scan: everything from here to the end is entropy-coded image
    // data. Copy it verbatim and stop parsing.
    if (marker === 0xda) {
      keep.push(b.subarray(i));
      break;
    }

    const length = u16be(b, i + 2);
    const end = i + 2 + length;

    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) {
      removed.push(
        marker === 0xe1 ? "APP1 (EXIF/XMP)" : marker === 0xed ? "APP13 (IPTC)" : "COM",
      );
    } else {
      keep.push(b.subarray(i, end));
    }

    i = end;
  }

  return { bytes: concat(keep), removed };
}

/** PNG: drop the textual and timestamp chunks; keep everything else. */
function stripPng(b: Uint8Array): StripResult {
  const DROP = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);
  const keep: Uint8Array[] = [b.subarray(0, 8)];
  const removed: string[] = [];
  let i = 8;

  while (i < b.length) {
    const length = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + length;
    if (DROP.has(type)) removed.push(type);
    else keep.push(b.subarray(i, end));
    if (type === "IEND") break;
    i = end;
  }

  return { bytes: concat(keep), removed };
}

/** WebP: drop EXIF and XMP chunks and rewrite the RIFF length. */
function stripWebp(b: Uint8Array): StripResult {
  const DROP = new Set(["EXIF", "XMP "]);
  const body: Uint8Array[] = [];
  const removed: string[] = [];
  let i = 12;

  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const size = u32le(b, i + 4);
    // RIFF chunks are padded to an even length.
    const end = i + 8 + size + (size % 2);
    if (DROP.has(type)) removed.push(type.trim());
    else body.push(b.subarray(i, Math.min(end, b.length)));
    i = end;
  }

  const payload = concat(body);
  const header = new Uint8Array(12);
  header.set(b.subarray(0, 12));
  const riffSize = payload.length + 4;
  header[4] = riffSize & 0xff;
  header[5] = (riffSize >> 8) & 0xff;
  header[6] = (riffSize >> 16) & 0xff;
  header[7] = (riffSize >> 24) & 0xff;

  return { bytes: concat([header, payload]), removed };
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/* ── Policy ──────────────────────────────────────────────────────────────── */

export const UPLOAD_LIMITS = {
  /** Comfortably above a full-frame Lightroom export; well below a zip bomb. */
  maxBytes: 40 * 1024 * 1024,
  /** Guards the image pipeline against a decompression bomb. */
  maxDimension: 12_000,
  maxPixels: 60_000_000,
} as const;

export type PreparedUpload =
  | {
      ok: true;
      bytes: Uint8Array;
      format: ImageFormat;
      width: number;
      height: number;
      removed: string[];
      originalBytes: number;
    }
  | { ok: false; reason: string };

/**
 * The single gate every upload passes through: sniff, bound, strip. Called
 * before the file is handed to the CMS, so nothing unvalidated is ever stored.
 */
export function prepareUpload(input: Uint8Array): PreparedUpload {
  if (input.length === 0) return { ok: false, reason: "That file is empty." };
  if (input.length > UPLOAD_LIMITS.maxBytes) {
    return {
      ok: false,
      reason: `That file is ${(input.length / 1024 / 1024).toFixed(0)} MB. The limit is ${
        UPLOAD_LIMITS.maxBytes / 1024 / 1024
      } MB.`,
    };
  }

  const probed = probe(input);
  if (!probed.ok) return { ok: false, reason: probed.reason };

  const { format, width, height } = probed;
  if (width > UPLOAD_LIMITS.maxDimension || height > UPLOAD_LIMITS.maxDimension) {
    return {
      ok: false,
      reason: `That image is ${width}×${height}. The limit is ${UPLOAD_LIMITS.maxDimension}px on a side.`,
    };
  }
  if (width * height > UPLOAD_LIMITS.maxPixels) {
    return { ok: false, reason: "That image has too many pixels to process safely." };
  }

  const { bytes, removed } = stripMetadata(input, format);
  return { ok: true, bytes, format, width, height, removed, originalBytes: input.length };
}
