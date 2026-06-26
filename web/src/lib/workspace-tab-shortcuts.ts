export type TabShortcutItem = {
  keys: string;
  description: string;
};

export function buildTabShortcutHelp(
  tabs: ReadonlyArray<{ id: string; label: string }>,
  max = 9
): TabShortcutItem[] {
  return tabs.slice(0, max).map((tab, index) => ({
    keys: String(index + 1),
    description: tab.label
  }));
}

export function bindWorkspaceTabShortcuts<T extends string>(
  tabIds: readonly T[],
  onSelect: (id: T) => void,
  max = 9
): () => void {
  function onKeyDown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const index = Number(event.key);
    if (!Number.isInteger(index) || index < 1 || index > max || index > tabIds.length) return;

    event.preventDefault();
    onSelect(tabIds[index - 1]);
  }

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
