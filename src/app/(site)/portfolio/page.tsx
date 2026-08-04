import type { Metadata } from "next";

import { PortfolioView } from "@/components/PortfolioView";
import { pageMetadata } from "@/lib/metadata";

import "./portfolio.css";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Portfolio",
    description:
      "Weddings, portraits, events, and nature — selected work by Hattie's Highlights.",
    path: "/portfolio",
  });
}

export default function PortfolioPage() {
  return <PortfolioView />;
}
