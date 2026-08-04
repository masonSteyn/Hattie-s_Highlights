import createImageUrlBuilder from "@sanity/image-url";

import { dataset, projectId } from "../../sanity/env";

const builder = createImageUrlBuilder({ projectId, dataset });

/**
 * Sanity's image CDN does the derivative work the brief asks for: `auto=format`
 * negotiates AVIF or WebP per browser and falls back to JPEG, the width is
 * whatever the layout asked for, and the response is cached at the edge.
 *
 * It also re-encodes, which means a served image carries no EXIF even if
 * something ever reached the dataset with metadata intact. The raw asset URL is
 * never rendered anywhere on the site — every image goes through here.
 */
export function imageUrl(source: Parameters<typeof builder.image>[0], width: number, quality = 75) {
  return builder.image(source).width(width).quality(quality).auto("format").url();
}
