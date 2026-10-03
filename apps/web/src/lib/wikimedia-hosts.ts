/**
 * Hosts Wikimedia serves article images from. Wikipedia's page-summary
 * API moved thumbnails from `upload.wikimedia.org` to
 * `thumb.wikimedia.org` (same `/wikipedia/commons/thumb/…` paths, plus
 * `utm_*` query params); originals still come from `upload`.
 *
 * Shared by the image proxy route's allow-list and the client's
 * thumbnail helpers. Keep in sync with the `img-src` / `connect-src`
 * entries in `src/proxy.ts` and `isWikimediaImage` in `public/sw.js`.
 */
export const WIKIMEDIA_IMAGE_HOSTS: ReadonlySet<string> = new Set([
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
]);

export function isWikimediaImageHost(hostname: string): boolean {
  return WIKIMEDIA_IMAGE_HOSTS.has(hostname);
}
