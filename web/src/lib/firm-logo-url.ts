/** Static file path on disk (no query string). */
export const FIRM_LOGO_STATIC_PATH = "/brand/logo.png";

/** Bump when replacing `public/brand/logo.png` so browsers drop stale GL cache. */
export const FIRM_LOGO_VERSION = "ha-hernandez-v2";

/** Client-safe hosted logo URL (no Node fs). */
export function firmLogoPublicUrl(): string {
  const path = `${FIRM_LOGO_STATIC_PATH}?v=${FIRM_LOGO_VERSION}`;
  const root = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  return root ? `${root}${path}` : path;
}

export function firmLetterheadLogoPublicUrl(): string {
  return firmLogoPublicUrl();
}
