import { defineType } from "sanity";

export const homePage = defineType({
  name: "homePage",
  title: "Home page",
  type: "document",
  groups: [{ name: "content", title: "Content", default: true }, { name: "seo", title: "Search" }],
  fields: [
    {
      name: "hero",
      title: "Big photo at the top",
      type: "photoImage",
      group: "content",
      validation: (rule) => rule.required(),
    },
    {
      name: "headlineBefore",
      title: "Headline — first part",
      type: "string",
      group: "content",
      description: 'Set in the plain serif. Example: "The parts you".',
      validation: (rule) => rule.required().max(60),
    },
    {
      name: "headlineScript",
      title: "Headline — the fancy word",
      type: "string",
      group: "content",
      description:
        "One word, set in the handwriting font. Keep it to one — two starts to look like a wedding invitation.",
      validation: (rule) =>
        rule
          .max(18)
          .custom((value?: string) =>
            !value || value.trim().split(/\s+/).length <= 2
              ? true
              : "One or two words. The script face is hard to read in longer runs.",
          ),
    },
    {
      name: "headlineAfter",
      title: "Headline — last part",
      type: "string",
      group: "content",
      description: "Optional, if the fancy word sits in the middle.",
      validation: (rule) => rule.max(60),
    },
    {
      name: "intro",
      title: "Line under the photo",
      type: "text",
      rows: 3,
      group: "content",
      validation: (rule) => rule.required().max(280),
    },
    {
      name: "closingHeading",
      title: "Heading at the bottom",
      type: "string",
      group: "content",
      validation: (rule) => rule.required().max(80),
    },
    {
      name: "closingBody",
      title: "Text at the bottom",
      type: "text",
      rows: 2,
      group: "content",
      validation: (rule) => rule.required().max(280),
    },
    { name: "seo", type: "seo", group: "seo" },
  ],
  preview: { prepare: () => ({ title: "Home page" }) },
});
