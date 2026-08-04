import type { SchemaTypeDefinition } from "sanity";

import { aboutPage } from "./documents/aboutPage";
import { bookingPage } from "./documents/bookingPage";
import { category } from "./documents/category";
import { contactPage } from "./documents/contactPage";
import { homePage } from "./documents/homePage";
import { legalPage } from "./documents/legalPage";
import { photo } from "./documents/photo";
import { sessionType } from "./documents/sessionType";
import { siteSettings } from "./documents/siteSettings";
import { photoImage } from "./objects/photoImage";
import { seo } from "./objects/seo";

export const schemaTypes: SchemaTypeDefinition[] = [
  photo,
  category,
  sessionType,
  homePage,
  aboutPage,
  bookingPage,
  contactPage,
  legalPage,
  siteSettings,
  photoImage,
  seo,
];
