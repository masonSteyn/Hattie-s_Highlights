import Image from "next/image";
import Link from "next/link";

import logo from "@/../public/logo.png";

/**
 * Desktop-only. The mark spans the full width above the sidebar so it is the
 * first thing the eye lands on. Below 1024px the sticky bar in SiteNav takes
 * over. Priority-loaded because it is above the fold on every route.
 */
export function LogoBand() {
  return (
    <header className="logoBand">
      <Link href="/" aria-label="Hattie's Highlights — home">
        <Image src={logo} alt="Hattie's Highlights" priority sizes="112px" />
      </Link>
    </header>
  );
}
