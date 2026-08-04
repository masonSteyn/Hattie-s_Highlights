import type { AvailabilityBanner as Banner } from "@/lib/types";

/**
 * Site-wide availability line. Off by default; when Hattie flips the toggle in
 * the admin it appears above everything, including the logo.
 *
 * `text` comes from the CMS and is rendered as a text node — never as HTML.
 */
export function AvailabilityBanner({ banner }: { banner: Banner }) {
  if (!banner.enabled || !banner.text.trim()) return null;

  return (
    <div className="banner" role="status">
      {banner.text}
    </div>
  );
}
