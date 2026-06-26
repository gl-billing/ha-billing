type PrintPreviewOptions = {
  /** Document title used for the print header / saved-PDF filename. */
  title: string;
  /** id of the element whose content should be previewed and printed. */
  sourceId: string;
};

/**
 * Opens an in-app print preview. A static snapshot of the source element is
 * cloned onto a white "paper" sheet so the layout is always readable, even
 * while the app itself is in dark mode. The same sheet is what gets sent to
 * the printer, so the preview matches the printout exactly.
 */
export function openPrintPreview({ title, sourceId }: PrintPreviewOptions) {
  if (typeof document === "undefined") return;

  const source = document.getElementById(sourceId);
  if (!source) {
    // Fallback: nothing to preview, just print the page.
    document.title = title;
    window.print();
    return;
  }

  // Never stack two previews.
  document.querySelector(".print-preview-overlay")?.remove();

  const previousTitle = document.title;
  document.title = title;
  document.body.classList.add("print-preview-open");

  const overlay = document.createElement("div");
  overlay.className = "print-preview-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `Print preview — ${title}`);

  const toolbar = document.createElement("div");
  toolbar.className = "print-preview-toolbar";

  const heading = document.createElement("div");
  heading.className = "print-preview-toolbar__title";
  heading.textContent = title;

  const hint = document.createElement("span");
  hint.className = "print-preview-toolbar__hint";
  hint.textContent = "Preview — review the page below, then print.";
  heading.appendChild(hint);

  const actions = document.createElement("div");
  actions.className = "print-preview-toolbar__actions";

  const printBtn = document.createElement("button");
  printBtn.type = "button";
  printBtn.className = "print-preview-btn print-preview-btn--primary";
  printBtn.textContent = "Print";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "print-preview-btn";
  closeBtn.textContent = "Close";

  actions.append(printBtn, closeBtn);
  toolbar.append(heading, actions);

  const scroll = document.createElement("div");
  scroll.className = "print-preview-scroll";

  const sheet = document.createElement("div");
  sheet.className = "print-preview-sheet";

  const clone = source.cloneNode(true) as HTMLElement;
  // Strip ids so the snapshot never collides with the live DOM.
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  sheet.appendChild(clone);
  scroll.appendChild(sheet);

  overlay.append(toolbar, scroll);
  document.body.appendChild(overlay);

  const cleanup = () => {
    overlay.remove();
    document.body.classList.remove("print-preview-open");
    document.title = previousTitle;
    document.removeEventListener("keydown", onKeyDown);
  };

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") cleanup();
  }

  closeBtn.addEventListener("click", cleanup);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target === scroll) cleanup();
  });
  printBtn.addEventListener("click", () => {
    window.print();
  });
  document.addEventListener("keydown", onKeyDown);

  // Focus the primary action for quick keyboard use.
  printBtn.focus();
}
