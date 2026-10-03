import type { SegmentUpdate } from "@itinly/api-client";

/**
 * Turn an edit form's patch into the wire format: every field the form
 * left empty (`undefined`) becomes `null`, which the server treats as
 * "clear this field". Left as `undefined`, `JSON.stringify` would drop the
 * key and the server would keep the old value — the user's cleared
 * address (or URL, confirmation code, seat, …) would reappear on the next
 * refetch.
 *
 * Only use this for edit forms that send every field they show: a key
 * that's absent from `updates` is still "no change".
 */
export function clearEmptySegmentFields(
  updates: Record<string, unknown>,
): SegmentUpdate {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    result[key] = value === undefined ? null : value;
  }
  return result as SegmentUpdate;
}
