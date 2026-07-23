import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_FIRM_SENDER_EMAIL, formatFirmOutboundFrom, resolveFirmSenderEmail } from "@/lib/firm-sender";

describe("firm sender (HA)", () => {
  const original = process.env.FIRM_SENDER_EMAIL;

  afterEach(() => {
    if (original === undefined) delete process.env.FIRM_SENDER_EMAIL;
    else process.env.FIRM_SENDER_EMAIL = original;
  });

  it("defaults to legal@hernandezlaw.info", () => {
    delete process.env.FIRM_SENDER_EMAIL;
    expect(resolveFirmSenderEmail()).toBe("legal@hernandezlaw.info");
    expect(DEFAULT_FIRM_SENDER_EMAIL).toBe("legal@hernandezlaw.info");
  });

  it("ignores personal Gmail overrides in env", () => {
    process.env.FIRM_SENDER_EMAIL = "janinerose1191@gmail.com";
    expect(resolveFirmSenderEmail()).toBe("legal@hernandezlaw.info");
  });

  it("allows another @hernandezlaw.info address from env", () => {
    process.env.FIRM_SENDER_EMAIL = "atty.hernandez@hernandezlaw.info";
    expect(resolveFirmSenderEmail()).toBe("atty.hernandez@hernandezlaw.info");
  });

  it("formats From with firm display name and legal@", () => {
    delete process.env.FIRM_SENDER_EMAIL;
    const from = formatFirmOutboundFrom();
    expect(from).toContain("legal@hernandezlaw.info");
    expect(from).toMatch(/^".+" <legal@hernandezlaw\.info>$/);
  });
});
