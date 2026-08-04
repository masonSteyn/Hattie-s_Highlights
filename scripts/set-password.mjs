/**
 * Generates the two secrets the editor needs, then prints them to paste into
 * .env.local (and into Vercel's environment variables).
 *
 *   node scripts/set-password.mjs "the password you want"
 *
 * The password itself is never written anywhere — only its scrypt hash, which
 * cannot be reversed. If it is forgotten, run this again with a new one.
 */

import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

const password = process.argv[2];

if (!password) {
  console.error(`
  Usage: node scripts/set-password.mjs "your-password-here"

  Pick something long rather than complicated — four unrelated words beats
  P@ssw0rd! for both memorability and strength.
`);
  process.exit(1);
}

if (password.length < 12) {
  console.error(`
  ✗ That password is ${password.length} characters. Use at least 12.
    There is no rate-limit-free path to this login, but a short password is
    still the weakest part of the whole system.
`);
  process.exit(1);
}

// Import the compiled TS through Node's type stripping.
const { hashPassword } = await import(
  pathToFileURL(new URL("../src/lib/password.ts", import.meta.url).pathname).href
);

const hash = await hashPassword(password);
const secret = randomBytes(48).toString("base64url");

console.log(`
  Add these to .env.local (and to your Vercel environment variables):

  EDITOR_PASSWORD_HASH=${hash}
  EDITOR_SESSION_SECRET=${secret}

  Then give Hattie the password itself — not this file.

  Changing the session secret later signs everyone out immediately, which is
  the fastest way to revoke access if a password is ever shared by accident.
`);
