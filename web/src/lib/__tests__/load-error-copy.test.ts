import { describe, expect, it } from "vitest";
import { classifyLoadError, resolveLoadErrorEmptyState } from "@/lib/load-error-copy";

describe("load-error-copy", () => {
  it("classifies session expiry as auth", () => {
    expect(classifyLoadError("Session expired — sign in again", 401)).toBe("auth");
  });

  it("classifies quota messages", () => {
    expect(classifyLoadError("Google Sheets read limit reached", 429)).toBe("quota");
  });

  it("classifies network failures", () => {
    expect(classifyLoadError("Failed to fetch")).toBe("network");
  });

  it("classifies server errors", () => {
    expect(classifyLoadError("Server error — refresh the page", 500)).toBe("server");
  });

  it("returns billing title for billing context", () => {
    const copy = resolveLoadErrorEmptyState("Unable to load clients.", "billing", { status: 500 });
    expect(copy.title).toBe("Could not load billing data");
    expect(copy.showRetry).toBe(true);
  });

  it("returns dashboard title for dashboard context", () => {
    const copy = resolveLoadErrorEmptyState("Unable to load overview.", "dashboard");
    expect(copy.title).toBe("Could not load firm overview");
  });

  it("shows sign-in for auth errors in tasks context", () => {
    const copy = resolveLoadErrorEmptyState("Unauthorized", "tasks", { status: 401 });
    expect(copy.showSignIn).toBe(true);
  });

  it("uses quota retry label", () => {
    const copy = resolveLoadErrorEmptyState("quota exceeded", "generic", { status: 429 });
    expect(copy.retryLabel).toBe("Try again in a minute");
  });
});
