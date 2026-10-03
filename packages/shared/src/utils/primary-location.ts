/**
 * Determine the "primary" location for a trip — the city where the user
 * spends the most days. Used by the trip-card UI to pick a hero image and
 * country flag without scanning every segment in the client.
 *
 * Tie-break: earliest first appearance in `trip.days`. Empty cities and
 * "at sea" cruise days are skipped (they don't represent a place to image).
 */

import type { Trip, TripDay } from "../types/trip";
import { AIRPORTS } from "./airports-data";

export interface PrimaryLocation {
  /**
   * Display label for the trip's hero. Usually a city, but for cruise-
   * dominant trips this is the ship name (e.g. "Disney Fantasy") so the
   * UI can pull a recognisable picture of the ship rather than a forgettable
   * port photo.
   */
  city: string;
  /** ISO 3166-1 alpha-2 country code, when known. Undefined for cruise ships. */
  countryCode?: string;
  /** Human-readable country name, when known. Undefined for cruise ships. */
  country?: string;
  /** Number of trip days this location/ship covers. */
  dayCount: number;
  /**
   * What kind of subject `city` refers to. The UI uses this to skip
   * country-flag rendering for ships and to relax the "Untitled
   * destination" copy when a ship has no flag. `"cover"` means the user
   * picked the subject themselves (`Trip.coverLocation`) — a city or an
   * attraction such as "Alhambra".
   */
  kind: "city" | "cruise" | "cover";
}

