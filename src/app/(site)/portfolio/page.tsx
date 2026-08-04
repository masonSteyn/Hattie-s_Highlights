import type { Metadata } from "next";

import { PortfolioView } from "@/components/PortfolioView";

import "./portfolio.css";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Weddings, portraits, events, and nature — selected work by Hattie's Highlights.",
};

export default function PortfolioPage() {
  return <PortfolioView />;
}
