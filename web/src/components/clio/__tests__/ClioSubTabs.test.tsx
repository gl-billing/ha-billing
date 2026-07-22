// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClioSubTabs } from "@/components/clio/ClioSubTabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/billing",
  useRouter: () => ({ push: vi.fn() })
}));

describe("ClioSubTabs", () => {
  it("hides when primary has only one allowed section", () => {
    const { container } = render(
      <ClioSubTabs activeNav="dashboard" activeSection="home" billingAccess navProfile="full" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("lists calendar day week month sections", () => {
    render(
      <ClioSubTabs activeNav="calendar" activeSection="day" billingAccess navProfile="full" />
    );
    expect(screen.getByRole("link", { name: "Day" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Week" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Month" })).toBeInTheDocument();
  });
});