/** Lowercase + strip diacritics. Used internally for map lookups. */
function fold(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Normalise a city string for lookup: fold + take the first comma-separated
 * part. "Reykjavík" → "reykjavik"; "Orlando, FL" → "orlando". Returns "" for
 * skip-worthy entries (empty / "at sea" cruise days). Slashes are kept as
 * part of the key (so transfer-day strings stay distinct) — see
 * `normalizeCities` for the per-city split.
 */
function normalizeCity(raw: string): string {
  if (!raw) return "";
  const folded = fold(raw);
  if (!folded || folded === "at sea") return "";
  const head = folded.split(",")[0]?.trim() ?? folded;
  return head;
}

/**
 * Normalise a city string into one entry per city. Transfer days encoded
 * with a slash ("Paris / Rome", "Tokyo/Kyoto") count toward each city's
 * tally. For non-slash inputs the result is a single-element array
 * equivalent to `normalizeCity`. The original (trimmed) part is preserved
 * as `display` so casing and diacritics survive into the trip card.
 */
function normalizeCities(
  raw: string,
): Array<{ key: string; display: string }> {
  if (!raw) return [];
  const hasSlash = raw.includes("/");
  // Without a slash, treat the whole string as one city so "Orlando, FL"
  // keeps its original display form (matches pre-slash behaviour).
  const parts = hasSlash
    ? raw
        .split("/")
        .map((p) => p.trim())
        .filter(Boolean)
    : [raw];
  return parts
    .map((part) => {
      const folded = fold(part);
      if (!folded || folded === "at sea") return null;
      const head = folded.split(",")[0]?.trim() ?? folded;
      return head ? { key: head, display: part } : null;
    })
    .filter((x): x is { key: string; display: string } => x !== null);
}

/**
 * Country lookup keyed by normalised city name. Kept intentionally small —
 * extend as new destinations show up in real trips. Cities not in the map
 * still produce a valid `PrimaryLocation` (just without country data), so the
 * UI can fall back to a name-only / gradient hero.
 */
const CITY_TO_COUNTRY: Record<string, { code: string; name: string }> = {
  // Japan
  tokyo: { code: "JP", name: "Japan" },
  kyoto: { code: "JP", name: "Japan" },
  osaka: { code: "JP", name: "Japan" },
  nara: { code: "JP", name: "Japan" },
  hiroshima: { code: "JP", name: "Japan" },
  hakone: { code: "JP", name: "Japan" },
  nikko: { code: "JP", name: "Japan" },
  yokohama: { code: "JP", name: "Japan" },

  // France
  paris: { code: "FR", name: "France" },
  nice: { code: "FR", name: "France" },
  lyon: { code: "FR", name: "France" },
  marseille: { code: "FR", name: "France" },

  // Iceland
  reykjavik: { code: "IS", name: "Iceland" },
  selfoss: { code: "IS", name: "Iceland" },
  vik: { code: "IS", name: "Iceland" },
  akureyri: { code: "IS", name: "Iceland" },

  // United States
  "new york": { code: "US", name: "United States" },
  nyc: { code: "US", name: "United States" },
  seattle: { code: "US", name: "United States" },
  orlando: { code: "US", name: "United States" },
  "port canaveral": { code: "US", name: "United States" },
  "san francisco": { code: "US", name: "United States" },
  "los angeles": { code: "US", name: "United States" },
  chicago: { code: "US", name: "United States" },
  boston: { code: "US", name: "United States" },
  miami: { code: "US", name: "United States" },

  // United Kingdom
  london: { code: "GB", name: "United Kingdom" },
  edinburgh: { code: "GB", name: "United Kingdom" },

  // Italy
  rome: { code: "IT", name: "Italy" },
  florence: { code: "IT", name: "Italy" },
  venice: { code: "IT", name: "Italy" },
  milan: { code: "IT", name: "Italy" },

  // Spain
  barcelona: { code: "ES", name: "Spain" },
  madrid: { code: "ES", name: "Spain" },

  // Germany
  berlin: { code: "DE", name: "Germany" },
  munich: { code: "DE", name: "Germany" },

  // Netherlands
  amsterdam: { code: "NL", name: "Netherlands" },

  // Bahamas (cruise stops)
  nassau: { code: "BS", name: "Bahamas" },
  "castaway cay": { code: "BS", name: "Bahamas" },

  // A few more popular destinations — extend as needed.
  bangkok: { code: "TH", name: "Thailand" },
  singapore: { code: "SG", name: "Singapore" },
  "hong kong": { code: "HK", name: "Hong Kong" },
  seoul: { code: "KR", name: "South Korea" },
  sydney: { code: "AU", name: "Australia" },
  melbourne: { code: "AU", name: "Australia" },
  dubai: { code: "AE", name: "United Arab Emirates" },
  istanbul: { code: "TR", name: "Türkiye" },
  lisbon: { code: "PT", name: "Portugal" },
  mexico: { code: "MX", name: "Mexico" },
  toronto: { code: "CA", name: "Canada" },
  vancouver: { code: "CA", name: "Canada" },
};

/**
 * Look up country info for a (potentially comma-suffixed, accented) city.
 * Falls back to matching the part *after* the first comma — handles
 * "Castaway Cay, Bahamas" when only "bahamas" is in the table by extension.
 */
function lookupCountry(rawCity: string): { code: string; name: string } | undefined {
  const head = normalizeCity(rawCity);
  if (!head) return undefined;
  const direct = CITY_TO_COUNTRY[head];
  if (direct) return direct;
  // Fallback: try the suffix (e.g. "Castaway Cay, Bahamas" → "bahamas").
  const parts = fold(rawCity)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts.slice(1)) {
    if (CITY_TO_COUNTRY[part]) return CITY_TO_COUNTRY[part];
    // "Granada, Nicaragua" / "Alhambra, Spain" — the suffix is a country.
    const byName = countryNameEntries().find(([name]) => name === part);
    if (byName) {
      const name = countryName(byName[1]);
      if (name) return { code: byName[1], name };
    }
  }
  // Last resort: the airport dataset covers every city with a large
  // airport ("San Juan" → PR, "Seville" → ES). Gives the trip card a flag
  // and lets the hero-image search disambiguate ("San Juan Puerto Rico"
  // instead of the "San Juan" disambiguation page).
  const code = airportCityCountries().get(head);
  if (code) {
    const name = countryName(code);
    if (name) return { code, name };
  }
  return undefined;
}

let airportCityCountryCache: Map<string, string> | undefined;

/**
 * Normalised city → ISO country code, built from `AIRPORTS`. Cities whose
 * name maps to airports in more than one country ("Valencia" → ES and VE)
 * are dropped — guessing would put the wrong flag on the card.
 */
