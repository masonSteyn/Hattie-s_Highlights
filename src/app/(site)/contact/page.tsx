import type { Metadata } from "next";

import { ContactForm } from "@/components/ContactForm";
import { getBudgetRanges, getContact, getSessionTypes, getSettings } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

import "./contact.css";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Contact",
    description:
      "Tell Hattie about your session — date, location, and what you are after.",
    path: "/contact",
  });
}

export default async function ContactPage() {
  const [copy, sessionTypes, budgetRanges, settings] = await Promise.all([
    getContact(),
    getSessionTypes(),
    getBudgetRanges(),
    getSettings(),
  ]);

  return (
    <div className="contact">
      <header className="pageHead">
        <p className="eyebrow">Say hello</p>
        <h1 className="display pageTitle">{copy.heading}</h1>
        <p className="contactIntro">{copy.intro}</p>
      </header>

      <div className="contactBody">
        <ContactForm
          sessionTypes={sessionTypes}
          budgetRanges={budgetRanges}
          fallbackEmail={settings.business.email}
        />
      </div>
    </div>
  );
}
