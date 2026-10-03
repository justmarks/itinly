"use client";

import { useState } from "react";
import { useTrip, useUpdateTrip } from "@itinly/api-client";
import type { Trip } from "@itinly/shared";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoverPhotoPreview } from "@/components/cover-photo-preview";
import { toastMutationError } from "@/lib/api-error";

/**
 * Desktop picker for the trip card's hero photo (`Trip.coverLocation`).
 * Opened from the trip detail page's overflow menu and the trip-list
 * card's menu. Takes a trip id (the list only holds summaries) and reads
 * the full trip from the query cache, fetching it if needed. Mobile edits
 * the same field inline in `MobileEditTripSheet` — both share
 * `CoverPhotoPreview` so the preview behaves identically.
 */
export function CoverPhotoDialog({
  tripId,
  open,
  onOpenChange,
}: {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open so each open starts from the latest
            cached value rather than a stale draft. */}
        {open && (
          <CoverPhotoLoader
            tripId={tripId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CoverPhotoLoader({
  tripId,
  onDone,
}: {
  tripId: string;
  onDone: () => void;
}): React.JSX.Element {
  const { data: trip, error } = useTrip(tripId);
  if (trip) return <CoverPhotoForm trip={trip} onDone={onDone} />;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Cover photo</DialogTitle>
        <DialogDescription>
          {error ? "Couldn't load this trip." : "Loading trip…"}
        </DialogDescription>
      </DialogHeader>
      {!error && (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
    </>
  );
}

function CoverPhotoForm({
  trip,
  onDone,
}: {
  trip: Trip;
  onDone: () => void;
}): React.JSX.Element {
  const updateTrip = useUpdateTrip(trip.id);
  const [value, setValue] = useState(trip.coverLocation ?? "");
  const trimmed = value.trim();
  const changed = trimmed !== (trip.coverLocation ?? "");

  const save = () => {
    if (!changed) {
      onDone();
      return;
    }
    // Optimistic — the trip list shows the new cover immediately, so
    // close without waiting for the round-trip.
    updateTrip.mutate(
      { coverLocation: trimmed || null },
      { onError: toastMutationError("change cover photo") },
    );
    onDone();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle>Cover photo</DialogTitle>
        <DialogDescription>
          Pick a city or attraction for the trip card&apos;s photo. Leave it
          blank to choose automatically from the itinerary.
        </DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        value={value}
        maxLength={120}
        placeholder="e.g. Alhambra, Granada, or Sagrada Família"
        aria-label="Cover photo city or attraction"
        onChange={(e) => setValue(e.target.value)}
      />
      <CoverPhotoPreview trip={trip} value={value} />
      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={!trimmed}
          onClick={() => setValue("")}
        >
          Use automatic
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </DialogFooter>
    </form>
  );
}
