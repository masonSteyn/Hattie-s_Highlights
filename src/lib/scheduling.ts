/**
 * The scheduling URL is an admin field rather than an environment variable, so
 * Hattie can switch from Calendly to something else without a deploy. That
 * convenience is also the risk: the value ends up as an iframe `src`, so a
 * compromised CMS account would otherwise be an arbitrary-frame injection on
 * the booking page.
 *
 * Every URL is therefore checked against an allowlist of scheduling hosts and
 * required to be https before it is rendered. Adding a provider is a code
 * change on purpose.
 */

import providers from "../../scheduling-providers.json";

/**
 * One list, two consumers: this validator and the `frame-src` directive in
 * next.config.ts. Kept in JSON because next.config.ts cannot import a .ts
 * module at runtime — see the note there.
 */
export const SCHEDULING_PROVIDERS: readonly string[] = providers;

const ALLOWED_HOSTS: readonly string[] = SCHEDULING_PROVIDERS;

export type SchedulingEmbed =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: string };

function isAllowedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

export function resolveSchedulingEmbed(raw: string | undefined): SchedulingEmbed {
  if (!raw?.trim()) {
    return { ok: false, reason: "No scheduling link has been set yet." };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "That scheduling link is not a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Scheduling links must use https." };
  }

  if (!isAllowedHost(parsed.hostname)) {
    return {
      ok: false,
      reason: `${parsed.hostname} is not a recognised scheduling provider.`,
    };
  }

  // Calendly renders a cleaner inline view when it knows it is embedded.
  if (parsed.hostname.endsWith("calendly.com")) {
    parsed.searchParams.set("embed_type", "Inline");
    parsed.searchParams.set("hide_gdpr_banner", "1");
  }

  return { ok: true, url: parsed.toString(), host: parsed.hostname };
}
