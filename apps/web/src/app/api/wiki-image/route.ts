/**
 * Same-origin proxy for Wikimedia trip-card photos.
 *
 * `GET /api/wiki-image?url=<thumb. or upload.wikimedia.org URL>`
 *
 * iOS Safari resolved the Wikipedia photo URL fine but then failed to
 * load the image itself — with and without `crossorigin` — while
 * Chromium loaded it. Serving the bytes from our own origin sidesteps
 * every cross-origin variable at once: CORS / COEP / CORP, the service
 * worker's cross-origin handling, and Wikimedia rate-limiting shared
 * client IPs (iCloud Private Relay). `CityHeroImage` tries this first and
 * falls back to loading Wikimedia directly.
 *
 * Locked down to `https://{thumb,upload}.wikimedia.org/wikipedia/...`
 * image responses so it can't be used as an open proxy.
 */

import { isWikimediaImageHost } from "@/lib/wikimedia-hosts";

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

// Wikimedia's User-Agent policy asks server-side clients to identify
// themselves; generic or missing UAs get throttled.
const USER_AGENT = "itinly/1.0 (https://itinly.app; trip-card photos)";

/** Errors must not be cached — a transient upstream failure would stick. */
function errorResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parseTarget(raw: string | null): URL | null {
  if (!raw) return null;
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return null;
  }
  if (target.protocol !== "https:") return null;
  if (!isWikimediaImageHost(target.hostname)) return null;
  if (target.port !== "" || target.username !== "" || target.password !== "") {
    return null;
  }
  if (!target.pathname.startsWith("/wikipedia/")) return null;
  return target;
}

export async function GET(request: Request): Promise<Response> {
  const target = parseTarget(new URL(request.url).searchParams.get("url"));
  if (!target) {
    return errorResponse("Invalid image URL", 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
      // A redirect could leave the allow-listed host.
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn(
      `[wiki-image] fetch failed for ${target.pathname}:`,
      err instanceof Error ? err.message : err,
    );
    return errorResponse("Upstream fetch failed", 502);
  }

  if (!upstream.ok) {
    console.warn(`[wiki-image] upstream ${upstream.status} for ${target.pathname}`);
    // Pass 404 through (missing file); anything else is a gateway error.
    return errorResponse("Upstream error", upstream.status === 404 ? 404 : 502);
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return errorResponse("Not an image", 502);
  }
  const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES) {
    return errorResponse("Image too large", 502);
  }
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) {
    return errorResponse("Image too large", 502);
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Thumbnail URLs are effectively content-addressed (file name +
      // width), so the CDN can hold them for a long time; browsers
      // revalidate daily.
      "Cache-Control": "public, max-age=86400, s-maxage=2592000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
