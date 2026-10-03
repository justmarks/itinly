-- ─── Add `trips.cover_location` ──────────────────────────────────────────
--
-- User-chosen subject for the trip card's hero photo: a city ("Granada")
-- or an attraction ("Alhambra"). NULL means automatic — the trip list
-- derives the hero from the itinerary's cities (see `primaryLocationFor`
-- in packages/shared). Nullable with no default, so adding it is a
-- metadata-only change and existing rows stay automatic.
--
-- No RLS changes: `trips` already has its owner-only policy.

ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "cover_location" text;
