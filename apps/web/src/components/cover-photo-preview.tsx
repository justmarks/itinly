"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { primaryLocationFor, type Trip } from "@itinly/shared";
import { CityHeroImage } from "@/components/city-hero-image";
import {
  flagEmoji,
  gradientFor,
  useCityImageLookup,
} from "@/lib/trip-card-visuals";

/** Wait this long after the last keystroke before looking up a photo. */
const LOOKUP_DEBOUNCE_MS = 500;

/**
 * Live preview of the trip card's hero for the cover-photo picker —
 * shared by the desktop `CoverPhotoDialog` and the mobile edit-trip
 * sheet. Empty `value` previews the automatic pick (title hint +
 * most-days city), so the user can see what "Automatic" means for this
 * trip before deciding to override it.
 */
export function CoverPhotoPreview({
  trip,
  value,
}: {
  trip: Trip;
  value: string;
}): React.JSX.Element {
  const [debounced, setDebounced] = useState(value.trim());
  useEffect(() => {
    const next = value.trim();
    const timer = setTimeout(() => setDebounced(next), LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const location = primaryLocationFor({
    days: trip.days,
    title: trip.title,
    coverLocation: debounced,
  });
  const { image, isLoading } = useCityImageLookup(
    location?.city,
    location?.country,
  );
  const gradient = gradientFor(location?.city ?? trip.title);
  const flag = flagEmoji(location?.countryCode);
  const label = debounced
    ? debounced
    : location
      ? `Automatic · ${location.city}`
      : "Automatic";

  return (
    <div className="space-y-1.5">
      <div
        className="relative h-24 w-full overflow-hidden rounded-lg"
        style={{
          backgroundImage: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
        }}
      >
        {image && <CityHeroImage image={image} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {isLoading && (
          <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-white/80" />
        )}
        <div className="absolute inset-x-3 bottom-2 flex items-center gap-1.5 text-sm font-semibold text-white">
          {flag && <span aria-hidden="true">{flag}</span>}
          <span className="truncate">{label}</span>
        </div>
      </div>
      {debounced && !isLoading && !image && (
        <p className="text-xs" style={{ color: "var(--status-warn-fg)" }}>
          No photo found for “{debounced}”. Try its full name, or add the
          country — e.g. “Granada, Spain”.
        </p>
      )}
    </div>
  );
}
