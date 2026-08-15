import { isPhoneUserAgent } from "@/lib/layout-mode-prefs";

/** Public login uses 768px. Native office chrome stays at 767px. */
export const LOGIN_MOBILE_MAX_PX = 768;
export const LOGIN_MOBILE_MQ = `(max-width: ${LOGIN_MOBILE_MAX_PX}px)`;

export type LoginLayoutMode = "pending" | "mobile" | "desktop";

export function initialLoginLayout(initialIsPhone: boolean): LoginLayoutMode {
  return initialIsPhone ? "mobile" : "pending";
}

export function loginLayoutFromWidth(width: number): Exclude<LoginLayoutMode, "pending"> {
  return width <= LOGIN_MOBILE_MAX_PX ? "mobile" : "desktop";
}

/** Phone UA stays on the compact login even in landscape. Narrow windows also qualify. */
export function resolveClientLoginLayout(input: {
  userAgent?: string | null;
  width: number;
  matchMediaMatches?: boolean;
}): Exclude<LoginLayoutMode, "pending"> {
  if (isPhoneUserAgent(input.userAgent)) return "mobile";
  if (input.matchMediaMatches === true) return "mobile";
  return loginLayoutFromWidth(input.width);
}
