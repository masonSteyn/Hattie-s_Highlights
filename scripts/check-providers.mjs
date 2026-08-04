/**
 * next.config.ts cannot import the scheduling allowlist (see the note there),
 * so the list exists in two places. This asserts they are identical — a drift
 * would mean the CSP permits a provider the validator rejects, or worse, the
 * reverse.
 */
import { readFileSync } from "node:fs";

const json = JSON.parse(readFileSync("scheduling-providers.json", "utf8"));

const config = readFileSync("next.config.ts", "utf8");
const block = config.match(/const SCHEDULING_PROVIDERS = \[([\s\S]*?)\];/);
if (!block) {
  console.error("Could not find SCHEDULING_PROVIDERS in next.config.ts");
  process.exit(1);
}
const inConfig = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const same =
  json.length === inConfig.length && json.every((host, i) => host === inConfig[i]);

if (!same) {
  console.error("Scheduling provider lists have drifted apart:");
  console.error("  scheduling-providers.json:", json.join(", "));
  console.error("  next.config.ts:           ", inConfig.join(", "));
  process.exit(1);
}

console.log(`scheduling providers in sync (${json.length}): ${json.join(", ")}`);
