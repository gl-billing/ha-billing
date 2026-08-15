export type LayoutMode = "mobile" | "desktop";

export const LAYOUT_MODE_STORAGE_KEY = "ha-office-layout-mode";
/** Earlier HA Office builds stored layout under this key; read once, then migrate. */
export const LEGACY_LAYOUT_MODE_STORAGE_KEY = "gl-office-layout-mode";
export const LAYOUT_MODE_COOKIE = "ha-office-layout-mode";
export const LEGACY_LAYOUT_MODE_COOKIE = "gl-office-layout-mode";
export const LAYOUT_MODE_QUERY = "ha-layout";
export const PHONE_VIEWPORT_ATTR = "data-phone-viewport";
/** SSR / unknown device — never paint the phone office on a computer. */
export const DEFAULT_LAYOUT_MODE: LayoutMode = "desktop";
/** First visit on a real phone. */
export const DEFAULT_PHONE_LAYOUT_MODE: LayoutMode = "mobile";

const PHONE_UA = /iPhone|iPod|Android.+Mobile|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i;
export const PHONE_MAX_WIDTH_PX = 767;
/** Bottom nav is visible at this width — offer the Mobile switch here. */
export const COMPACT_DESK_MAX_WIDTH_PX = 900;

export function isPhoneUserAgent(ua: string | null | undefined): boolean {
  const value = String(ua || "");
  if (/iPad|Tablet|PlayBook/i.test(value) && !/Mobile/i.test(value)) return false;
  if (/Android/i.test(value) && !/Mobile/i.test(value)) return false;
  return PHONE_UA.test(value);
}

function viewportAtMost(px: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (typeof window.matchMedia === "function" && window.matchMedia(`(max-width: ${px}px)`).matches) {
      return true;
    }
  } catch {
    /* ignore */
  }
  if (typeof window.innerWidth === "number" && window.innerWidth > 0 && window.innerWidth <= px) {
    return true;
  }
  const screenWidth = window.screen?.width;
  return typeof screenWidth === "number" && screenWidth > 0 && screenWidth <= px;
}

export function isNarrowViewport(): boolean {
  return viewportAtMost(PHONE_MAX_WIDTH_PX);
}

/** True when the squeezed phone desk chrome (bottom nav) is on screen. */
export function isCompactDeskViewport(): boolean {
  return viewportAtMost(COMPACT_DESK_MAX_WIDTH_PX);
}

/** Phone-sized screen or a phone UA. Full-size desktop windows stay on the desk. */
export function isPhoneDevice(): boolean {
  if (typeof navigator !== "undefined") {
    const uaDataMobile = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
      ?.mobile;
    if (uaDataMobile === true) return true;
    if (isPhoneUserAgent(navigator.userAgent)) return true;
  }
  return isNarrowViewport();
}

/** Live preview: /office-hub?ha-layout=mobile forces Today’s Office on this window. */
export function readLayoutQuery(): LayoutMode | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const query = params.get(LAYOUT_MODE_QUERY) || params.get("ha-layout");
    return isLayoutMode(query) ? query : null;
  } catch {
    return null;
  }
}

/** Phone UA, phone width, compact desk, or ?ha-layout=mobile preview. */
export function canUseMobileLayout(): boolean {
  if (readLayoutQuery() === "mobile") return true;
  return isPhoneDevice() || isCompactDeskViewport();
}

const layoutListeners = new Set<() => void>();

function readStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAYOUT_MODE_STORAGE_KEY) || localStorage.getItem(LEGACY_LAYOUT_MODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: LayoutMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, value);
    localStorage.removeItem(LEGACY_LAYOUT_MODE_STORAGE_KEY);
  } catch {
    // Private browsing or quota — ignore.
  }
}

