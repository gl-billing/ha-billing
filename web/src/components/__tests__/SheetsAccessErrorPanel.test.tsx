// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SheetsAccessErrorPanel } from "@/components/SheetsAccessErrorPanel";

describe("SheetsAccessErrorPanel", () => {
  it("renders hint title and reload action", () => {
    const onReload = vi.fn();
    render(
      <SheetsAccessErrorPanel
        hint={{
          title: "Spreadsheet access needed",
          body: "Share the workbook with this Google account as Editor.",
          showReload: true,
          showSignIn: false
        }}
        onReload={onReload}
      />
    );
    expect(screen.getByText("Spreadsheet access needed")).toBeInTheDocument();
    screen.getByRole("button", { name: "Update" }).click();
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("shows sign in link when required", () => {
    render(
      <SheetsAccessErrorPanel
        hint={{
          title: "Session expired",
          body: "Sign in again.",
          showReload: false,
          showSignIn: true
        }}
      />
    );
    expect(screen.getByRole("link", { name: /sign in again/i })).toBeInTheDocument();
  });
});
