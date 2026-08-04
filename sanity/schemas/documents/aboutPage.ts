import { defineType } from "sanity";

export const aboutPage = defineType({
  name: "aboutPage",
  title: "About page",
  type: "document",
  groups: [{ name: "content", title: "Content", default: true }, { name: "seo", title: "Search" }],
  fields: [
    {
      name: "portrait",
      title: "Your photo",
      type: "photoImage",
      group: "content",
      validation: (rule) => rule.required(),
    },
    {
      name: "heading",
      title: "Heading",
      type: "string",
      group: "content",
      description: 'Something like "About Hattie" — better for search than just "About".',
      validation: (rule) => rule.required().max(60),
    },
    {
      name: "body",
      title: "About you",
      type: "array",
      group: "content",
      description: "Each block is one paragraph.",
      of: [{ type: "text", rows: 4 }],
      validation: (rule) => rule.required().min(1),
    },
    {
      name: "pullQuote",
      title: "The one big handwritten line",
      type: "string",
      group: "content",
      description:
        "Six words or fewer. This is the only place on the page that uses the handwriting font, and it stops being readable if it runs long.",
      validation: (rule) =>
        rule.custom((value?: string) =>
          !value || value.trim().split(/\s+/).length <= 6
            ? true
            : "Six words or fewer, or it becomes hard to read.",
        ),
    },
    { name: "seo", type: "seo", group: "seo" },
  ],
  preview: { prepare: () => ({ title: "About page" }) },
});
