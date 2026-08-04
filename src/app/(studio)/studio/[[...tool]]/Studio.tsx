"use client";

import { NextStudio } from "next-sanity/studio";

import config from "../../../../../sanity.config";

/**
 * Split out so the route can decide whether to mount the Studio at all without
 * pulling the entire editor bundle into a page that may only be showing setup
 * instructions.
 */
export function Studio() {
  return <NextStudio config={config} />;
}
