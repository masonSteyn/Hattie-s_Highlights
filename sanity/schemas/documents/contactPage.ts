import { defineType } from "sanity";

export const contactPage = defineType({
  name: "contactPage",
  title: "Contact page",
  type: "document",
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "reply", title: "Automatic reply" },
    { name: "seo", title: "Search" },
  ],
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
      title: "Line above the form",
      type: "text",
      rows: 3,
      group: "content",
      validation: (rule) => rule.required().max(300),
    },
    {
      name: "autoResponseSubject",
      title: "Subject of the automatic reply",
      type: "string",
      group: "reply",
      description: "Sent to anyone who fills in the form, so they know it arrived.",
      validation: (rule) => rule.required().max(120),
    },
    {
      name: "autoResponseBody",
      title: "The automatic reply",
      type: "text",
      rows: 8,
      group: "reply",
      description: "Plain text. Sign it however you like.",
      validation: (rule) => rule.required(),
    },
    { name: "seo", type: "seo", group: "seo" },
  ],
  preview: { prepare: () => ({ title: "Contact page" }) },
});
