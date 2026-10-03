"use client";

import { useState } from "react";
import type { CityImage } from "@/lib/trip-card-visuals";

/**
 * Wikipedia hero photo for the trip cards (desktop `TripCard` + mobile
 * `MobileTripHero`). Renders nothing once the image fails to load so the
 * parent's gradient background shows through — without this, a dead
 * thumbnail URL (Wikimedia 4xx / rate limit, offline with no cached copy)
 * rendered the browser's broken-image glyph plus the alt text over the
 * hero, duplicating the trip title.
 *
 * Wikipedia thumbnails come from upload.wikimedia.org and don't benefit
 * from Next/Image optimisation (images.unoptimized=true). Plain <img>
 * keeps the layout predictable and avoids the cases where next/image's
 * remote-URL handling silently drops the element.
 *
 * `crossOrigin="anonymous"` is required by our
 * `Cross-Origin-Embedder-Policy: credentialless` header — without it the
 * browser fetches the image as `no-cors` opaque and the service worker's
 * cached response then fails the COEP gate ("Cross-Origin-Resource-Policy
 * prevented from serving the response to the client"). Wikimedia replies
 * with `Access-Control-Allow-Origin: *` on CORS requests, so the
 * anonymous mode works without credentials.
 */
export function CityHeroImage({
  image,
}: {
  image: CityImage;
}): React.JSX.Element | null {
  // Track the failed URL rather than a boolean so a new URL for the same
  // card (city edited, cache refreshed) gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  if (failedUrl === image.url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see doc comment above
    <img
      src={image.url}
      // Decorative — the trip title is already overlaid on the hero, so a
      // non-empty alt just makes screen readers say it twice.
      alt=""
      loading="lazy"
      crossOrigin="anonymous"
      onError={() => {
        console.warn(`[trip-card-visuals] hero image failed to load: ${image.url}`);
        setFailedUrl(image.url);
      }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
