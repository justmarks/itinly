"use client";

import { useMemo, useState } from "react";
import type { Place } from "@itinly/shared";
import {
  useCreatePlace,
  useDeletePlace,
  useUpdatePlace,
} from "@itinly/api-client";
import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toastMutationError } from "@/lib/api-error";
import { MobileBottomSheet } from "./mobile-bottom-sheet";

/**
 * Mobile parity for the desktop `TripPlaces` panel — per-trip list of
 * points-of-interest the traveller wants to remember. Bottom sheet
 * variant. Reuses the mobile design tokens (`--pin-place`) for the
 * coloured dot so the row, the legend, and the actual map pin all
 * agree on hue.
 *
 * Edit / delete affordances are gated by `canEdit`; view-only viewers
 * still see the list. Pinnable on the full-screen map via
 * `MobileFullMapSheet`, which reads `trip.places` directly.
 */
export function MobilePlacesSheet({
  tripId,
  places,
  canEdit,
  open,
  onClose,
}: {
  tripId: string;
  places: Place[];
  canEdit: boolean;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const createPlace = useCreatePlace(tripId);
  const updatePlace = useUpdatePlace(tripId);
  const deletePlace = useDeletePlace(tripId);

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const sorted = [...places].sort((a, b) => a.sortOrder - b.sortOrder);
    const buckets = new Map<string, Place[]>();
    for (const p of sorted) {
      const key = p.city?.trim() || "";
      const arr = buckets.get(key) ?? [];
      arr.push(p);
      buckets.set(key, arr);
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => {
      if (a === "" && b !== "") return 1;
      if (b === "" && a !== "") return -1;
      return a.localeCompare(b);
    });
  }, [places]);

  return (
    <MobileBottomSheet
      open={open}
      onClose={() => {
        setShowAdd(false);
        setEditingId(null);
        onClose();
      }}
      title="Places to go"
      ariaLabel="Places to go"
    >
      <div className="space-y-3 pb-2">
        <p className="text-xs text-muted-foreground">
          Shops, museums, viewpoints — anything to remember.{" "}
          <span style={{ color: "var(--brand)" }}>Orange pins</span> on the
          map.
        </p>

        {canEdit && !showAdd && editingId === null && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50 active:bg-muted"
          >
            <Plus className="h-4 w-4" />
            Add a place
          </button>
        )}

        {canEdit && showAdd && (
          <PlaceForm
            submitLabel="Add"
            onCancel={() => setShowAdd(false)}
            onSubmit={(input) => {
              const stripNull = (s: string | null): string | undefined =>
                s ?? undefined;
              createPlace.mutate(
                {
                  name: stripNull(input.name),
                  address: stripNull(input.address),
                  url: stripNull(input.url),
                  city: stripNull(input.city),
                  notes: stripNull(input.notes),
                },
                {
                  onSuccess: () => setShowAdd(false),
                  onError: toastMutationError("add place"),
                },
              );
            }}
          />
        )}

        {places.length === 0 && !showAdd ? (
          <div className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            <MapPin className="mx-auto mb-2 h-5 w-5 opacity-40" />
            <p className="font-medium text-foreground">No places yet</p>
            {canEdit && (
              <p className="mt-0.5 text-xs">Tap “Add a place” to start.</p>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {grouped.map(([city, items]) => (
              <li key={city || "__nocity__"}>
                <p className="text-kicker mb-1 text-muted-foreground">
                  {city || "No city"}
                </p>
                <ul className="space-y-2">
                  {items.map((place) =>
                    editingId === place.id ? (
                      <li key={place.id}>
                        <PlaceForm
                          initial={place}
                          submitLabel="Save"
                          onCancel={() => setEditingId(null)}
                          onSubmit={(input) =>
                            updatePlace.mutate(
                              { placeId: place.id, ...input },
                              {
                                onSuccess: () => setEditingId(null),
                                onError: toastMutationError("update place"),
                              },
                            )
                          }
                        />
                      </li>
                    ) : (
                      <PlaceRow
                        key={place.id}
                        place={place}
                        canEdit={canEdit}
                        onEdit={() => setEditingId(place.id)}
                        onDelete={() =>
                          deletePlace.mutate(place.id, {
                            onError: toastMutationError("delete place"),
                          })
                        }
                      />
                    ),
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileBottomSheet>
  );
}

function PlaceRow({
  place,
  canEdit,
  onEdit,
  onDelete,
}: {
  place: Place;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <li className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm">
      <span
        className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: "var(--pin-place)" }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {place.name ?? place.address ?? place.url ?? "(unnamed)"}
        </p>
        {place.address && place.name && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {place.address}
          </p>
        )}
        {place.notes && (
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground/90">
            {place.notes}
          </p>
        )}
        {place.url && (
          <a
            href={place.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{place.url}</span>
          </a>
        )}
      </div>
      {canEdit && (
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit place"
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted active:bg-muted/80"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete place"
            className="flex h-7 w-7 items-center justify-center rounded text-destructive hover:bg-muted active:bg-muted/80"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}

interface PlaceFormValues {
  name: string | null;
  address: string | null;
  url: string | null;
  city: string | null;
  notes: string | null;
}

function PlaceForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Place;
  submitLabel: string;
  onSubmit: (input: PlaceFormValues) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const canSubmit = Boolean(name.trim() || address.trim() || url.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const norm = (s: string): string | null => (s.trim() ? s.trim() : null);
    onSubmit({
      name: norm(name),
      address: norm(address),
      url: norm(url),
      city: norm(city),
      notes: norm(notes),
    });
  };

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-lg border bg-card p-3"
    >
      <p className="text-kicker text-muted-foreground">
        {initial ? "Edit place" : "New place"}
      </p>
      <input
        autoFocus
        placeholder="Name (e.g. Louvre)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        className={inputClass}
      />
      <input
        placeholder="Address (used for the map pin)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        maxLength={500}
        className={inputClass}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={120}
          className={inputClass}
        />
        <input
          placeholder="URL"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={2000}
          className={inputClass}
        />
      </div>
      <textarea
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={2000}
        rows={2}
        className={cn(inputClass, "resize-none")}
      />
      <p className="text-[11px] text-muted-foreground/80">
        Need at least a name, an address, or a URL.
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted active:bg-muted/80"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            canSubmit
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground",
          )}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
