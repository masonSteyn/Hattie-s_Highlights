/**
 * Root layout for the admin surface.
 *
 * The Studio is a full-screen application and must not inherit the site's
 * sidebar, banner, fonts, or reset — so /studio lives in its own route group
 * with its own <html>, rather than being nested inside the public layout.
 */
export const metadata = {
  title: "Hattie's Highlights — admin",
  robots: { index: false, follow: false },
};

export default function StudioRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
