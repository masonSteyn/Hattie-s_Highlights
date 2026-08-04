import { defineType } from "sanity";

/**
 * The image field used everywhere a photograph appears.
 *
 * Two things are deliberate here:
 *
 *  1. `metadata` lists lqip, blurhash, palette and dimensions — and NOT `exif`
 *     or `location`. Sanity extracts whatever is listed into the asset
 *     document, so leaving those out means GPS coordinates from a shoot never
 *     become queryable CMS data. The bytes themselves are already stripped
 *     before upload by the custom input (see PhotoUpload), so this is the
 *     second layer rather than the only one.
 *  2. Alt text is required. Not "recommended" — an image cannot be published
 *     without it, because a validation rule is the only version of that policy
 *     that survives a busy week.
 */
export const photoImage = defineType({
  name: "photoImage",
  title: "Photograph",
  type: "image",
  options: {
    hotspot: true,
    metadata: ["lqip", "blurhash", "palette"],
    storeOriginalFilename: true,
  },
  fields: [
    {
      name: "alt",
      title: "Describe this photo",
      type: "string",
      description:
        "For people using a screen reader, and for Google. Say what is happening — “a bride laughing on the church steps”, not “photo1”.",
      validation: (rule) =>
        rule
          .required()
          .min(8)
          .warning("A few more words will do more for search than a short label."),
    },
  ],
});
