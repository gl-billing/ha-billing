// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClioRail } from "@/components/clio/ClioRail";

vi.mock("next/navigation", () => ({
  usePathname: () => "/billing",
  useRouter: () => ({ push: vi.fn() })
}));

describe("ClioRail", () => {
  it("renders allowed primaries grouped by function", () => {
    render(<ClioRail activeNav="billing" billingAccess navProfile="full" isAdmin />);
    expect(screen.getByRole("link", { name: "Billing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Checklist" })).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Clients")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    expect(screen.getByText("Firm")).toBeInTheDocument();
  });

  it("exposes mobile workspace select with optgroups", () => {
    const { container } = render(<ClioRail activeNav="checklist" billingAccess navProfile="full" />);
    expect(container.querySelector("select.ha-clio-rail__mobile-select")).toBeTruthy();
    expect(container.querySelectorAll("optgroup").length).toBeGreaterThanOrEqual(3);
  });
});
