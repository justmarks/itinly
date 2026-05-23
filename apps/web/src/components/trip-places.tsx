"use client";

import { useMemo, useState } from "react";
import type { Place } from "@itinly/shared";
import {
  useCreatePlace,
  useDeletePlace,
  useUpdatePlace,
} from "@itinly/api-client";
import { ExternalLink, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { toastMutationError } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Desktop "Places to go" panel — per-trip list of points-of-interest
 * the traveller wants to remember but hasn't scheduled.
 *
 * Mirrors the to-do panel's shape (add row → grouped list → optimistic
 * mutations) but with the place-specific fields (name / address / url /
 * city / notes). Pinnable on the Map view via the `place` pin category
 * — `MapView` reads `trip.places` directly, so changes here propagate
 * automatically.
 */
export function TripPlaces({
  tripId,
  places,
  readOnly = false,
}: {
  tripId: string;
  places: Place[];
  readOnly?: boolean;
}): React.JSX.Element {
  const createPlace = useCreatePlace(tripId);
  const updatePlace = useUpdatePlace(tripId);
  const deletePlace = useDeletePlace(tripId);

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Group places by city so a long list stays readable on multi-city trips.
  // Places without a city collapse into an "Unscheduled" bucket at the end.
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
      // Empty (no city) goes last
      if (a === "" && b !== "") return 1;
      if (b === "" && a !== "") return -1;
      return a.localeCompare(b);
    });
  }, [places]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Places to go</h2>
          <p className="text-sm text-muted-foreground">
            Points of interest you want to remember — no date needed. They
            show up as <span style={{ color: "var(--brand)" }}>orange pins</span>
            {" "}on the Map tab.
          </p>
        </div>
        {!readOnly && !showAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add place
          </Button>
        )}
      </div>

      {!readOnly && showAdd && (
        <PlaceForm
          submitLabel="Add place"
          onCancel={() => setShowAdd(false)}
          onSubmit={(input) => {
            // Create rejects `null` per Zod — drop empties to undefined.
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
        <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          <MapPin className="mx-auto mb-2 h-6 w-6 opacity-40" />
          <p className="font-medium text-foreground">No places yet</p>
          <p className="mt-0.5">
            Save shops, museums, viewpoints, neighbourhoods — anything you want
            to remember to visit.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([city, items]) => (
            <div key={city || "__nocity__"}>
              <h3 className="text-kicker mb-1.5 text-muted-foreground">
                {city || "No city"}
              </h3>
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
                      readOnly={readOnly}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceRow({
  place,
  readOnly,
  onEdit,
  onDelete,
}: {
  place: Place;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <li className="group flex items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: "var(--pin-place)" }}
            aria-hidden
          />
          <p className="truncate font-medium">
            {place.name ?? place.address ?? place.url ?? "(unnamed)"}
          </p>
        </div>
        {place.address && place.name && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {place.address}
          </p>
        )}
        {place.notes && (
          <p className="mt-1 text-xs text-muted-foreground/90">{place.notes}</p>
        )}
        {place.url && (
          <a
            href={place.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="max-w-[260px] truncate">{place.url}</span>
          </a>
        )}
      </div>
      {!readOnly && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onEdit}
            aria-label="Edit place"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete place"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}

/**
 * Form-value shape that fits BOTH create and update payloads:
 * - On create, the server's Zod schema strips `undefined` and rejects
 *   `null`. The form replaces null with undefined before forwarding.
 * - On update, the server treats `null` as "clear this field". The
 *   form keeps null as-is.
 */
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

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border bg-card p-4 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {initial ? "Edit place" : "Add a place"}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onCancel}
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Input
        autoFocus
        placeholder="Name (e.g. Louvre, Shibuya Crossing)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
      />
      <Input
        placeholder="Address (used for the map pin)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        maxLength={500}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="City (optional)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={120}
        />
        <Input
          placeholder="URL (optional)"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={2000}
        />
      </div>
      <Input
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={2000}
      />
      <p
        className={cn(
          "text-xs",
          canSubmit ? "text-muted-foreground/70" : "text-muted-foreground",
        )}
      >
        At least one of name, address, or URL is required.
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
