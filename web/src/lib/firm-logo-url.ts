/** Static file path on disk (no query string). */
export const FIRM_LOGO_STATIC_PATH = "/brand/logo.png";

/** White mark on transparent — for dark Space top banner only. */
export const FIRM_LOGO_ON_DARK_STATIC_PATH = "/brand/logo-on-dark.png";

/** Bump when replacing `public/brand/logo.png` so browsers drop a stale cache. */
export const FIRM_LOGO_VERSION = "ha-hernandez-v4-bw";

/** Bump when replacing `public/brand/logo-on-dark.png`. */
export const FIRM_LOGO_ON_DARK_VERSION = "ha-on-dark-v1";

/** Client-safe hosted logo URL (no Node fs).
 * Prefer a same-origin relative path so a mis-set NEXT_PUBLIC_APP_URL
 * cannot pull a logo from a different origin.
 */
export function firmLogoPublicUrl(): string {
  return `${FIRM_LOGO_STATIC_PATH}?v=${FIRM_LOGO_VERSION}`;
}

/** White glyph / transparent — Space topnav on cool-black bar. */
export function firmLogoOnDarkPublicUrl(): string {
  return `${FIRM_LOGO_ON_DARK_STATIC_PATH}?v=${FIRM_LOGO_ON_DARK_VERSION}`;
}

export function firmLetterheadLogoPublicUrl(): string {
  return firmLogoPublicUrl();
}
