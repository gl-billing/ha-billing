import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLastSignInHint,
  maskEmail,
  readLastSignInHint,
  saveLastSignInHint
} from "@/lib/login-session-hint";

describe("login session hint", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
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
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("localStorage", localStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves and reads the last sign-in hint", () => {
    saveLastSignInHint({ email: "guest@gmail.com", provider: "google-guest" });
    expect(readLastSignInHint()).toEqual({ email: "guest@gmail.com", provider: "google-guest" });
  });

  it("clears the remembered sign-in hint", () => {
    saveLastSignInHint({ email: "guest@gmail.com", provider: "google-guest" });
    clearLastSignInHint();
    expect(readLastSignInHint()).toBeNull();
  });

  it("masks email addresses for the welcome-back banner", () => {
    expect(maskEmail("janinerose1191@gmail.com")).toBe("j***@gmail.com");
  });
});
