import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sheets/client", () => ({
  getSheetValues: vi.fn(),
  sheetExists: vi.fn(async () => true)
}));

vi.mock("@/lib/sheets/hyperlinks", () => ({
  getHyperlinksByRow: vi.fn(async () => new Map()),
  resolvePdfUrl: (_text: string, href?: string) => href || ""
}));

import { getSheetValues } from "@/lib/sheets/client";
import { getClientLedger, getClientTabSummary } from "@/lib/sheets/ledger-read";

describe("getClientTabSummary", () => {
  it("reads E1:E3 as a column of three cells", async () => {
    vi.mocked(getSheetValues).mockResolvedValueOnce([[5000], [10000], [15000]]);
    const summary = await getClientTabSummary("token", "SANTOS");
    expect(summary).toEqual({
      totalDue: 5000,
      payments: 10000,
      charges: 15000
    });
  });
});

describe("getClientLedger summary", () => {
  it("uses ledger line totals for charges and payments", async () => {
    vi.mocked(getSheetValues)
      // ledger rows A8:L
      .mockResolvedValueOnce([
        ["2026-07-25", "Charge", "Pleading Fee", "Drafting pleading fee", 15000, "", 15000, "", "", "", "", ""],
        ["2026-09-20", "Payment", "Pleading Fee", "Drafting pleading fee", "", 10000, 5000, "Cash", "", "", "", ""]
      ])
      // hyperlinks range (may be skipped if empty) — getHyperlinksByRow is mocked
      // tab summary E1:E3 (misread historically returned only total)
      .mockResolvedValueOnce([[5000], [0], [0]]);

    const { summary } = await getClientLedger("token", "SANTOS");
    expect(summary.charges).toBe(15000);
    expect(summary.payments).toBe(10000);
    expect(summary.totalDue).toBe(5000);
  });
});
