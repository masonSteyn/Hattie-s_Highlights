import { defineType } from "sanity";

/**
 * Portfolio categories. These drive the filter buttons and one static page
 * each — adding "Newborn" here creates /portfolio/newborn with no code change.
 */
export const category = defineType({
  name: "category",
  title: "Category",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    },
    {
      name: "slug",
      title: "Web address",
      type: "slug",
      description: "Filled in automatically. This becomes /portfolio/your-category.",
      options: { source: "title", maxLength: 60 },
      validation: (rule) => rule.required(),
    },
    { name: "orderRank", type: "string", hidden: true },
  ],
  preview: {
    select: { title: "title", subtitle: "slug.current" },
  },
});
