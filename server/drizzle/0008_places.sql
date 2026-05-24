-- ─── Add `places` table for the "Places to go" feature ──────────────────
--
-- Per-trip list of points-of-interest the traveller wants to remember
-- but hasn't scheduled into a day or segment. Distinct from todos
-- (action) and segments (date + time bound). Pinnable on the Map view.
--
-- Cascade-delete with the parent trip mirrors the segments / todos FK
-- behaviour — removing a trip removes its places automatically.
--
-- RLS: `user_id` is denormalised from the parent trip so the owner-only
-- policy can use a single-column equality check. Wrapped in the same
-- `IF EXISTS authenticated` guard as the other user-scoped tables so
-- the vanilla-Postgres integration test runner can run the migration
-- without the Supabase `authenticated` role + `auth.uid()` function
-- being present. See `0004_email_scan_rls.sql` and CLAUDE.md for the
-- canonical pattern.
--
-- `trips.schema_version` default also bumps from 2 → 3 so freshly
-- inserted trips carry the latest version without the migrateTrip read
-- path having to backfill the row. Existing rows stay at their current
-- version; `migrateTrip` lifts them on read.

CREATE TABLE "places" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"address" text,
	"url" text,
	"city" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "places_trip_order_idx" ON "places" USING btree ("trip_id","sort_order");
--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "schema_version" SET DEFAULT 3;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'ALTER TABLE "places" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "places_owner_rw" ON "places"';
    EXECUTE $policy$
      CREATE POLICY "places_owner_rw" ON "places"
        FOR ALL
        TO authenticated
        USING (auth.uid()::text = user_id)
        WITH CHECK (auth.uid()::text = user_id)
    $policy$;
  END IF;
END $$;
