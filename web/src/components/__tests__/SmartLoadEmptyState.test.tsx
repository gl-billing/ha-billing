// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SmartLoadEmptyState } from "@/components/SmartLoadEmptyState";

describe("SmartLoadEmptyState", () => {
  it("renders billing load failure with retry", () => {
    const onRetry = vi.fn();
    render(
      <SmartLoadEmptyState
        errorMessage="Unable to load clients."
        context="billing"
        status={500}
        onRetry={onRetry}
      />
    );
    expect(screen.getByText("Could not load billing data")).toBeInTheDocument();
    screen.getByRole("button", { name: /try again/i }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows sign in for session expiry", () => {
    render(
      <SmartLoadEmptyState
        errorMessage="Session expired — sign in again"
        context="tasks"
        status={401}
        onRetry={() => undefined}
      />
    );
    expect(screen.getByRole("link", { name: /sign in again/i })).toHaveAttribute("href", "/login");
  });

  it("uses tasks context title", () => {
    render(
      <SmartLoadEmptyState
        errorMessage="Server error"
        context="tasks"
        status={500}
      />
    );
    expect(screen.getAllByText("Could not load office data").length).toBeGreaterThan(0);
  });
});
