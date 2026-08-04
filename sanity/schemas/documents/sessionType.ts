import { defineType } from "sanity";

/**
 * The single source of truth for what Hattie offers. This one list fills the
 * Booking page, the prices shown there, and the Contact form dropdown — it is
 * deliberately not duplicated in three places.
 */
export const sessionType = defineType({
  name: "sessionType",
  title: "Session type",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    },
    {
      name: "description",
      title: "What it includes",
      type: "text",
      rows: 3,
      description: "One or two sentences. Shown on the Booking page.",
      validation: (rule) => rule.required(),
    },
    {
      name: "startingPrice",
      title: "Starting price",
      type: "number",
      description: 'Shown as "from $X". Whole dollars.',
      validation: (rule) => rule.required().min(0).integer(),
    },
    { name: "orderRank", type: "string", hidden: true },
  ],
  preview: {
    select: { title: "title", price: "startingPrice" },
    prepare: ({ title, price }) => ({ title, subtitle: price ? `from $${price}` : "no price set" }),
  },
});
