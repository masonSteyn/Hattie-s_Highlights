import { defineType } from "sanity";

import { SCHEDULING_PROVIDERS } from "../../../src/lib/scheduling";

/**
 * Everything set once and revisited rarely — with one exception.
 *
 * The availability banner lives here structurally but is surfaced on the front
 * screen of the Studio, because it is the field that most rewards being kept
 * current and the one most likely to go stale if it is three clicks deep.
 */
export const siteSettings = defineType({
  name: "siteSettings",
  title: "Settings",
  type: "document",
  groups: [
    { name: "availability", title: "Availability", default: true },
    { name: "booking", title: "Booking & email" },
    { name: "business", title: "Business details" },
    { name: "seo", title: "Search defaults" },
  ],
  fields: [
    {
      name: "availability",
      title: "Availability banner",
      type: "object",
      group: "availability",
      description: "A single line across the top of every page. Off unless you turn it on.",
      fields: [
        { name: "enabled", title: "Show it", type: "boolean", initialValue: false },
        {
          name: "text",
          title: "What it says",
          type: "string",
          description: 'Example: "Booking fall 2026 — 3 dates left"',
          validation: (rule) => rule.max(90),
        },
      ],
      validation: (rule) =>
        rule.custom((value?: { enabled?: boolean; text?: string }) =>
          value?.enabled && !value?.text?.trim()
            ? "Add some text, or switch the banner off."
            : true,
        ),
    },
    {
      name: "schedulingUrl",
      title: "Booking calendar link",
      type: "url",
      group: "booking",
      description: `Paste the link to your booking page. Works with ${SCHEDULING_PROVIDERS.join(", ")}. Must start with https.`,
      validation: (rule) =>
        rule
          .required()
          .uri({ scheme: ["https"] })
          .custom((value?: string) => {
            if (!value) return true;
            try {
              const host = new URL(value).hostname.toLowerCase();
              const allowed = SCHEDULING_PROVIDERS.some(
                (p) => host === p || host.endsWith(`.${p}`),
              );
              return allowed
                ? true
                : `We do not recognise ${host} as a booking service. Supported: ${SCHEDULING_PROVIDERS.join(", ")}.`;
            } catch {
              return "That does not look like a web address.";
            }
          }),
    },
    {
      name: "contactEmail",
      title: "Where enquiries go",
      type: "string",
      group: "booking",
      description: "Every message from the contact form is sent here.",
      validation: (rule) => rule.required().email(),
    },
    {
      name: "business",
      title: "Business details",
      type: "object",
      group: "business",
      description:
        "Used for the details Google shows about you in local search. Worth filling in properly once.",
      options: { collapsible: false },
      fields: [
        { name: "name", title: "Business name", type: "string", validation: (r) => r.required() },
        {
          name: "city",
          title: "City",
          type: "string",
          description:
            'The single most valuable field here — it goes into page titles, so people searching "senior photos [your city]" can find you.',
          validation: (r) => r.required(),
        },
        { name: "region", title: "State or region", type: "string", validation: (r) => r.required() },
        {
          name: "serviceArea",
          title: "Areas you travel to",
          type: "string",
          description: 'Example: "Denver and the Front Range"',
        },
        { name: "phone", title: "Phone", type: "string" },
        { name: "hours", title: "Hours", type: "string", description: 'Example: "By appointment"' },
        {
          name: "social",
          title: "Social links",
          type: "array",
          of: [
            {
              type: "object",
              fields: [
                {
                  name: "label",
                  title: "Which one",
                  type: "string",
                  options: { list: ["Instagram", "Facebook", "Email"] },
                  validation: (r) => r.required(),
                },
                {
                  name: "href",
                  title: "Link",
                  type: "url",
                  validation: (r) => r.required().uri({ scheme: ["https", "mailto"] }),
                },
              ],
              preview: { select: { title: "label", subtitle: "href" } },
            },
          ],
        },
      ],
    },
    {
      name: "defaultSeo",
      title: "Default search settings",
      type: "seo",
      group: "seo",
      description:
        "Used for any page where you have not written something specific. Filling this in means no page is ever left without a title.",
    },
  ],
  preview: { prepare: () => ({ title: "Settings" }) },
});
