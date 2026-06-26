import { describe, expect, it } from "vitest";
import {
  contactEmailsToFieldValue,
  formatContactEmails,
  hasAnyContactEmail,
  hasValidContactEmail,
  mergeContactEmailFieldRows,
  parseContactEmails,
  primaryContactEmail
} from "@/lib/contact-emails";

describe("contact-emails", () => {
  it("parses semicolon- and comma-separated addresses", () => {
    expect(parseContactEmails("a@x.com; b@y.com, a@x.com")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("formats and dedupes addresses for sheet storage", () => {
    expect(formatContactEmails(["a@x.com", "b@y.com", "a@x.com"])).toBe("a@x.com; b@y.com");
  });

  it("returns at least one empty field row for the UI", () => {
    expect(contactEmailsToFieldValue([])).toEqual([""]);
    expect(contactEmailsToFieldValue(["a@x.com", "b@y.com"])).toEqual(["a@x.com", "b@y.com"]);
    expect(contactEmailsToFieldValue(["a@x.com", ""])).toEqual(["a@x.com", ""]);
  });

  it("preserves in-progress empty rows while parent state catches up", () => {
    expect(mergeContactEmailFieldRows(["a@x.com", ""], ["a@x.com"])).toEqual(["a@x.com", ""]);
    expect(mergeContactEmailFieldRows(["a@x.com", "b@y.com"], ["a@x.com", "b@y.com"])).toEqual([
      "a@x.com",
      "b@y.com"
    ]);
    expect(mergeContactEmailFieldRows(["a@x.com"], ["b@y.com"])).toEqual(["b@y.com"]);
  });

  it("detects presence and validity", () => {
    expect(hasAnyContactEmail([""])).toBe(false);
    expect(hasAnyContactEmail(["a@x.com"])).toBe(true);
    expect(hasValidContactEmail(["not-an-email"])).toBe(false);
    expect(hasValidContactEmail(["client@example.com"])).toBe(true);
  });

  it("picks the first valid primary email", () => {
    expect(primaryContactEmail(["bad", "good@example.com", "other@example.com"])).toBe("good@example.com");
    expect(primaryContactEmail("bad; good@example.com")).toBe("good@example.com");
  });
});
