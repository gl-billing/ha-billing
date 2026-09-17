import { beforeEach, describe, expect, it, vi } from "vitest";

const getCachedAllItems = vi.fn(async () => []);
const getCachedEmployeeDirectory = vi.fn(async () => []);
const getAllMasterRows = vi.fn(async () => {
  throw new Error("The caller does not have permission");
});

vi.mock("@/lib/office-tasks/tasks-cache", () => ({
  getCachedAllItems: (...args: unknown[]) => getCachedAllItems(...args),
  getCachedEmployeeDirectory: (...args: unknown[]) => getCachedEmployeeDirectory(...args)
}));

vi.mock("@/lib/sheets/master", () => ({
  getAllMasterRows: (...args: unknown[]) => getAllMasterRows(...args)
}));

import { warmWorkspaceSheetCaches } from "@/lib/sheets/workspace-bootstrap";

describe("warmWorkspaceSheetCaches", () => {
  beforeEach(() => {
    getCachedAllItems.mockClear();
    getCachedEmployeeDirectory.mockClear();
    getAllMasterRows.mockClear();
  });

  it("does not read the billing workbook for associate counsel", async () => {
    const result = await warmWorkspaceSheetCaches("token", { includeBilling: false });
    expect(getAllMasterRows).not.toHaveBeenCalled();
    expect(getCachedAllItems).toHaveBeenCalled();
    expect(result.keys).toEqual(["tasks-items", "tasks-employees"]);
  });

  it("does not fail workspace warm when billing Master List is forbidden", async () => {
    const result = await warmWorkspaceSheetCaches("token", { fresh: true, includeBilling: true });
    expect(getAllMasterRows).toHaveBeenCalled();
    expect(result.keys).toContain("master-rows");
  });
});
