import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPhoneUserAgent } from "@/lib/layout-mode-prefs";
import {
  initialLoginLayout,
  LOGIN_MOBILE_MAX_PX,
  LOGIN_MOBILE_MQ,
  loginLayoutFromWidth,
  resolveClientLoginLayout
} from "@/lib/login-mobile";

const root = join(process.cwd(), "src");

describe("mobile login layout", () => {
  it("uses a 768px login breakpoint and never paints desktop first on phones", () => {
    expect(LOGIN_MOBILE_MAX_PX).toBe(768);
    expect(LOGIN_MOBILE_MQ).toBe("(max-width: 768px)");
    expect(initialLoginLayout(true)).toBe("mobile");
    expect(initialLoginLayout(false)).toBe("pending");
    expect(loginLayoutFromWidth(768)).toBe("mobile");
    expect(loginLayoutFromWidth(769)).toBe("desktop");
  });

  it("keeps phone UA on the compact login even when the landscape width is wide", () => {
    expect(
      resolveClientLoginLayout({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        width: 844,
        matchMediaMatches: false
      })
    ).toBe("mobile");
    expect(
      resolveClientLoginLayout({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        width: 1280,
        matchMediaMatches: false
      })
    ).toBe("desktop");
    expect(
      resolveClientLoginLayout({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        width: 390,
        matchMediaMatches: true
      })
    ).toBe("mobile");
    expect(isPhoneUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
  });

  it("ships a dedicated mobile login instead of compressing FirmAuthShell", () => {
    const loginPage = readFileSync(join(root, "app/login/page.tsx"), "utf8");
    const content = readFileSync(join(root, "components/LoginPageContent.tsx"), "utf8");
    const mobile = readFileSync(join(root, "components/login/MobileLoginPage.tsx"), "utf8");
    const css = readFileSync(join(root, "components/login/mobile-login.module.css"), "utf8");
    const continuePage = readFileSync(join(root, "app/auth/continue/page.tsx"), "utf8");
    const billing = readFileSync(join(root, "components/BillingApp.tsx"), "utf8");

    expect(loginPage).toContain("initialIsPhone");
    expect(loginPage).toContain("isPhoneUserAgent");
    expect(loginPage).toContain("LoginAuthStatus");
    expect(content).toContain("useLoginMobileLayout(initialIsPhone)");
    expect(content).toContain("MobileLoginPage");
    expect(content).toContain('loginLayout === "pending"');
    expect(content).toContain('loginLayout === "mobile"');
    expect(content).toContain("FirmAuthShell");
    expect(mobile).toContain("Continue as HA staff");
    expect(mobile).toContain("Use a different Google account");
    expect(mobile).toContain('src="/brand/logo.png"');
    expect(mobile).toContain("MobileLoginStatus");
    expect(css).toContain("min-height: 100dvh");
    expect(css).toContain("justify-content: safe center");
    expect(css).toContain("env(safe-area-inset-top");
    expect(continuePage).toContain("initialIsPhone");
    expect(billing).toContain("billing-charge-page--native-mobile");
    expect(billing).toContain("Billing and Ledger");
  });
});
