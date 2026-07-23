import { describe, expect, it } from "vitest";
import { formatSheetsAccessHint } from "@/lib/sheets-access-help";

describe("sheets-access-help", () => {
  it("returns spreadsheet permission hint", () => {
    const hint = formatSheetsAccessHint("Caller does not have permission", "staff@example.com");
    expect(hint?.title).toBe("Spreadsheet access needed");
    expect(hint?.body).toContain("staff@example.com");
    expect(hint?.body).toContain("office administrator");
    expect(hint?.showSignIn).toBe(true);
  });

  it("returns quota hint for 429-style messages", () => {
    const hint = formatSheetsAccessHint("Google Sheets read limit reached", "staff@example.com");
    expect(hint?.title).toBe("Google Sheets is busy");
    expect(hint?.showReload).toBe(true);
  });

  it("returns session hint for expired tokens", () => {
    const hint = formatSheetsAccessHint("Session expired — sign in again");
    expect(hint?.title).toBe("Sign-in expired");
    expect(hint?.showSignIn).toBe(true);
  });

  it("returns setup hint for range errors", () => {
    const hint = formatSheetsAccessHint("Unable to parse range: Items!A1");
    expect(hint?.title).toBe("Spreadsheet setup issue");
  });

  it("returns null for generic errors", () => {
    expect(formatSheetsAccessHint("Something else broke")).toBeNull();
  });

  it("does not treat billing role denial as a spreadsheet share problem", () => {
    const hint = formatSheetsAccessHint(
      "You do not have access to the billing system.",
      "lizparreno595@gmail.com"
    );
    expect(hint?.title).toBe("Billing access not enabled for this account");
    expect(hint?.body).toContain("lizparreno595@gmail.com");
    expect(hint?.showSignIn).toBe(false);
  });
});
