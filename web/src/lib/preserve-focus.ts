export type FocusedFieldSnapshot = {
  element: HTMLElement;
  selectionStart: number;
  selectionEnd: number;
};

const EDITABLE_SELECTOR =
  "input:not([type='hidden']), textarea, select, [contenteditable='true'], .rich-text-editor__surface";

export function isEditableField(el: Element | null | undefined): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.matches("input:not([type='hidden']), textarea, select")) return true;
  if (el.isContentEditable) return true;
  if (el.classList.contains("rich-text-editor__surface")) return true;
  return Boolean(el.closest(EDITABLE_SELECTOR));
}

export function resolveEditableField(el: Element | null | undefined): HTMLElement | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  if (isEditableField(el)) return el;
  const closest = el.closest(EDITABLE_SELECTOR);
  return closest instanceof HTMLElement ? closest : null;
}

export function captureFocusedField(): FocusedFieldSnapshot | null {
  if (typeof document === "undefined") return null;
  const element = resolveEditableField(document.activeElement);
  if (!element) return null;

  let selectionStart = 0;
  let selectionEnd = 0;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    selectionStart = element.selectionStart ?? 0;
    selectionEnd = element.selectionEnd ?? 0;
  }

  return { element, selectionStart, selectionEnd };
}

export function restoreFocusedField(snapshot: FocusedFieldSnapshot | null): void {
  if (!snapshot?.element || typeof document === "undefined") return;
  const { element, selectionStart, selectionEnd } = snapshot;
  if (!document.contains(element)) return;
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return;

  window.requestAnimationFrame(() => {
    if (!document.contains(element)) return;
    if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return;
    if (document.activeElement === element) return;

    element.focus({ preventScroll: true });

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const len = element.value.length;
      const start = Math.min(selectionStart, len);
      const end = Math.min(selectionEnd, len);
      try {
        element.setSelectionRange(start, end);
      } catch {
        // Some input types do not support selection ranges.
      }
    }
  });
}

export async function withPreservedFocus<T>(fn: () => Promise<T>): Promise<T> {
  const snapshot = captureFocusedField();
  try {
    return await fn();
  } finally {
    restoreFocusedField(snapshot);
  }
}
