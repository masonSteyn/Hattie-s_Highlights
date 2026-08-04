"use client";

import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";

import { cleanUploadSource } from "./sanity/components/CleanUploadSource";
import { apiVersion, dataset, projectId, studioBasePath } from "./sanity/env";
import { schemaTypes } from "./sanity/schemas";
import { SINGLETONS, structure } from "./sanity/structure";

const singletons = new Set<string>(SINGLETONS);

export default defineConfig({
  name: "hatties-highlights",
  title: "Hattie's Highlights",
  basePath: studioBasePath,
  projectId,
  dataset,

  schema: {
    types: schemaTypes,
    // Keep the singletons out of the global "create new" menu.
    templates: (prev) => prev.filter((t) => !singletons.has(t.schemaType)),
  },

  form: {
    image: {
      // Turns off Sanity's own drag-and-drop and paste upload handlers, so the
      // asset source below becomes the only route an image can take into the
      // dataset. Without this the validation and EXIF strip would be one entry
      // point among several, which is not a guarantee.
      directUploads: false,
      assetSources: [cleanUploadSource],
    },
  },

  document: {
    // ...and out of the per-document actions, so there is no way to end up with
    // two home pages or none.
    actions: (prev, { schemaType }) =>
      singletons.has(schemaType)
        ? prev.filter(({ action }) => action !== "unpublish" && action !== "delete" && action !== "duplicate")
        : prev,
  },

  plugins: [
    structureTool({ structure }),
    // Vision is a GROQ playground. Useful to me, noise to Hattie — so it is
    // only mounted outside production.
    ...(process.env.NODE_ENV === "production" ? [] : [visionTool({ defaultApiVersion: apiVersion })]),
  ],
});
