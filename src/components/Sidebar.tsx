"use client";

import { Mail, Menu, Settings, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useCallback, useRef, useState } from "react";

import { Facebook, Instagram } from "@/components/BrandIcons";
import { useDialog } from "@/lib/useDialog";
import logo from "@/../public/logo.png";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
  { href: "/booking", label: "Booking" },
  { href: "/contact", label: "Contact" },
];

type IconComponent = ComponentType<{
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true" | "false";
}>;

const ICONS: Record<string, IconComponent> = {
  Instagram,
  Facebook,
  Email: Mail,
};

type Social = { label: string; href: string };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Primary">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="navLink"
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The way in to the admin.
 *
 * A small settings icon sitting under the social row, separated by a hairline.
 * It is deliberately quiet rather than hidden: a visitor reads it as a site
 * detail and ignores it, but Hattie can always find her way back in without
 * having to remember a URL — which is the failure mode that matters for
 * someone who edits the site once a fortnight.
 *
 * It is not a security boundary. What actually protects /settings is the
 * password on it; the route is also noindex + nofollow, so it stays out of
 * search results whether it is linked from here or not.
 *
 * prefetch is off: /settings has its own root layout, so following this link is a
 * full page load regardless, and prefetching would pull the entire editor
 * bundle onto every page of the public site.
 */
function AdminLink({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="adminRow">
      <Link
        className="adminLink"
        href="/settings"
        prefetch={false}
        aria-label="Site admin — edit photos and text"
        title="Edit the site"
        onClick={onNavigate}
      >
        <Settings size={15} strokeWidth={1.25} aria-hidden="true" />
      </Link>
    </div>
  );
}

function SocialRow({ social }: { social: Social[] }) {
  return (
    <ul className="social">
      {social.map((item) => {
        const Icon = ICONS[item.label] ?? Mail;
        return (
          <li key={item.label}>
            <a
              className="socialLink"
              href={item.href}
              aria-label={item.label}
              {...(item.href.startsWith("http")
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {/* Consistent 1.25 stroke across every icon on the site. */}
              <Icon size={18} strokeWidth={1.25} aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({ social }: { social: Social[] }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Every link in the panel calls this on tap, which is what closes the drawer
  // on navigation. Doing it from a pathname effect instead would fire a second
  // render pass for the same outcome.
  const close = useCallback(() => setOpen(false), []);

  // Scroll lock, focus trap, Escape, and focus restore — see useDialog.
  useDialog({ open, ref: drawerRef, onClose: close });

  return (
    <>
      {/* Mobile: sticky bar. The hamburger is absolutely positioned so the logo
          stays centred in the viewport rather than in the leftover space. */}
      <div className="mobileBar">
        <button
          ref={triggerRef}
          type="button"
          className="hamburger"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-drawer"
          onClick={() => setOpen(true)}
        >
          <Menu size={22} strokeWidth={1.25} aria-hidden="true" />
        </button>
        <Link href="/" aria-label="Hattie's Highlights — home">
          <Image src={logo} alt="Hattie's Highlights" priority sizes="52px" />
        </Link>
      </div>

      <div
        className="scrim"
        data-open={open}
        onClick={close}
        aria-hidden="true"
      />

      <div
        id="mobile-drawer"
        ref={drawerRef}
        className="drawer"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        // Fully removed from the tab order when closed, so a keyboard user on
        // desktop never lands in an off-screen panel.
        inert={!open}
      >
        <button
          type="button"
          className="drawerClose"
          aria-label="Close menu"
          onClick={close}
        >
          <X size={22} strokeWidth={1.25} aria-hidden="true" />
        </button>
        <Nav onNavigate={close} />
        <SocialRow social={social} />
        <AdminLink onNavigate={close} />
      </div>

      {/* Desktop: the persistent column. */}
      <aside className="sidebar">
        <Nav />
        <SocialRow social={social} />
        <AdminLink />
      </aside>
    </>
  );
}
