// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClioRail } from "@/components/clio/ClioRail";

vi.mock("next/navigation", () => ({
  usePathname: () => "/billing",
  useRouter: () => ({ push: vi.fn() })
}));

describe("ClioRail", () => {
  it("renders allowed primaries for full billing user", () => {
    render(<ClioRail activeNav="billing" billingAccess navProfile="full" isAdmin />);
    expect(screen.getByRole("link", { name: "Billing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My work" })).toBeInTheDocument();
  });

  it("exposes mobile workspace select", () => {
    const { container } = render(<ClioRail activeNav="checklist" billingAccess navProfile="full" />);
    expect(container.querySelector("select.ha-clio-rail__mobile-select")).toBeTruthy();
  });
});
