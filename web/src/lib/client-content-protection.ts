const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable], [contenteditable='true'], [data-allow-copy='true']";

export type ContentProtectionBlockReason =
  | "context_menu"
  | "copy"
  | "cut"
  | "drag"
  | "shortcut"
  | "select";

export function isEditableCopyTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as { closest?: (selector: string) => Element | null };
  if (typeof element.closest !== "function") return false;
  if (element.closest(EDITABLE_SELECTOR)) return true;
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (active && active !== target && typeof (active as Element).closest === "function") {
    return Boolean((active as Element).closest(EDITABLE_SELECTOR));
  }
  return false;
}

function isBlockedShortcut(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  const withCtrlOrMeta = event.ctrlKey || event.metaKey;

  if (key === "f12") return true;
  if (key === "printscreen") return true;

  if (!withCtrlOrMeta) return false;

  if (event.shiftKey && (key === "i" || key === "j" || key === "c")) return true;
  if (key === "u") return true;
  if (key === "s") return true;
  if (key === "p") return true;

  if (!event.shiftKey && !isEditableCopyTarget(event.target)) {
    if (key === "c") return true;
    if (key === "x") return true;
    if (key === "a") return true;
  }

  return false;
}

function shortcutReason(event: KeyboardEvent): ContentProtectionBlockReason {
  const key = event.key.toLowerCase();
  if (!event.shiftKey && (key === "c" || key === "x" || key === "a")) {
    if (key === "c") return "copy";
    if (key === "x") return "cut";
    return "select";
  }
  return "shortcut";
}

export type ContentProtectionHandlers = {
  onContextMenu: (event: MouseEvent) => void;
  onCopy: (event: ClipboardEvent) => void;
  onCut: (event: ClipboardEvent) => void;
  onDragStart: (event: DragEvent) => void;
  onSelectStart: (event: Event) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onAuxClick: (event: MouseEvent) => void;
};

export function createContentProtectionHandlers(options?: {
  onBlocked?: (reason: ContentProtectionBlockReason) => void;
}): ContentProtectionHandlers {
  const notify = options?.onBlocked;

  return {
    onContextMenu(event) {
      event.preventDefault();
      notify?.("context_menu");
    },
    onCopy(event) {
      if (isEditableCopyTarget(event.target)) return;
      event.preventDefault();
      notify?.("copy");
    },
    onCut(event) {
      if (isEditableCopyTarget(event.target)) return;
      event.preventDefault();
      notify?.("cut");
    },
    onDragStart(event) {
      if (isEditableCopyTarget(event.target)) return;
      event.preventDefault();
      notify?.("drag");
    },
    onSelectStart(event) {
      if (isEditableCopyTarget(event.target)) return;
      event.preventDefault();
      notify?.("select");
    },
    onKeyDown(event) {
      if (!isBlockedShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      notify?.(shortcutReason(event));
    },
    onAuxClick(event) {
      if (event.button !== 1) return;
      if (isEditableCopyTarget(event.target)) return;
      event.preventDefault();
      notify?.("context_menu");
    }
  };
}

export function attachContentProtection(
  target: Document | HTMLElement,
  handlers: ContentProtectionHandlers
): () => void {
  const onContextMenu: EventListener = (event) => handlers.onContextMenu(event as MouseEvent);
  const onCopy: EventListener = (event) => handlers.onCopy(event as ClipboardEvent);
  const onCut: EventListener = (event) => handlers.onCut(event as ClipboardEvent);
  const onDragStart: EventListener = (event) => handlers.onDragStart(event as DragEvent);
  const onSelectStart: EventListener = (event) => handlers.onSelectStart(event);
  const onKeyDown: EventListener = (event) => handlers.onKeyDown(event as KeyboardEvent);
  const onAuxClick: EventListener = (event) => handlers.onAuxClick(event as MouseEvent);

  target.addEventListener("contextmenu", onContextMenu);
  target.addEventListener("copy", onCopy);
  target.addEventListener("cut", onCut);
  target.addEventListener("dragstart", onDragStart);
  target.addEventListener("selectstart", onSelectStart);
  target.addEventListener("keydown", onKeyDown, true);
  target.addEventListener("auxclick", onAuxClick);

  return () => {
    target.removeEventListener("contextmenu", onContextMenu);
    target.removeEventListener("copy", onCopy);
    target.removeEventListener("cut", onCut);
    target.removeEventListener("dragstart", onDragStart);
    target.removeEventListener("selectstart", onSelectStart);
    target.removeEventListener("keydown", onKeyDown, true);
    target.removeEventListener("auxclick", onAuxClick);
  };
}
