import { defineType } from "sanity";

export const bookingPage = defineType({
  name: "bookingPage",
  title: "Booking page",
  type: "document",
  groups: [{ name: "content", title: "Content", default: true }, { name: "seo", title: "Search" }],
  fields: [
    {
      name: "heading",
      title: "Heading",
      type: "string",
      group: "content",
      validation: (rule) => rule.required().max(60),
    },
    {
      name: "intro",
      title: "What to expect",
      type: "array",
      group: "content",
      description: "Shown above the calendar. Each block is one paragraph.",
      of: [{ type: "text", rows: 3 }],
      validation: (rule) => rule.required().min(1),
    },
    {
      name: "fallbackNote",
      title: "Text before the email fallback",
      type: "string",
      group: "content",
      description:
        'Shown under the calendar with your email address after it. Example: "Calendar not loading?"',
      validation: (rule) => rule.required().max(80),
    },
    { name: "seo", type: "seo", group: "seo" },
  ],
  preview: { prepare: () => ({ title: "Booking page" }) },
});
