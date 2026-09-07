// Set env before importing the route module (its config reads process.env).
process.env.ANTHROPIC_API_KEY = "test-key";

import {
  segmentDedupeKey,
  mergeSegments,
  deduplicateResults,
} from "../../src/routes/emails";
import type { EmailScanResult, ParsedSegment } from "@itinly/shared";

/** Build a minimal valid ParsedSegment for dedup tests. */
function seg(overrides: Partial<ParsedSegment>): ParsedSegment {
  return {
    type: "hotel",
    title: "Segment",
    date: "2026-06-26",
    confidence: "high",
    ...overrides,
  };
}

/** Wrap parsed segments in a single-email scan result. */
function result(emailId: string, segments: ParsedSegment[]): EmailScanResult {
  return {
    emailId,
    subject: `subject-${emailId}`,
    from: `from-${emailId}@example.com`,
    receivedAt: "2026-06-10T09:00:00Z",
    parsedSegments: segments,
    parseStatus: "success",
  };
}

/** Flatten the surviving segments across every result after dedup. */
function survivors(results: EmailScanResult[]): ParsedSegment[] {
  return results.flatMap((r) => r.parsedSegments);
}

describe("segmentDedupeKey", () => {
  it("keys two rooms at the same hotel/stay identically despite different confirmation codes", () => {
    const roomA = seg({
      type: "hotel",
      venueName: "Hilton Tokyo Bay",
      date: "2026-06-26",
      endDate: "2026-06-30",
      confirmationCode: "HLT111",
    });
    const roomB = seg({
      type: "hotel",
      venueName: "Hilton Tokyo Bay",
      date: "2026-06-26",
      endDate: "2026-06-30",
      confirmationCode: "HLT222",
    });
    expect(segmentDedupeKey(roomA)).toBe(segmentDedupeKey(roomB));
  });

  it("keeps distinct keys for the same hotel on a different stay", () => {
    const stay1 = seg({
      type: "hotel",
      venueName: "Hilton Tokyo Bay",
      date: "2026-06-26",
      endDate: "2026-06-30",
      confirmationCode: "HLT111",
    });
    const stay2 = seg({
      type: "hotel",
      venueName: "Hilton Tokyo Bay",
      date: "2026-07-10",
      endDate: "2026-07-12",
      confirmationCode: "HLT333",
    });
    expect(segmentDedupeKey(stay1)).not.toBe(segmentDedupeKey(stay2));
  });

  it("keeps distinct keys for different hotels", () => {
    const a = seg({ type: "hotel", venueName: "Hilton Tokyo Bay", date: "2026-06-26" });
    const b = seg({ type: "hotel", venueName: "Park Hyatt Tokyo", date: "2026-06-26" });
    expect(segmentDedupeKey(a)).not.toBe(segmentDedupeKey(b));
  });

  it("keys three bookings on the same flight identically despite different confirmation codes", () => {
    const base = {
      type: "flight" as const,
      date: "2026-06-26",
      routeCode: "AS123",
      departureCity: "Seattle",
      arrivalCity: "Tokyo",
    };
    const k1 = segmentDedupeKey(seg({ ...base, confirmationCode: "PNR1" }));
    const k2 = segmentDedupeKey(seg({ ...base, confirmationCode: "PNR2" }));
    const k3 = segmentDedupeKey(seg({ ...base, confirmationCode: "PNR3" }));
    expect(k1).toBe(k2);
    expect(k2).toBe(k3);
  });
});

describe("mergeSegments", () => {
  it("combines confirmation codes comma-separated (like seats)", () => {
    const a = seg({ type: "flight", confirmationCode: "PNR1", seatNumber: "14A" });
    const b = seg({ type: "flight", confirmationCode: "PNR2", seatNumber: "14B" });
    const merged = mergeSegments(a, b);
    expect(merged.confirmationCode).toBe("PNR1, PNR2");
    expect(merged.seatNumber).toBe("14A, 14B");
  });

  it("de-duplicates an identical confirmation code arriving twice", () => {
    const a = seg({ confirmationCode: "HLT111" });
    const b = seg({ confirmationCode: "HLT111" });
    expect(mergeSegments(a, b).confirmationCode).toBe("HLT111");
  });

  it("fills a missing confirmation code from the donor", () => {
    const a = seg({ confirmationCode: undefined });
    const b = seg({ confirmationCode: "HLT222" });
    expect(mergeSegments(a, b).confirmationCode).toBe("HLT222");
  });
});

describe("deduplicateResults", () => {
  it("merges two hotel-room emails into one segment carrying both confirmation codes", () => {
    const results = [
      result("email-room-1", [
        seg({
          type: "hotel",
          title: "Hilton Tokyo Bay",
          venueName: "Hilton Tokyo Bay",
          date: "2026-06-26",
          endDate: "2026-06-30",
          confirmationCode: "HLT111",
        }),
      ]),
      result("email-room-2", [
        seg({
          type: "hotel",
          title: "Hilton Tokyo Bay",
          venueName: "Hilton Tokyo Bay",
          date: "2026-06-26",
          endDate: "2026-06-30",
          confirmationCode: "HLT222",
        }),
      ]),
    ];

    deduplicateResults(results);

    const hotels = survivors(results).filter((s) => s.type === "hotel");
    expect(hotels).toHaveLength(1);
    expect(hotels[0].confirmationCode).toBe("HLT111, HLT222");
  });

  it("merges three same-flight bookings into one segment with all confirmation codes and seats", () => {
    const flightBase = {
      type: "flight" as const,
      title: "SEA → NRT",
      date: "2026-06-26",
      routeCode: "AS123",
      departureCity: "Seattle",
      arrivalCity: "Tokyo",
    };
    const results = [
      result("email-1", [seg({ ...flightBase, confirmationCode: "PNR1", seatNumber: "14A" })]),
      result("email-2", [seg({ ...flightBase, confirmationCode: "PNR2", seatNumber: "14B" })]),
      result("email-3", [seg({ ...flightBase, confirmationCode: "PNR3", seatNumber: "14C" })]),
    ];

    deduplicateResults(results);

    const flights = survivors(results).filter((s) => s.type === "flight");
    expect(flights).toHaveLength(1);
    expect(flights[0].confirmationCode).toBe("PNR1, PNR2, PNR3");
    expect(flights[0].seatNumber).toBe("14A, 14B, 14C");
  });
});
