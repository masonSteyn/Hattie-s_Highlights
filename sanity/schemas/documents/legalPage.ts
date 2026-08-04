import { defineType } from "sanity";

/**
 * Privacy policy and terms. Rich text with no raw-HTML block — a `block` array
 * cannot carry a <script>, which is what makes this safe to render without an
 * HTML sanitiser in the request path.
 */
export const legalPage = defineType({
  name: "legalPage",
  title: "Policy page",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    },
    {
      name: "slug",
      title: "Web address",
      type: "slug",
      options: { source: "title", maxLength: 60 },
      validation: (rule) => rule.required(),
    },
    {
      name: "body",
      title: "The policy",
      type: "array",
      of: [
        {
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "Heading", value: "h2" },
            { title: "Sub-heading", value: "h3" },
          ],
          lists: [{ title: "Bullets", value: "bullet" }],
          marks: {
            decorators: [{ title: "Bold", value: "strong" }, { title: "Italic", value: "em" }],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Link",
                fields: [
                  {
                    name: "href",
                    type: "url",
                    title: "Address",
                    validation: (rule) =>
                      rule.uri({ scheme: ["https", "mailto"] }).required(),
                  },
                ],
              },
            ],
          },
        },
      ],
      validation: (rule) => rule.required(),
    },
    { name: "updatedAt", title: "Last updated", type: "date" },
  ],
});
