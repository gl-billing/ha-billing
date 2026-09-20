import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import {
  getActiveSheetStaffEmails,
  invalidateSheetStaffAllowlist,
  isActiveSheetStaffEmail
} from "@/lib/staff-sheet-allowlist";

vi.mock("@/lib/cron-google-auth", () => ({
  getCronGoogleAccessToken: vi.fn()
}));

vi.mock("@/lib/office-tasks/sheets/employees", () => ({
  getEmployeeDirectory: vi.fn()
}));

const cronToken = vi.mocked(getCronGoogleAccessToken);
const directory = vi.mocked(getEmployeeDirectory);

describe("staff-sheet-allowlist", () => {
  beforeEach(() => {
    invalidateSheetStaffAllowlist();
    cronToken.mockReset();
    directory.mockReset();
  });

  afterEach(() => {
    invalidateSheetStaffAllowlist();
  });

  it("allows active Employees-sheet emails, including Gmail-dot aliases", async () => {
    cronToken.mockResolvedValue("token");
    directory.mockResolvedValue([
      { name: "New Staff", email: "new.staff@gmail.com", role: "Staff", active: true }
    ]);

    expect(await isActiveSheetStaffEmail("newstaff@gmail.com")).toBe(true);
    expect(await isActiveSheetStaffEmail("unknown@gmail.com")).toBe(false);
    expect(await getActiveSheetStaffEmails()).toEqual(["new.staff@gmail.com"]);
    expect(directory).toHaveBeenCalledTimes(1);
  });

  it("denies when the cron Google token is missing", async () => {
    cronToken.mockResolvedValue(null);
    expect(await isActiveSheetStaffEmail("new.staff@gmail.com")).toBe(false);
    expect(directory).not.toHaveBeenCalled();
  });
});
