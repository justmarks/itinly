"use client";

import { useState } from "react";
import { proxiedImageUrl, type CityImage } from "@/lib/trip-card-visuals";

/**
 * Wikipedia hero photo for the trip cards (desktop `TripCard` + mobile
 * `MobileTripHero`) and the cover-photo preview. Renders nothing once
 * every load attempt has failed so the parent's gradient background shows
 * through — a dead URL used to render the browser's broken-image glyph
 * plus the alt text over the hero, duplicating the trip title.
 *
 * Plain <img> rather than next/image: images.unoptimized=true, and
 * next/image's remote-URL handling silently dropped the element in the
 * past.
 *
 * Load attempts, in order, each on the previous one's `error`:
 * 1. `proxy` — same-origin via `/api/wiki-image`. iOS Safari resolved
 *    the Wikipedia URL but couldn't load the image directly in either
 *    mode below; same-origin avoids every cross-origin rule and
 *    Wikimedia throttling of shared client IPs.
 * 2. `cors` — direct, `crossOrigin="anonymous"`. Needed under our
 *    `Cross-Origin-Embedder-Policy: credentialless` on Chromium when the
 *    service worker serves a cached copy (an opaque no-cors response
 *    fails the COEP gate). Wikimedia sends `Access-Control-Allow-Origin: *`.
 * 3. `plain` — direct, no-cors.
 */
type Mode = "proxy" | "cors" | "plain" | "failed";

const NEXT_MODE: Record<Exclude<Mode, "failed">, Mode> = {
  proxy: "cors",
  cors: "plain",
  plain: "failed",
};

export function CityHeroImage({
  image,
  onLoadError,
}: {
  image: CityImage;
  /** Called once when every load attempt has failed (before it unmounts). */
  onLoadError?: (url: string) => void;
}): React.JSX.Element | null {
  const proxied = proxiedImageUrl(image.url);
  const firstMode: Mode = proxied ? "proxy" : "cors";
  // Keyed by URL so a new URL for the same card (city edited, cache
  // refreshed) starts again from the first attempt.
  const [attempt, setAttempt] = useState<{ url: string; mode: Mode }>();
  const mode = attempt?.url === image.url ? attempt.mode : firstMode;
  if (mode === "failed") return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see doc comment above
    <img
      // Remount on mode change so the browser issues a fresh request
      // instead of reusing the failed one.
      key={mode}
      src={mode === "proxy" && proxied ? proxied : image.url}
      // Decorative — the trip title is already overlaid on the hero, so a
      // non-empty alt just makes screen readers say it twice.
      alt=""
      loading="lazy"
      crossOrigin={mode === "cors" ? "anonymous" : undefined}
      onError={() => {
        const next = NEXT_MODE[mode];
        console.warn(
          `[trip-card-visuals] hero image ${mode} load failed${
            next === "failed" ? "" : `, trying ${next}`
          }: ${image.url}`,
        );
        setAttempt({ url: image.url, mode: next });
        if (next === "failed") onLoadError?.(image.url);
      }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
