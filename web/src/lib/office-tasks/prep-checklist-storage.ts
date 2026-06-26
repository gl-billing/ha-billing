const PREP_CHECKLIST_RE = /PREP_CHECKLIST:(\{[^\n]+\})/i;

export type PrepChecklistState = {
  items: string[];
  done: number[];
};

export function prepChecklistMarker(state: PrepChecklistState): string {
  return `PREP_CHECKLIST:${JSON.stringify({ v: 1, items: state.items, done: state.done })}`;
}

export function createPrepChecklistState(items: readonly string[]): PrepChecklistState {
  return { items: [...items], done: [] };
}

export function parsePrepChecklistState(remarks: string): PrepChecklistState | null {
  const match = String(remarks || "").match(PREP_CHECKLIST_RE);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { v?: number; items?: unknown; done?: unknown };
    if (parsed.v !== 1 || !Array.isArray(parsed.items)) return null;
    const items = parsed.items.map((item) => String(item || "").trim()).filter(Boolean);
    if (!items.length) return null;
    const done = Array.isArray(parsed.done)
      ? [...new Set(parsed.done.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n < items.length))].sort(
          (a, b) => a - b
        )
      : [];
    return { items, done };
  } catch {
    return null;
  }
}

export function stripPrepChecklistMarker(remarks: string): string {
  return String(remarks || "")
    .replace(/\n?PREP_CHECKLIST:\{[^\n]+\}/gi, "")
    .trim();
}

export function applyPrepChecklistToggle(remarks: string, index: number, checked: boolean): string | null {
  const state = parsePrepChecklistState(remarks);
  if (!state || index < 0 || index >= state.items.length) return null;

  const done = new Set(state.done);
  if (checked) done.add(index);
  else done.delete(index);

  const nextState: PrepChecklistState = {
    items: state.items,
    done: [...done].sort((a, b) => a - b)
  };
  const marker = prepChecklistMarker(nextState);
  const stripped = stripPrepChecklistMarker(remarks);
  return stripped ? `${stripped}\n${marker}` : marker;
}

export function prepChecklistProgress(state: PrepChecklistState): { done: number; total: number } {
  return { done: state.done.length, total: state.items.length };
}

export function nextActionForPrepChecklist(state: PrepChecklistState): string {
  const nextIndex = state.items.findIndex((_, index) => !state.done.includes(index));
  if (nextIndex < 0) return "All prep items complete — review file and mark task done";
  return `Complete prep: ${state.items[nextIndex]}`;
}

export function isChecked(state: PrepChecklistState, index: number): boolean {
  return state.done.includes(index);
}

export type PrepChecklistMutation =
  | { action: "add"; label: string }
  | { action: "edit"; itemIndex: number; label: string }
  | { action: "remove"; itemIndex: number }
  | { action: "delete" };

export function isPrepChecklistNextAction(nextAction: string): boolean {
  const trimmed = String(nextAction || "").trim();
  return trimmed.startsWith("Complete prep:") || trimmed.startsWith("All prep items complete");
}

export function nextActionAfterPrepChecklistDelete(nextAction: string): string {
  return isPrepChecklistNextAction(nextAction) ? "" : String(nextAction || "").trim();
}

function writePrepChecklistRemarks(remarks: string, state: PrepChecklistState): string {
  const marker = prepChecklistMarker(state);
  const stripped = stripPrepChecklistMarker(remarks);
  return stripped ? `${stripped}\n${marker}` : marker;
}

function remapDoneAfterRemove(done: number[], removedIndex: number): number[] {
  return done
    .filter((index) => index !== removedIndex)
    .map((index) => (index > removedIndex ? index - 1 : index))
    .sort((a, b) => a - b);
}

/** Add, rename, remove, or delete interactive prep checklist items on a task or event row. */
export function applyPrepChecklistMutation(remarks: string, mutation: PrepChecklistMutation): string | null {
  const state = parsePrepChecklistState(remarks);
  if (!state) return null;

  if (mutation.action === "delete") {
    return stripPrepChecklistMarker(remarks);
  }

  if (mutation.action === "add") {
    const label = mutation.label.trim();
    if (!label) return null;
    return writePrepChecklistRemarks(remarks, {
      items: [...state.items, label],
      done: state.done
    });
  }

  if (mutation.action === "edit") {
    const label = mutation.label.trim();
    const index = mutation.itemIndex;
    if (!label || index < 0 || index >= state.items.length) return null;
    const items = [...state.items];
    items[index] = label;
    return writePrepChecklistRemarks(remarks, { items, done: state.done });
  }

  if (mutation.action === "remove") {
    const index = mutation.itemIndex;
    if (index < 0 || index >= state.items.length) return null;
    if (state.items.length <= 1) return null;
    const items = state.items.filter((_, itemIndex) => itemIndex !== index);
    return writePrepChecklistRemarks(remarks, {
      items,
      done: remapDoneAfterRemove(state.done, index)
    });
  }

  return null;
}