function airportCityCountries(): Map<string, string> {
  if (airportCityCountryCache) return airportCityCountryCache;
  const byCity = new Map<string, string | null>();
  for (const { city, country } of Object.values(AIRPORTS)) {
    const key = normalizeCity(city);
    if (!key) continue;
    const prev = byCity.get(key);
    if (prev === undefined) byCity.set(key, country);
    else if (prev !== country) byCity.set(key, null);
  }
  const result = new Map<string, string>();
  for (const [key, country] of byCity) {
    if (country) result.set(key, country);
  }
  airportCityCountryCache = result;
  return result;
}

/** ISO alpha-2 → English country name ("PR" → "Puerto Rico"). */
function countryName(code: string): string | undefined {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    return name && name !== code ? name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Cruise titles in this app commonly read "Ship Name — descriptor",
 * "Ship Name · descriptor", or "Ship Name – descriptor" — split on the
 * first such separator and trim. Some real ship names contain hyphens
 * (e.g. "Norwegian Pearl-Star"), so unspaced `-` is intentionally NOT a
 * separator here.
 */
function extractShipName(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const match = title.match(/^(.*?)\s*[—·–]\s/u);
  const head = (match ? match[1] : title).trim();
  return head || undefined;
}

/**
 * Look for a cruise segment that dominates the trip and return it as the
 * "primary location" (using the ship name) when it covers at least half
 * the trip's days. Without this, the cruise's embarkation port wins the
 * city tally and the user gets a picture of Port Canaveral instead of
 * the Disney Fantasy.
 *
 * Coverage = inclusive count of trip days from the day where the cruise
 * segment lives through `segment.endDate`. Cruise segments without an
 * `endDate` are skipped (we can't tell how long they last).
 */
function findCruiseLocation(trip: Pick<Trip, "days">): PrimaryLocation | undefined {
  if (trip.days.length === 0) return undefined;
  const dateIndex = new Map<string, number>();
  trip.days.forEach((d, i) => dateIndex.set(d.date, i));

  let best: { name: string; coverage: number } | undefined;
  trip.days.forEach((day: TripDay, dayIdx: number) => {
    for (const seg of day.segments) {
      if (seg.type !== "cruise") continue;
      if (!seg.endDate) continue;
      const endIdx = dateIndex.get(seg.endDate);
      if (endIdx === undefined || endIdx < dayIdx) continue;
      const coverage = endIdx - dayIdx + 1;
      const name = extractShipName(seg.title);
      if (!name) continue;
      if (!best || coverage > best.coverage) {
        best = { name, coverage };
      }
    }
  });

  if (!best) return undefined;
  // Require the cruise to cover at least half the trip to take precedence
  // over city-based aggregation. A 2-night cruise on a 10-day trip
  // shouldn't replace the rest of the itinerary's hero.
  if (best.coverage * 2 < trip.days.length) return undefined;
  return { city: best.name, dayCount: best.coverage, kind: "cruise" };
}

/**
 * Identify a "home" bookend city. The user's home is the place they depart
 * from on day 1 and return to on the last day — encoded in transfer-day
 * notation as the FIRST city of the first day's slash list, and the LAST
 * city of the last day's slash list. When those match, that city is the
 * user's home origin/return point and gets excluded from the destination
 * tally. Returns the set of keys to exclude (size 0 or 1 in practice).
 *
 * Examples:
 *   - "Seattle" → "Seattle"                       → bookend = {seattle}
 *   - "Seattle / New York" → "New York / Seattle" → bookend = {seattle}
 *   - "Seattle" → "Munich / Seattle"              → bookend = {seattle}
 *   - "Seattle / Paris" → "Rome / Seattle"        → bookend = {seattle}
 *   - "Seattle" → "Paris"                         → bookend = {} (no match)
 *   - 1-day trips                                 → bookend = {} (no pattern)
 */
function findBookendKeys(trip: Pick<Trip, "days">): Set<string> {
  let firstDay: TripDay | undefined;
  let lastDay: TripDay | undefined;
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < trip.days.length; i++) {
    if (normalizeCities(trip.days[i].city).length === 0) continue;
    if (!firstDay) {
      firstDay = trip.days[i];
      firstIdx = i;
    }
    lastDay = trip.days[i];
    lastIdx = i;
  }
  if (!firstDay || !lastDay || firstIdx === lastIdx) return new Set();

  const firstCities = normalizeCities(firstDay.city);
  const lastCities = normalizeCities(lastDay.city);
  // First slash part of the first day = where the trip departs from.
  // Last slash part of the last day = where the trip returns to.
  const departureHome = firstCities[0]?.key;
  const returnHome = lastCities[lastCities.length - 1]?.key;
  if (!departureHome || !returnHome) return new Set();
  if (departureHome !== returnHome) return new Set();
  return new Set([departureHome]);
}

