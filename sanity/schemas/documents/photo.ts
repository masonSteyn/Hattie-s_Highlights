import { defineType } from "sanity";

/**
 * One photograph. The document Hattie creates most often by an enormous margin,
 * so it has four fields and three of them are optional.
 *
 * Images arrive through the one asset source configured in sanity.config.ts,
 * which validates and strips metadata before upload — see
 * components/CleanUploadSource.
 */
export const photo = defineType({
  name: "photo",
  title: "Photo",
  type: "document",
  fields: [
    {
      name: "image",
      title: "Photo",
      type: "photoImage",
      validation: (rule) => rule.required(),
    },
    {
      name: "categories",
      title: "Categories",
      type: "array",
      description: "A photo can be in more than one.",
      of: [{ type: "reference", to: [{ type: "category" }] }],
      validation: (rule) => rule.required().min(1).unique(),
    },
    {
      name: "featured",
      title: "Show on the home page",
      type: "boolean",
      description:
        "Starred photos fill the grid on the home page. Turn this on and off to change what visitors see first — there is no separate list to edit.",
      initialValue: false,
    },
    {
      name: "caption",
      title: "Caption",
      type: "string",
      description: "Optional. Shown under the photo.",
    },
    { name: "orderRank", type: "string", hidden: true },
  ],
  preview: {
    select: {
      media: "image",
      alt: "image.alt",
      caption: "caption",
      featured: "featured",
      category: "categories.0.title",
    },
    prepare: ({ media, alt, caption, featured, category }) => ({
      media,
      title: caption || alt || "Untitled photo",
      subtitle: [featured ? "★ on home page" : null, category].filter(Boolean).join(" · "),
    }),
  },
});
