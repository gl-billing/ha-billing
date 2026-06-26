import { describe, expect, it } from "vitest";
import { applyCorrespondenceMergeText, buildCorrespondenceMergeMap } from "@/lib/correspondence-merge-fields";
import { classifyLoadError, resolveLoadErrorEmptyState } from "@/lib/load-error-copy";

describe("correspondence merge fields", () => {
  it("replaces balance and client tokens", () => {
    const text = "Dear {{client_name}}, balance {{balance}} for {{client_code}}.";
    const merged = applyCorrespondenceMergeText(text, {
      clientName: "Juan Dela Cruz",
      clientCode: "gl-001",
      balance: 12500
    });
    expect(merged).toContain("Juan Dela Cruz");
    expect(merged).toContain("GL-001");
    expect(merged).toContain("₱");
  });

  it("builds merge map with formatted balance", () => {
    const map = buildCorrespondenceMergeMap({ balance: 1000, clientCode: "GL-2" });
    expect(map["{{client_code}}"]).toBe("GL-2");
    expect(map["{{balance}}"]).toMatch(/₱|PHP/);
  });
});

describe("load error copy", () => {
  it("classifies auth and quota errors", () => {
    expect(classifyLoadError("Unauthorized. Please sign in again.", 401)).toBe("auth");
    expect(classifyLoadError("Google Sheets read limit reached", 429)).toBe("quota");
    expect(classifyLoadError("Request timed out")).toBe("timeout");
    expect(classifyLoadError("Failed to fetch")).toBe("network");
  });

  it("returns sign-in action for session errors", () => {
    const copy = resolveLoadErrorEmptyState("Session expired — sign out and sign in again.", "tasks");
    expect(copy.kind).toBe("auth");
    expect(copy.showSignIn).toBe(true);
    expect(copy.title).toBe("Could not load office data");
  });
});