/**
 * Pick the most representative location for a trip's hero image. A
 * user-chosen `coverLocation` (city or attraction) always wins. Otherwise,
 * for cruise-dominant trips this is the ship name; otherwise it's the city
 * the user spends the most days in — limited to the cities the trip title
 * names (directly or via their country) when it names any. Returns
 * `undefined` for trips with no usable data (all empty / all "at sea"
 * with no cruise segment) and no cover location.
 *
 * Cities are grouped by their normalised form so "Reykjavík" and "Reykjavik"
 * are treated as the same place; the displayed `city` is taken from the
 * first day in that group (preserving the user's original casing/diacritics).
 *
 * Refinements beyond pure day-count:
 * 1. Transfer days encoded as "Paris / Rome" count toward each city
 *    individually (see `normalizeCities`).
 * 2. If the first and last days of the trip share the same city, that
 *    city is treated as a bookend "home" and excluded from the tally —
 *    so a SEA → Europe → SEA itinerary picks the European primary, not
 *    the airport you started and ended at. The exclusion is dropped
 *    automatically if it would leave the trip with no candidates (e.g.
 *    a local Seattle staycation), in which case the bookend wins as
 *    primary after all.
 * 3. Title hint — see `filterByTitleHint`.
 */
export function primaryLocationFor(
  trip: Pick<Trip, "days"> & Partial<Pick<Trip, "title" | "coverLocation">>,
): PrimaryLocation | undefined {
  const automatic = automaticLocationFor(trip);
  const cover = trip.coverLocation?.trim();
  if (!cover) return automatic;

  // An attraction ("Alhambra") won't resolve to a country on its own, so
  // borrow the automatic pick's — the user chose a subject inside the
  // trip, so that's the best guess for the flag.
  const country =
    lookupCountry(cover) ??
    (automatic?.countryCode && automatic.country
      ? { code: automatic.countryCode, name: automatic.country }
      : undefined);
  return {
    city: cover,
    countryCode: country?.code,
    country: country?.name,
    dayCount: 0,
    kind: "cover",
  };
}

function automaticLocationFor(
  trip: Pick<Trip, "days"> & Partial<Pick<Trip, "title">>,
): PrimaryLocation | undefined {
  const cruise = findCruiseLocation(trip);
  if (cruise) return cruise;

  const bookendKeys = findBookendKeys(trip);

  const tally = (excludeBookend: boolean) => {
    const groups = new Map<
      string,
      { display: string; count: number; firstIndex: number }
    >();
    trip.days.forEach((day: TripDay, idx: number) => {
      for (const { key, display } of normalizeCities(day.city)) {
        if (excludeBookend && bookendKeys.has(key)) continue;
        const existing = groups.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          groups.set(key, { display, count: 1, firstIndex: idx });
        }
      }
    });
    return groups;
  };

  let groups = tally(true);
  if (groups.size === 0 && bookendKeys.size > 0) {
    // The trip has nothing but the bookend city — local/staycation pattern.
    // Fall back to including the bookend so the card shows that city.
    groups = tally(false);
  }
  if (groups.size === 0) return undefined;

  // Title hint: "Spain December 2026" with more days in London (a
  // stopover) should still pick a Spanish city. When the title names a
  // country or one of the trip's cities, only those candidates compete.
  // Titles that name nothing we recognise leave the tally untouched.
  const hinted = filterByTitleHint(groups, trip.title);
  if (hinted.size > 0) groups = hinted;

  // Highest count, tie-break on earliest first appearance.
  let winner: { display: string; count: number; firstIndex: number } | undefined;
  for (const group of groups.values()) {
    if (
      !winner ||
      group.count > winner.count ||
      (group.count === winner.count && group.firstIndex < winner.firstIndex)
    ) {
      winner = group;
    }
  }
  if (!winner) return undefined;

  const country = lookupCountry(winner.display);
  return {
    city: winner.display,
    countryCode: country?.code,
    country: country?.name,
    dayCount: winner.count,
    kind: "city",
  };
}

