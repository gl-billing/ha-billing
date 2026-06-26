import { describe, expect, it, vi } from "vitest";
import { createContentProtectionHandlers, isEditableCopyTarget } from "@/lib/client-content-protection";

describe("client content protection", () => {
  it("allows copy targets inside editable fields", () => {
    const target = {
      closest: () => ({ tagName: "INPUT" })
    };

    expect(isEditableCopyTarget(target as EventTarget)).toBe(true);
  });

  it("blocks copy targets outside editable fields", () => {
    const target = {
      closest: () => null
    };

    expect(isEditableCopyTarget(target as EventTarget)).toBe(false);
  });

  it("blocks copy events outside editable fields", () => {
    const handlers = createContentProtectionHandlers();
    const preventDefault = vi.fn();
    handlers.onCopy({
      target: { closest: () => null },
      preventDefault
    } as unknown as ClipboardEvent);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("blocks context menu", () => {
    const onBlocked = vi.fn();
    const handlers = createContentProtectionHandlers({ onBlocked });
    const preventDefault = vi.fn();
    handlers.onContextMenu({ preventDefault } as unknown as MouseEvent);
    expect(preventDefault).toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledWith("context_menu");
  });

  it("blocks text selection outside editable fields", () => {
    const onBlocked = vi.fn();
    const handlers = createContentProtectionHandlers({ onBlocked });
    const preventDefault = vi.fn();
    handlers.onSelectStart({
      target: { closest: () => null },
      preventDefault
    } as unknown as Event);
    expect(preventDefault).toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledWith("select");
  });

  it("blocks ctrl+c outside editable fields", () => {
    const onBlocked = vi.fn();
    const handlers = createContentProtectionHandlers({ onBlocked });
    const preventDefault = vi.fn();
    handlers.onKeyDown({
      key: "c",
      ctrlKey: true,
      shiftKey: false,
      target: { closest: () => null },
      preventDefault,
      stopPropagation: vi.fn()
    } as unknown as KeyboardEvent);
    expect(preventDefault).toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledWith("copy");
  });
});
