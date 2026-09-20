import { afterEach, describe, expect, it, vi } from "vitest";
import {
  firmWorkbookIdsToShare,
  shareFirmWorkbooksWithStaff,
  shareWorkbookAsEditor
} from "@/lib/sheets/share-workbooks";

const ORIGINAL_BILLING = process.env.GOOGLE_SPREADSHEET_ID;
const ORIGINAL_TASKS = process.env.TASKS_GOOGLE_SPREADSHEET_ID;

afterEach(() => {
  if (ORIGINAL_BILLING === undefined) delete process.env.GOOGLE_SPREADSHEET_ID;
  else process.env.GOOGLE_SPREADSHEET_ID = ORIGINAL_BILLING;
  if (ORIGINAL_TASKS === undefined) delete process.env.TASKS_GOOGLE_SPREADSHEET_ID;
  else process.env.TASKS_GOOGLE_SPREADSHEET_ID = ORIGINAL_TASKS;
  vi.unstubAllGlobals();
});

describe("share-workbooks", () => {
  it("dedupes billing and tasks workbook IDs", () => {
    process.env.GOOGLE_SPREADSHEET_ID = "billing-id";
    process.env.TASKS_GOOGLE_SPREADSHEET_ID = "billing-id";
    expect(firmWorkbookIdsToShare()).toEqual(["billing-id"]);

    process.env.TASKS_GOOGLE_SPREADSHEET_ID = "tasks-id";
    expect(firmWorkbookIdsToShare()).toEqual(["billing-id", "tasks-id"]);
  });

  it("shares a workbook as editor", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(shareWorkbookAsEditor("token", "sheet-1", "staff@gmail.com")).resolves.toEqual({
      ok: true,
      spreadsheetId: "sheet-1"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/drive/v3/files/sheet-1/permissions"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          type: "user",
          role: "writer",
          emailAddress: "staff@gmail.com"
        })
      })
    );
  });

  it("treats an already-shared Drive permission as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "Permission already exists for this user"
      })
    );

    await expect(shareWorkbookAsEditor("token", "sheet-1", "staff@gmail.com")).resolves.toMatchObject({
      ok: true,
      alreadyShared: true
    });
  });

  it("shares every configured workbook and warns when one fails", async () => {
    process.env.GOOGLE_SPREADSHEET_ID = "billing-id";
    process.env.TASKS_GOOGLE_SPREADSHEET_ID = "tasks-id";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, text: async () => "" })
        .mockResolvedValueOnce({ ok: false, status: 403, text: async () => "forbidden" })
    );

    const result = await shareFirmWorkbooksWithStaff("token", "staff@gmail.com");
    expect(result.shared).toEqual(["billing-id"]);
    expect(result.failed).toEqual(["tasks-id"]);
    expect(result.warning).toMatch(/could not share/i);
  });
});
