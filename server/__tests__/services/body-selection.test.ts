import { chooseBodyText, countBookingFacts } from "../../src/services/body-selection";

describe("countBookingFacts", () => {
  it("counts dates, times, currency amounts and weekday/month names", () => {
    expect(countBookingFacts("Order\n01/01/2027 11:00\n£5.00 x 2")).toBeGreaterThanOrEqual(3);
    expect(countBookingFacts("Monday, 28 Dec 8:00 PM")).toBeGreaterThanOrEqual(3);
    expect(countBookingFacts("Thanks for your order. Need help?")).toBe(0);
  });
});

describe("chooseBodyText", () => {
  it("uses HTML when plain is a short subject-line stub", () => {
    const html = "Reservation confirmed\nMonday, 28 Dec\n8:00 PM\n4 people";
    expect(chooseBodyText("Confirmation of your reservation at Faralá", html)).toBe(html);
  });

  it("uses HTML when a long plain part is boilerplate that omits the booking", () => {
    // Natural History Museum: >400 chars of policy text in plain, order
    // lines (date/time/price) only in HTML.
    const plain = "Thanks for your order. Just show your e-ticket. ".repeat(12);
    const html =
      "Order date: 03/10/2026\nAdult General Admission\n01/01/2027 11:00\n£5.00 2 £10.00\nOrder Total: £16.00";
    expect(plain.length).toBeGreaterThan(400);
    expect(chooseBodyText(plain, html)).toBe(html);
  });

  it("keeps a plain part that already carries the booking facts", () => {
    const plain = [
      "ARRIVAL 6/18/2026",
      "DEPARTURE 6/21/2026",
      "CHECK-IN 4 p.m.",
      "CHECK-OUT 10 a.m.",
      "TOTAL PAID $748.00",
      "x".repeat(400),
    ].join("\n");
    const html = Array.from({ length: 60 }, (_, i) => `Promo banner ${i}`).join("\n");
    expect(chooseBodyText(plain, html)).toBe(plain);
  });

  it("falls back to whichever side is non-empty", () => {
    expect(chooseBodyText("", "html only")).toBe("html only");
    expect(chooseBodyText("plain only", "  ")).toBe("plain only");
  });
});
