import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Session issuing and verification for the editor.
 *
 * The password hashing lives in ./password.ts, deliberately free of the
 * `server-only` guard so the set-password CLI script can import it. This module
 * keeps the guard, because it is the one that reads the session secret.
 *
 * See ./password.ts for why this login is hand-rolled and what was left out
 * rather than implemented.
 */

export const SESSION_COOKIE = "hh_editor";
/** Eight hours: long enough to finish an editing session, short enough that a
 *  forgotten login on a shared laptop expires the same day. */
export const SESSION_MAX_AGE = 60 * 60 * 8;

/* ── Sessions ────────────────────────────────────────────────────────────── */

/**
 * A signed, stateless token: `<expiry>.<hmac>`.
 *
 * Stateless because Vercel runs many short-lived instances with no shared
 * memory, so an in-process session map would log the editor out at random. The
 * only claim carried is an expiry, and the secret never leaves the server, so
 * the token cannot be forged or extended.
 */
function sessionSecret(): Buffer | null {
  const secret = process.env.EDITOR_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return Buffer.from(secret, "utf8");
}

export function createSessionToken(): string | null {
  const secret = sessionSecret();
  if (!secret) return null;

  const expiresAt = String(Date.now() + SESSION_MAX_AGE * 1000);
  const signature = createHmac("sha256", secret).update(expiresAt).digest("hex");
  return `${expiresAt}.${signature}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const secret = sessionSecret();
  if (!secret) return false;

  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) return false;

  const expected = createHmac("sha256", secret).update(expiresAt).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  // Signature checked before expiry, so an attacker learns nothing from timing
  // about whether a forged token was merely stale.
  return Number(expiresAt) > Date.now();
}

/* ── Configuration ───────────────────────────────────────────────────────── */

export type AuthConfig =
  | { ready: true }
  | { ready: false; missing: string[] };

/**
 * The editor refuses to run half-configured. A missing secret must not degrade
 * into "everyone is signed in" — it degrades into "nobody is, and here is what
 * to set".
 */
export function authConfig(): AuthConfig {
  const missing: string[] = [];
  if (!process.env.EDITOR_PASSWORD_HASH) missing.push("EDITOR_PASSWORD_HASH");
  if (!sessionSecret()) missing.push("EDITOR_SESSION_SECRET (32+ characters)");
  return missing.length === 0 ? { ready: true } : { ready: false, missing };
}
