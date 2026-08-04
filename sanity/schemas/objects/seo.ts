import { defineType } from "sanity";

/**
 * Per-page SEO. Every field is optional on purpose — blanks fall back to
 * defaults built from the business details, so an empty field can never produce
 * an empty <title>.
 */
export const seo = defineType({
  name: "seo",
  title: "Search & sharing",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    {
      name: "title",
      title: "Page title",
      type: "string",
      description:
        "Shows in the browser tab and as the headline in Google. Around 60 characters. Leave blank to use the default.",
      validation: (rule) => rule.max(70).warning("Google usually cuts off around 60 characters."),
    },
    {
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      description:
        "The grey text under the link in Google. Around 155 characters. Leave blank to use the default.",
      validation: (rule) => rule.max(180).warning("Google usually cuts off around 155 characters."),
    },
    {
      name: "shareImage",
      title: "Sharing image",
      type: "image",
      description:
        "What people see when the page is pasted into Instagram, Facebook, or a text message. Landscape works best.",
      options: { metadata: ["lqip", "dimensions"] },
    },
  ],
});