/** Folded title padded with spaces, punctuation → spaces, for word matching. */
function titleWords(title: string): string {
  return ` ${fold(title).replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function titleMentions(words: string, phrase: string): boolean {
  const needle = fold(phrase).replace(/[^a-z0-9]+/g, " ").trim();
  return needle.length > 0 && words.includes(` ${needle} `);
}

function filterByTitleHint<G>(
  groups: Map<string, G & { display: string }>,
  title: string | undefined,
): Map<string, G & { display: string }> {
  const result = new Map<string, G & { display: string }>();
  if (!title) return result;
  const words = titleWords(title);
  const titleCountries = new Set(
    countryNameEntries()
      .filter(([name]) => titleMentions(words, name))
      .map(([, code]) => code),
  );
  for (const [key, group] of groups) {
    const mentionsCity = titleMentions(words, key);
    const code = lookupCountry(group.display)?.code;
    if (mentionsCity || (code && titleCountries.has(code))) {
      result.set(key, group);
    }
  }
  return result;
}

/**
 * Informal country names people put in trip titles that differ from the
 * `Intl.DisplayNames` English name. Kept small — only names that are
 * unambiguous as whole words in a title.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: "US",
  america: "US",
  uk: "GB",
  britain: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  holland: "NL",
  turkey: "TR",
  korea: "KR",
  czech: "CZ",
  uae: "AE",
};

let countryNameCache: Array<[string, string]> | undefined;

/** [folded country name or alias, ISO code] for every known country. */
function countryNameEntries(): Array<[string, string]> {
  if (countryNameCache) return countryNameCache;
  const codes = new Set<string>(Object.values(CITY_TO_COUNTRY).map((c) => c.code));
  for (const { country } of Object.values(AIRPORTS)) codes.add(country);
  const entries: Array<[string, string]> = [];
  for (const code of codes) {
    const name = countryName(code);
    if (name) entries.push([fold(name), code]);
  }
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    entries.push([alias, code]);
  }
  countryNameCache = entries;
  return entries;
}

/**
 * Ordered, deduped list of destination cities for a trip — the home
 * bookend (the city the traveller departs from on day 1 and returns to
 * on the last day) is excluded so a SEA → Tokyo / Kyoto → SEA itinerary
 * surfaces "Tokyo / Kyoto" rather than "Seattle / Tokyo / Kyoto / Seattle".
 *
 * Transfer-day strings encoded with a slash ("Paris / Rome") are split
 * into per-city entries. Cities are deduped on their normalised key so
 * "Reykjavík" and "Reykjavik" collapse, with the first display form
 * encountered preserved (keeping the user's casing/diacritics).
 *
 * Returns `[]` for trips with no usable city data and for local-only
 * trips where every day is the home city — callers can hide the row
 * entirely in that case.
 */
export function tripDestinationCities(trip: Pick<Trip, "days">): string[] {
  const bookendKeys = findBookendKeys(trip);
  const seen = new Map<string, string>();
  for (const day of trip.days) {
    for (const { key, display } of normalizeCities(day.city)) {
      if (bookendKeys.has(key)) continue;
      if (!seen.has(key)) seen.set(key, display);
    }
  }
  return Array.from(seen.values());
}
