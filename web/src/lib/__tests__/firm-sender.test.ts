import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FIRM_SENDER_EMAIL,
  formatFirmOutboundFrom,
  formatOutboundFrom,
  resolveFirmSenderEmail
} from "@/lib/firm-sender";

describe("firm sender (HA)", () => {
  const original = process.env.FIRM_SENDER_EMAIL;

  afterEach(() => {
    if (original === undefined) delete process.env.FIRM_SENDER_EMAIL;
    else process.env.FIRM_SENDER_EMAIL = original;
  });

  it("defaults to legal@hernandezlaw.info for unattended fallback", () => {
    delete process.env.FIRM_SENDER_EMAIL;
    expect(resolveFirmSenderEmail()).toBe("legal@hernandezlaw.info");
    expect(DEFAULT_FIRM_SENDER_EMAIL).toBe("legal@hernandezlaw.info");
  });

  it("allows personal Gmail from env for cron fallback", () => {
    process.env.FIRM_SENDER_EMAIL = "janinerose1191@gmail.com";
    expect(resolveFirmSenderEmail()).toBe("janinerose1191@gmail.com");
  });

  it("formats From for a specific actor mailbox", () => {
    const from = formatOutboundFrom("janinerose1191@gmail.com");
    expect(from).toContain("janinerose1191@gmail.com");
    expect(from).toMatch(/^".+" <janinerose1191@gmail\.com>$/);
  });

  it("formats fallback From with resolved firm sender", () => {
    delete process.env.FIRM_SENDER_EMAIL;
    const from = formatFirmOutboundFrom();
    expect(from).toContain("legal@hernandezlaw.info");
  });
});
