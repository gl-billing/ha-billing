/** Static file path on disk (no query string). */
export const FIRM_LOGO_STATIC_PATH = "/brand/logo.png";

/** Bump when replacing `public/brand/logo.png` so browsers drop stale GL cache. */
export const FIRM_LOGO_VERSION = "ha-hernandez-v3";

/** Client-safe hosted logo URL (no Node fs).
 * Prefer a same-origin relative path so a mis-set NEXT_PUBLIC_APP_URL
 * (e.g. GL on :3000 while HA runs on :3001) cannot pull the wrong firm logo.
 */
export function firmLogoPublicUrl(): string {
  return `${FIRM_LOGO_STATIC_PATH}?v=${FIRM_LOGO_VERSION}`;
}

export function firmLetterheadLogoPublicUrl(): string {
  return firmLogoPublicUrl();
}
