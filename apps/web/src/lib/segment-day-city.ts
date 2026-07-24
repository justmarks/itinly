import type { Trip } from "@itinly/shared";
import {
  deriveCityFromForm,
  type SegmentFormState,
} from "@/components/segment-form-fields";

/**
 * Decide whether saving the current segment form should also push a
 * city update onto its destination day. Returns the day mutation
 * payload, or null when no update is warranted.
 *
 * Rules:
 *   - Add: if the destination day has no city yet, set it from the
 *     new segment.
 *   - Edit: if the segment will be the only one on the destination
 *     day after the edit (covers same-day edits where it's already
 *     the lone segment, and cross-day moves into an empty day),
 *     update the day's city to match. Doesn't touch days with other
 *     segments — those have multiple inputs to derive from and the
 *     user might have set the city deliberately.
 *
 * Used by both desktop dialogs and the mobile sheet so the city-from-
 * segment auto-fill is identical across surfaces.
 */
export function computeDayCityUpdateFromSegmentForm(args: {
  trip: Trip | undefined;
  form: SegmentFormState;
  mode: "new" | "edit";
  targetDate: string;
  editSegmentId?: string;
}): { date: string; city: string } | null {
  const { trip, form, mode, targetDate, editSegmentId } = args;
  if (!trip) return null;
  const date = form.date || targetDate;
  const day = trip.days.find((d) => d.date === date);
  if (!day) return null;
  const newCity = deriveCityFromForm(form);
  if (!newCity) return null;

  if (mode === "new") {
    return day.city ? null : { date, city: newCity };
  }

  const willBeOnly =
    day.segments.filter((s) => s.id !== editSegmentId).length === 0;
  if (!willBeOnly) return null;
  if (day.city === newCity) return null;
  return { date, city: newCity };
}
