import { orderableDocumentListDeskItem } from "@sanity/orderable-document-list";
import type { StructureResolver } from "sanity/structure";

/**
 * The Studio's navigation, built around one observation: Hattie will use "add a
 * photo" hundreds of times and "edit a meta description" perhaps twice.
 *
 * So the sidebar opens on four things — photos, the home page, the availability
 * banner, and what she sells — and everything else is folded behind Settings.
 * A dashboard with thirty equally-weighted entries is one she stops opening.
 */
type OrderableArgs = { type: string; title: string; id: string };

export const structure: StructureResolver = (S, context) => {
  const orderable = (args: OrderableArgs) =>
    orderableDocumentListDeskItem({ ...args, S, context });

  return S.list()
    .title("Hattie's Highlights")
    .items([
      /* ── Weekly ─────────────────────────────────────────────────────── */

      // Drag to reorder. The order set here is the order they appear on the
      // site, so arranging the gallery is done by moving photos around rather
      // than by typing numbers into a field.
      orderable({
        type: "photo",
        title: "Photos",
        id: "orderable-photos",
      }),

      S.listItem()
        .title("Home page")
        .id("homePage")
        .child(S.document().schemaType("homePage").documentId("homePage")),

      S.listItem()
        .title("Availability banner")
        .id("availability")
        .child(
          S.document()
            .schemaType("siteSettings")
            .documentId("siteSettings")
            .title("Availability banner")
            // Opens straight onto the banner rather than the full settings form.
            .views([S.view.form()]),
        ),

      orderable({
        type: "sessionType",
        title: "Sessions & prices",
        id: "orderable-session-types",
      }),

      S.divider(),

      /* ── Occasional ─────────────────────────────────────────────────── */

      S.listItem()
        .title("About page")
        .id("aboutPage")
        .child(S.document().schemaType("aboutPage").documentId("aboutPage")),

      orderable({
        type: "category",
        title: "Categories",
        id: "orderable-categories",
      }),

      S.divider(),

      /* ── Set once ───────────────────────────────────────────────────── */

      S.listItem()
        .title("Settings")
        .id("settings")
        .child(
          S.list()
            .title("Settings")
            .items([
              S.listItem()
                .title("Business details & search")
                .id("siteSettings")
                .child(S.document().schemaType("siteSettings").documentId("siteSettings")),
              S.listItem()
                .title("Booking page text")
                .id("bookingPage")
                .child(S.document().schemaType("bookingPage").documentId("bookingPage")),
              S.listItem()
                .title("Contact page & auto-reply")
                .id("contactPage")
                .child(S.document().schemaType("contactPage").documentId("contactPage")),
              S.listItem()
                .title("Privacy & terms")
                .id("legalPages")
                .child(S.documentTypeList("legalPage").title("Privacy & terms")),
            ]),
        ),
    ]);
};

/**
 * Singletons must not be creatable or deletable from the "create new" menu —
 * two "Home page" documents is a confusing state with no way back for someone
 * who does not know what a document id is.
 */
export const SINGLETONS = [
  "homePage",
  "aboutPage",
  "bookingPage",
  "contactPage",
  "siteSettings",
] as const;
