/**
 * Chooses between the text/plain and text/html (already converted to text)
 * renderings of one email. Shared by the Gmail scanner and the EML importer
 * so both paths agree.
 *
 * Plain text is preferred — it's usually a clean receipt without layout
 * noise. But some senders ship a plain part that omits the booking itself:
 *   - a stub that is just the subject line (TheFork / Mailjet), or
 *   - a boilerplate blurb that crosses any length threshold yet drops the
 *     order lines (Natural History Museum: dates, times, prices only in HTML).
 * We detect those by counting booking-fact tokens (dates, times, currency
 * amounts, weekdays/months) in each rendering.
 */

export const PLAIN_TEXT_STUB_THRESHOLD = 400;
/** HTML text beyond this is almost certainly marketing soup; stay with plain. */
const MAX_HTML_TEXT_FOR_OVERRIDE = 30_000;
/** HTML must beat plain by at least this many fact tokens to override it. */
const MIN_FACT_ADVANTAGE = 2;

const FACT_PATTERNS: RegExp[] = [
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, // 01/01/2027, 6.18.2026
  /\b\d{4}-\d{2}-\d{2}\b/g, // 2026-12-28
  /\b\d{1,2}[:.]\d{2}\s?(?:[ap]\.?m\.?)?\b/gi, // 8:00 PM, 11:00, 17.30
  /\b\d{1,2}\s?[ap]\.?m\.?(?=\W|$)/gi, // 4 p.m.
  /[£€$¥]\s?\d[\d,.]*/g, // £16.00
  /\b(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?\b/gi,
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi,
];

export function countBookingFacts(text: string): number {
  let n = 0;
  for (const re of FACT_PATTERNS) n += text.match(re)?.length ?? 0;
  return n;
}

export function chooseBodyText(plain: string, htmlText: string): string {
  const plainTrim = plain.trim();
  const htmlTrim = htmlText.trim();
  if (!htmlTrim) return plain;
  if (!plainTrim) return htmlText;

  if (plainTrim.length < PLAIN_TEXT_STUB_THRESHOLD && htmlTrim.length > plainTrim.length) {
    return htmlText;
  }
  if (
    htmlTrim.length <= MAX_HTML_TEXT_FOR_OVERRIDE &&
    countBookingFacts(htmlTrim) >= countBookingFacts(plainTrim) + MIN_FACT_ADVANTAGE
  ) {
    return htmlText;
  }
  return plain;
}
