import { describe, expect, it } from "vitest";
import {
  allowlistHasEmail,
  emailsMatch,
  normalizeAllowlistEmail,
  uniqueNormalizedEmails
} from "@/lib/email-allowlist";

describe("email-allowlist", () => {
  it("treats Gmail dots as the same account", () => {
    expect(normalizeAllowlistEmail("Atty.RAHernandez@gmail.com")).toBe("attyrahernandez@gmail.com");
    expect(normalizeAllowlistEmail("attyrahernandez@gmail.com")).toBe("attyrahernandez@gmail.com");
    expect(emailsMatch("atty.rahernandez@gmail.com", "attyrahernandez@gmail.com")).toBe(true);
    expect(emailsMatch("atty.rahernandez@gmail.com", "rahernandez@gmail.com")).toBe(false);
  });

  it("treats googlemail.com as gmail.com", () => {
    expect(emailsMatch("atty.rahernandez@googlemail.com", "attyrahernandez@gmail.com")).toBe(true);
  });

  it("does not strip dots on non-Gmail domains", () => {
    expect(normalizeAllowlistEmail("atty.hernandez@hernandezlaw.info")).toBe(
      "atty.hernandez@hernandezlaw.info"
    );
    expect(emailsMatch("atty.hernandez@hernandezlaw.info", "attyhernandez@hernandezlaw.info")).toBe(
      false
    );
  });

  it("matches allowlists with either Gmail spelling", () => {
    expect(allowlistHasEmail(["atty.rahernandez@gmail.com"], "attyrahernandez@gmail.com")).toBe(true);
    expect(allowlistHasEmail(["legal@hernandezlaw.info"], "LEGAL@hernandezlaw.info")).toBe(true);
    expect(allowlistHasEmail(["legal@hernandezlaw.info"], "guest@gmail.com")).toBe(false);
  });

  it("dedupes Gmail aliases when listing unique emails", () => {
    expect(
      uniqueNormalizedEmails(["atty.rahernandez@gmail.com", "attyrahernandez@gmail.com", ""])
    ).toEqual(["atty.rahernandez@gmail.com"]);
  });
});
