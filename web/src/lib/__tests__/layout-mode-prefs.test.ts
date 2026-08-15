import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LAYOUT_MODE,
  DEFAULT_PHONE_LAYOUT_MODE,
  getSavedLayoutMode,
  isPhoneUserAgent,
  LAYOUT_MODE_COOKIE,
  LAYOUT_MODE_STORAGE_KEY,
  parseLayoutModeCookie,
  resolveLayoutMode,
  shouldOpenNativeMobileHome
} from "@/lib/layout-mode-prefs";

describe("layout-mode-prefs", () => {
  let store: Record<string, string>;
  let attrs: Record<string, string>;
  let cookieJar: string;

  beforeEach(() => {
    store = {};
    attrs = {};
    cookieJar = "";
    const localStorage = {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
      clear() {
        store = {};
      }
    };
    const documentElement = {
      getAttribute(name: string) {
        return attrs[name] ?? null;
      },
      setAttribute(name: string, value: string) {
        attrs[name] = value;
      },
      removeAttribute(name: string) {
        delete attrs[name];
      }
    };
    const document = {
      documentElement,
      get cookie() {
        return cookieJar;
      },
      set cookie(value: string) {
        cookieJar = value;
      }
    };
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("document", document);
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to desktop when nothing is saved on a computer", () => {
    expect(getSavedLayoutMode()).toBe(DEFAULT_LAYOUT_MODE);
    expect(resolveLayoutMode(null)).toBe("desktop");
    expect(DEFAULT_PHONE_LAYOUT_MODE).toBe("mobile");
    expect(LAYOUT_MODE_STORAGE_KEY).toBe("ha-office-layout-mode");
    expect(LAYOUT_MODE_COOKIE).toBe("ha-office-layout-mode");
  });

  it("detects phones from UA and ignores desktop / tablets", () => {
    expect(isPhoneUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isPhoneUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36")).toBe(
      true
    );
    expect(isPhoneUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false);
    expect(isPhoneUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(false);
  });

  it("opens native mobile home on a phone unless desktop was saved", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
    expect(shouldOpenNativeMobileHome({ userAgent: iphone })).toBe(true);
    expect(shouldOpenNativeMobileHome({ userAgent: iphone, layoutCookie: "mobile" })).toBe(true);
    expect(shouldOpenNativeMobileHome({ userAgent: iphone, layoutCookie: "desktop" })).toBe(false);
    expect(shouldOpenNativeMobileHome({ userAgent: mac })).toBe(false);
    expect(shouldOpenNativeMobileHome({ userAgent: mac, layoutQuery: "mobile" })).toBe(true);
    expect(shouldOpenNativeMobileHome({ userAgent: iphone, layoutQuery: "desktop" })).toBe(false);
  });

  it("parses layout cookies", () => {
    expect(parseLayoutModeCookie("mobile")).toBe("mobile");
    expect(parseLayoutModeCookie("desktop")).toBe("desktop");
    expect(parseLayoutModeCookie(undefined)).toBe("desktop");
  });
});
