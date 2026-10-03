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
 * First attempt uses `crossOrigin="anonymous"`, which our
 * `Cross-Origin-Embedder-Policy: credentialless` header needs on
 * Chromium: without it the browser fetches the image as `no-cors` opaque
 * and the service worker's cached response then fails the COEP gate
 * ("Cross-Origin-Resource-Policy prevented from serving the response to
 * the client"). Wikimedia replies with `Access-Control-Allow-Origin: *`
 * on CORS requests, so the anonymous mode works without credentials.
 *
 * iOS Safari was seen failing that CORS load for a URL the lookup had
 * resolved fine, so on error we retry once as a plain (no-cors) image
 * before giving up — whichever mode the browser accepts wins.
 */
export function CityHeroImage({
  image,
  onLoadError,
}: {
  image: CityImage;
  /** Called once when every load attempt has failed (before it unmounts). */
  onLoadError?: (url: string) => void;
}): React.JSX.Element | null {
  // Keyed by URL so a new URL for the same card (city edited, cache
  // refreshed) starts again from the CORS attempt.
  const [attempt, setAttempt] = useState<{
    url: string;
    mode: "plain" | "failed";
  }>();
  const mode = attempt?.url === image.url ? attempt.mode : "cors";
  if (mode === "failed") return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see doc comment above
    <img
      // Remount on mode change so the browser issues a fresh request
      // instead of reusing the failed one.
      key={mode}
      src={image.url}
      // Decorative — the trip title is already overlaid on the hero, so a
      // non-empty alt just makes screen readers say it twice.
      alt=""
      loading="lazy"
      crossOrigin={mode === "cors" ? "anonymous" : undefined}
      onError={() => {
        if (mode === "cors") {
          console.warn(
            `[trip-card-visuals] CORS load failed, retrying as plain image: ${image.url}`,
          );
          setAttempt({ url: image.url, mode: "plain" });
          return;
        }
        console.warn(`[trip-card-visuals] hero image failed to load: ${image.url}`);
        setAttempt({ url: image.url, mode: "failed" });
        onLoadError?.(image.url);
      }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