function writeLayoutCookie(mode: LayoutMode): void {
  if (typeof document === "undefined") return;
  try {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${LAYOUT_MODE_COOKIE}=${encodeURIComponent(mode)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    document.cookie = `${LEGACY_LAYOUT_MODE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function isLayoutMode(value: string | null | undefined): value is LayoutMode {
  return value === "mobile" || value === "desktop";
}

export function resolveLayoutMode(value: string | null | undefined): LayoutMode {
  return isLayoutMode(value) ? value : DEFAULT_LAYOUT_MODE;
}

export function parseLayoutModeCookie(cookieValue: string | undefined | null): LayoutMode {
  if (!cookieValue) return DEFAULT_LAYOUT_MODE;
  try {
    return resolveLayoutMode(decodeURIComponent(cookieValue));
  } catch {
    return resolveLayoutMode(cookieValue);
  }
}

/** Cookie value as saved, or null when missing / invalid — does not default to desktop. */
export function readOptionalLayoutMode(cookieValue: string | undefined | null): LayoutMode | null {
  if (!cookieValue) return null;
  try {
    const decoded = decodeURIComponent(cookieValue);
    return isLayoutMode(decoded) ? decoded : null;
  } catch {
    return isLayoutMode(cookieValue) ? cookieValue : null;
  }
}

/**
 * Phone Home (Today’s Office) instead of the desktop office dashboard.
 * Missing layout cookie on a phone follows the phone default (mobile).
 */
export function shouldOpenNativeMobileHome(input: {
  layoutCookie?: string | null;
  userAgent?: string | null;
  layoutQuery?: string | null;
}): boolean {
  const query = isLayoutMode(input.layoutQuery) ? input.layoutQuery : null;
  if (query === "desktop") return false;
  if (query === "mobile") return true;
  if (!isPhoneUserAgent(input.userAgent)) return false;
  return readOptionalLayoutMode(input.layoutCookie) !== "desktop";
}

/** Client-only: matches the pre-paint html attributes from the blocking script. */
export function readDocumentNativeMobileLayout(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return shouldOpenNativeMobileHome({
    layoutQuery: readLayoutQuery(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    layoutCookie:
      root.getAttribute("data-layout-mode") === "desktop"
        ? "desktop"
        : root.getAttribute("data-layout-mode") === "mobile" ||
            root.getAttribute(PHONE_VIEWPORT_ATTR) === "true"
          ? "mobile"
          : null
  });
}

export function getSavedLayoutMode(): LayoutMode {
  const query = readLayoutQuery();
  if (query) return query;
  const stored = readStorage();
  if (isLayoutMode(stored)) return stored;
  return isPhoneDevice() ? DEFAULT_PHONE_LAYOUT_MODE : DEFAULT_LAYOUT_MODE;
}

export function getBootstrappedLayoutMode(): LayoutMode {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-layout-mode");
    if (isLayoutMode(attr)) return attr;
  }
  return getSavedLayoutMode();
}

export function subscribeLayoutMode(onStoreChange: () => void): () => void {
  layoutListeners.add(onStoreChange);
  return () => {
    layoutListeners.delete(onStoreChange);
  };
}

function emitLayoutModeChange(): void {
  layoutListeners.forEach((listener) => listener());
}

export function saveLayoutMode(mode: LayoutMode): void {
  writeStorage(mode);
  writeLayoutCookie(mode);
}

export function applyPhoneViewportToDocument(phone: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(PHONE_VIEWPORT_ATTR, phone ? "true" : "false");
}

export function applyLayoutModeToDocument(mode: LayoutMode): void {
  applyLayoutChrome(mode, canUseMobileLayout());
}

/** Phone chrome only on a real phone. Desktop never gets data-layout-mode=mobile. */
export function applyLayoutChrome(saved: LayoutMode, phone: boolean): LayoutMode {
  if (typeof document === "undefined") return phone ? saved : "desktop";
  const root = document.documentElement;
  applyPhoneViewportToDocument(phone);
  const effective: LayoutMode = phone ? saved : "desktop";
  root.setAttribute("data-layout-mode", effective);
  if (phone) writeLayoutCookie(saved);
  emitLayoutModeChange();
  return effective;
}
