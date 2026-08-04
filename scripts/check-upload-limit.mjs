/**
 * next.config.ts cannot import from src/ (see the note there), so the Server
 * Action body limit and the upload limit the application enforces are declared
 * separately. This asserts they still agree.
 *
 * The failure this prevents is not theoretical — it is the bug this check was
 * written after. The body limit sat at Next's 1MB default while the validator
 * advertised 40MB, so every photo in between was rejected by the framework
 * before any application code ran. There is no error handler that can improve
 * that message, because nothing of ours executes: uploads simply died with
 * "the upload did not complete. Check your connection and try again."
 *
 * So the rule is that maxBytes must stay strictly below the body limit, with
 * room for the multipart overhead FormData wraps around the file.
 */
import { readFileSync } from "node:fs";

const HEADROOM = 256 * 1024; // multipart boundaries, headers, filename
const VERCEL_CAP = 4.5 * 1024 * 1024;

function fail(message) {
  console.error(`upload limits: ${message}`);
  process.exit(1);
}

/* Parse the body limit out of next.config.ts, in the "4mb" / "512kb" form the
   bytes package accepts. */
const config = readFileSync("next.config.ts", "utf8");
const declared = config.match(
  /const SERVER_ACTION_BODY_LIMIT = "(\d+(?:\.\d+)?)(kb|mb)"/i,
);
if (!declared) fail("could not find SERVER_ACTION_BODY_LIMIT in next.config.ts");

const unit = declared[2].toLowerCase() === "mb" ? 1024 * 1024 : 1024;
const bodyLimit = Number(declared[1]) * unit;

/* And the enforced limit out of the module both runtimes read it from. */
const source = readFileSync("src/lib/upload-limits.ts", "utf8");
const max = source.match(/maxBytes:\s*Math\.round\(([\d.]+)\s*\*\s*1024\s*\*\s*1024\)/);
if (!max) fail("could not find maxBytes in src/lib/upload-limits.ts");

const maxBytes = Math.round(Number(max[1]) * 1024 * 1024);

if (maxBytes + HEADROOM > bodyLimit) {
  fail(
    `maxBytes is ${(maxBytes / 1024 / 1024).toFixed(2)}MB but the Server Action body ` +
      `limit is ${(bodyLimit / 1024 / 1024).toFixed(2)}MB. Files between them fail ` +
      `before any application code runs, with no usable error. Leave at least ` +
      `${(HEADROOM / 1024).toFixed(0)}KB of headroom for multipart overhead.`,
  );
}

if (bodyLimit > VERCEL_CAP) {
  fail(
    `the body limit is ${(bodyLimit / 1024 / 1024).toFixed(2)}MB, above Vercel's ` +
      `~4.5MB cap on a request body. Vercel would reject the request before Next ` +
      `saw it, which is the same unexplained failure by a different route.`,
  );
}

console.log(
  `upload limits in sync: ${(maxBytes / 1024 / 1024).toFixed(2)}MB enforced, ` +
    `${(bodyLimit / 1024 / 1024).toFixed(2)}MB body limit, ` +
    `${((bodyLimit - maxBytes) / 1024).toFixed(0)}KB headroom.`,
);
