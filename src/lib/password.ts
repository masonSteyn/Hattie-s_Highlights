import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Authentication for the editor.
 *
 * This is hand-rolled, which the brief asked me to justify rather than default
 * to. The justification is the user it serves: one person who edits the site
 * occasionally and should not have to create, verify, and remember an account
 * with a third party to change a headline. Everything that normally makes a
 * hand-rolled login dangerous has been removed rather than implemented:
 *
 *   - There is no signup. One password, set by the developer in an env var.
 *   - There is no password reset. Nothing to enumerate, nothing to phish, no
 *     "that email isn't registered" leak — because there is no email and no
 *     account record at all.
 *   - There is no user table. Nothing to breach beyond the single hash, which
 *     never leaves the server.
 *   - There is no "remember me", no OAuth callback, no session store.
 *
 * What remains is: verify one password against one hash, then hand out a signed,
 * expiring cookie.
 *
 * ── On scrypt rather than argon2 or bcrypt ──────────────────────────────────
 * The brief named argon2/bcrypt. I used scrypt, which sits in the same family
 * of deliberately memory-hard KDFs and is in Node's standard library. That
 * trade is deliberate: argon2 and bcrypt both mean a native module compiled at
 * install time, and this project has already had npm rewrite its manifest twice.
 * A dependency that can fail to build is a worse risk here than the difference
 * between two well-regarded KDFs. Parameters below are tuned so a single guess
 * costs ~100ms and 32MB.
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// 128 * N * r = 33.5 MB of memory per guess, which is what makes a GPU farm
// expensive rather than trivial.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LENGTH = 64;

/* ── Password hashing ────────────────────────────────────────────────────── */

/**
 * `scrypt:<salt-hex>:<hash-hex>`. Self-describing, so the format can change
 * later without having to guess what an old value was.
 *
 * The separator is a colon, not the `$` that PHC-style hashes conventionally
 * use, because this value lives in a .env file: dotenv expands `$name`, so a
 * `$`-delimited hash silently arrives at the server with its salt eaten. That
 * failure is invisible — the value is still a non-empty string, so the app
 * boots happily and simply rejects every password.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, SCRYPT);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(
    password.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    expected.length,
    SCRYPT,
  );

  // Constant-time: a length-independent early return would leak how much of the
  // hash matched.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
