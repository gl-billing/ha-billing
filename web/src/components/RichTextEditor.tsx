"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { normalizeEditorHtml } from "@/lib/rich-text";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minHeight?: number;
  placeholder?: string;
  className?: string;
  id?: string;
};

type ToolbarButtonDef = {
  id: string;
  title: string;
  onClick: () => void;
  icon?: ReactNode;
  label?: string;
  swatch?: string;
  variant?: "icon" | "chip" | "swatch";
};

type ToolbarSection = {
  id: string;
  label: string;
  buttons: ToolbarButtonDef[];
};

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  minHeight = 220,
  placeholder = "Write the letter body…",
  className = "",
  id
}: Props) {
  const generatedId = useId();
  const surfaceId = id ?? generatedId;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [activeButtons, setActiveButtons] = useState<ReadonlySet<string>>(() => new Set());

  const refreshActiveButtons = useCallback(() => {
    setActiveButtons(collectActiveToolbarButtons(surfaceRef.current));
  }, []);

  const emitChange = useCallback(() => {
    const html = surfaceRef.current?.innerHTML || "";
    const empty = !richTextHasContent(html);
    onChange(empty ? "" : html);
  }, [onChange]);

  const focusSurface = useCallback(() => {
    surfaceRef.current?.focus();
  }, []);

  const exec = useCallback(
    (command: string, valueArg?: string) => {
      if (disabled) return;
      focusSurface();
      document.execCommand(command, false, valueArg);
      emitChange();
      window.requestAnimationFrame(refreshActiveButtons);
    },
    [disabled, emitChange, focusSurface, refreshActiveButtons]
  );

  const applyBlockStyle = useCallback(
    (style: Record<string, string>) => {
      if (disabled) return;
      focusSurface();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      let block = range.commonAncestorContainer;
      if (block.nodeType === Node.TEXT_NODE) block = block.parentElement || block;
      const element = block instanceof Element ? block.closest("p, div, li, blockquote") : null;
      if (element instanceof HTMLElement) {
        Object.assign(element.style, style);
      } else {
        document.execCommand("formatBlock", false, "p");
        const nextSelection = window.getSelection();
        const nextBlock = nextSelection?.anchorNode instanceof Element
          ? nextSelection.anchorNode
          : nextSelection?.anchorNode?.parentElement;
        if (nextBlock instanceof HTMLElement) Object.assign(nextBlock.style, style);
      }
      emitChange();
      window.requestAnimationFrame(refreshActiveButtons);
    },
    [disabled, emitChange, focusSurface, refreshActiveButtons]
  );

  const applyLineHeight = useCallback(
    (lineHeight: string) => {
      applyBlockStyle({ lineHeight });
    },
    [applyBlockStyle]
  );

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    if (document.activeElement === surface || surface.contains(document.activeElement)) return;
    const normalized = normalizeEditorHtml(value);
    if (surface.innerHTML !== normalized) {
      surface.innerHTML = normalized;
    }
  }, [value]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || disabled) return;

    const refresh = () => refreshActiveButtons();

    document.addEventListener("selectionchange", refresh);
    surface.addEventListener("keyup", refresh);
    surface.addEventListener("mouseup", refresh);
    surface.addEventListener("focus", refresh);

    return () => {
      document.removeEventListener("selectionchange", refresh);
      surface.removeEventListener("keyup", refresh);
      surface.removeEventListener("mouseup", refresh);
      surface.removeEventListener("focus", refresh);
    };
  }, [disabled, refreshActiveButtons]);

  const toolbarSections: ToolbarSection[] = [
    {
      id: "history",
      label: "History",
      buttons: [
        { id: "undo", title: "Undo", variant: "icon", icon: <IconUndo />, onClick: () => exec("undo") },
        { id: "redo", title: "Redo", variant: "icon", icon: <IconRedo />, onClick: () => exec("redo") }
      ]
    },
    {
      id: "style",
      label: "Style",
      buttons: [
        { id: "bold", title: "Bold", variant: "icon", icon: <IconBold />, onClick: () => exec("bold") },
        { id: "italic", title: "Italic", variant: "icon", icon: <IconItalic />, onClick: () => exec("italic") },
        { id: "underline", title: "Underline", variant: "icon", icon: <IconUnderline />, onClick: () => exec("underline") },
        { id: "strike", title: "Strikethrough", variant: "icon", icon: <IconStrike />, onClick: () => exec("strikeThrough") },
        { id: "sub", title: "Subscript", variant: "chip", label: "x₂", onClick: () => exec("subscript") },
        { id: "sup", title: "Superscript", variant: "chip", label: "x²", onClick: () => exec("superscript") }
      ]
    },
    {
      id: "size",
      label: "Size",
      buttons: [
        { id: "sm", title: "Small text", variant: "chip", label: "S", onClick: () => exec("fontSize", "2") },
        { id: "md", title: "Normal text", variant: "chip", label: "M", onClick: () => exec("fontSize", "3") },
        { id: "lg", title: "Large text", variant: "chip", label: "L", onClick: () => exec("fontSize", "5") },
        { id: "xl", title: "Extra large text", variant: "chip", label: "XL", onClick: () => exec("fontSize", "6") }
      ]
    },
    {
      id: "font",
      label: "Font",
      buttons: [
        { id: "serif", title: "Arial Black", variant: "chip", label: "Garamond", onClick: () => exec("fontName", "Arial Black") },
        { id: "times", title: "Times New Roman", variant: "chip", label: "Times", onClick: () => exec("fontName", "Times New Roman") },
        { id: "georgia", title: "Georgia", variant: "chip", label: "Georgia", onClick: () => exec("fontName", "Georgia") },
        { id: "sans", title: "Arial", variant: "chip", label: "Sans", onClick: () => exec("fontName", "Arial") }
      ]
    },
    {
      id: "color",
      label: "Color",
      buttons: [
        { id: "black", title: "Black text", variant: "swatch", swatch: "#1a1612", onClick: () => exec("foreColor", "#1a1612") },
        { id: "navy", title: "Navy text", variant: "swatch", swatch: "#1e3a5f", onClick: () => exec("foreColor", "#1e3a5f") },
        { id: "red", title: "Red text", variant: "swatch", swatch: "#8b1e1e", onClick: () => exec("foreColor", "#8b1e1e") },
        { id: "gold", title: "Gold text", variant: "swatch", swatch: "#8a6b2d", onClick: () => exec("foreColor", "#8a6b2d") },
        { id: "highlight", title: "Highlight selection", variant: "icon", icon: <IconHighlight />, onClick: () => exec("hiliteColor", "#fff3cd") },
        { id: "clear-highlight", title: "Clear highlight", variant: "icon", icon: <IconClearHighlight />, onClick: () => exec("hiliteColor", "transparent") }
      ]
    },
    {
      id: "align",
      label: "Align",
      buttons: [
        { id: "left", title: "Align left", variant: "icon", icon: <IconAlignLeft />, onClick: () => applyBlockStyle({ textAlign: "left" }) },
        { id: "center", title: "Align center", variant: "icon", icon: <IconAlignCenter />, onClick: () => applyBlockStyle({ textAlign: "center" }) },
        { id: "right", title: "Align right", variant: "icon", icon: <IconAlignRight />, onClick: () => applyBlockStyle({ textAlign: "right" }) },
        { id: "justify", title: "Justify", variant: "icon", icon: <IconAlignJustify />, onClick: () => applyBlockStyle({ textAlign: "justify" }) }
      ]
    },
    {
      id: "spacing",
      label: "Spacing",
      buttons: [
        { id: "line-1", title: "Single line spacing", variant: "chip", label: "1×", onClick: () => applyLineHeight("1") },
        { id: "line-15", title: "1.5 line spacing", variant: "chip", label: "1.5×", onClick: () => applyLineHeight("1.5") },
        { id: "line-2", title: "Double line spacing", variant: "chip", label: "2×", onClick: () => applyLineHeight("2") },
        { id: "indent", title: "Increase indent", variant: "icon", icon: <IconIndent />, onClick: () => exec("indent") },
        { id: "outdent", title: "Decrease indent", variant: "icon", icon: <IconOutdent />, onClick: () => exec("outdent") }
      ]
    },
    {
      id: "structure",
      label: "Insert",
      buttons: [
        { id: "bullet", title: "Bullet list", variant: "icon", icon: <IconBulletList />, onClick: () => exec("insertUnorderedList") },
        { id: "number", title: "Numbered list", variant: "icon", icon: <IconNumberList />, onClick: () => exec("insertOrderedList") },
        { id: "quote", title: "Block quote", variant: "icon", icon: <IconQuote />, onClick: () => exec("formatBlock", "blockquote") },
        { id: "rule", title: "Horizontal rule", variant: "icon", icon: <IconRule />, onClick: () => exec("insertHorizontalRule") },
        { id: "clear", title: "Clear formatting", variant: "chip", label: "Clear", onClick: () => exec("removeFormat") }
      ]
    }
  ];

  return (
    <div className={`rich-text-editor ${className}`.trim()}>
      <div className="rich-text-editor__toolbar" role="toolbar" aria-label="Letter formatting">
        <div className="rich-text-editor__toolbar-inner">
          {toolbarSections.map((section) => (
            <div key={section.id} className="rich-text-editor__section" data-section={section.id}>
              <span className="rich-text-editor__section-label">{section.label}</span>
              <div className="rich-text-editor__section-buttons" role="group" aria-label={section.label}>
                {section.buttons.map((button) => {
                  const isActive = activeButtons.has(button.id);
                  return (
                  <button
                    key={button.id}
                    type="button"
                    className={[
                      "rich-text-editor__btn",
                      button.variant === "swatch"
                        ? "rich-text-editor__btn--swatch"
                        : button.variant === "chip"
                          ? "rich-text-editor__btn--chip"
                          : "rich-text-editor__btn--icon",
                      isActive ? "rich-text-editor__btn--active" : ""
                    ].join(" ")}
                    title={button.title}
                    aria-label={button.title}
                    aria-pressed={isActive}
                    disabled={disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={button.onClick}
                  >
                    {button.swatch ? (
                      <span
                        className="rich-text-editor__swatch"
                        style={{ backgroundColor: button.swatch }}
                        aria-hidden
                      />
                    ) : button.icon ? (
                      <span className="rich-text-editor__btn-icon" aria-hidden>
                        {button.icon}
                      </span>
                    ) : (
                      <span className="rich-text-editor__btn-label">{button.label}</span>
                    )}
                  </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={surfaceRef}
        id={surfaceId}
        className="rich-text-editor__surface field"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        style={{ minHeight }}
        onInput={emitChange}
        onBlur={emitChange}
        onKeyUp={refreshActiveButtons}
        onMouseUp={refreshActiveButtons}
      />
    </div>
  );
}

function richTextHasContent(html: string): boolean {
  if (typeof DOMParser === "undefined") {
    return html.replace(/<[^>]+>/g, "").trim().length > 0;
  }
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return Boolean(doc.body.textContent?.trim());
}

const SWATCH_COLORS: Record<string, string> = {
  black: "#1a1612",
  navy: "#1e3a5f",
  red: "#8b1e1e",
  gold: "#8a6b2d"
};

const FONT_SIZE_BUTTONS: Record<string, string> = {
  sm: "2",
  md: "3",
  lg: "5",
  xl: "6"
};

function collectActiveToolbarButtons(surface: HTMLElement | null): Set<string> {
  const active = new Set<string>();
  if (!surface) return active;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return active;
  if (!selection.anchorNode || !surface.contains(selection.anchorNode)) return active;

  if (document.queryCommandState("bold")) active.add("bold");
  if (document.queryCommandState("italic")) active.add("italic");
  if (document.queryCommandState("underline")) active.add("underline");
  if (document.queryCommandState("strikeThrough")) active.add("strike");
  if (document.queryCommandState("subscript")) active.add("sub");
  if (document.queryCommandState("superscript")) active.add("sup");
  if (document.queryCommandState("insertUnorderedList")) active.add("bullet");
  if (document.queryCommandState("insertOrderedList")) active.add("number");

  const fontSize = document.queryCommandValue("fontSize");
  for (const [buttonId, size] of Object.entries(FONT_SIZE_BUTTONS)) {
    if (fontSize === size) active.add(buttonId);
  }

  const fontName = normalizeFontName(document.queryCommandValue("fontName"));
  if (fontName.includes("cormorant") || fontName.includes("garamond")) active.add("serif");
  else if (fontName.includes("times")) active.add("times");
  else if (fontName.includes("georgia")) active.add("georgia");
  else if (fontName.includes("arial") || fontName.includes("helvetica") || fontName.includes("sans")) active.add("sans");

  const foreColor = normalizeToolbarColor(document.queryCommandValue("foreColor"));
  for (const [buttonId, hex] of Object.entries(SWATCH_COLORS)) {
    if (colorsMatch(foreColor, hex)) active.add(buttonId);
  }

  const highlight = normalizeToolbarColor(document.queryCommandValue("hiliteColor"));
  if (highlight && highlight !== "transparent" && highlight !== "#ffffff" && highlight !== "rgb(255, 255, 255)") {
    active.add("highlight");
  }

  const block = getActiveEditorBlock(surface);
  if (block) {
    const align = (block.style.textAlign || window.getComputedStyle(block).textAlign || "left").toLowerCase();
    if (align === "center") active.add("center");
    else if (align === "right" || align === "end") active.add("right");
    else if (align === "justify") active.add("justify");
    else active.add("left");

    const lineHeight = normalizeLineHeight(block.style.lineHeight || window.getComputedStyle(block).lineHeight);
    if (lineHeight === "1") active.add("line-1");
    else if (lineHeight === "1.5") active.add("line-15");
    else if (lineHeight === "2") active.add("line-2");

    if (block.tagName === "BLOCKQUOTE") active.add("quote");
  }

  return active;
}

function getActiveEditorBlock(surface: HTMLElement): HTMLElement | null {
  const selection = window.getSelection();
  if (!selection?.anchorNode) return null;
  let node: Node | null = selection.anchorNode;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (!(node instanceof Element) || !surface.contains(node)) return null;
  const block = node.closest("p, div, li, blockquote");
  return block instanceof HTMLElement && surface.contains(block) ? block : null;
}

function normalizeFontName(value: string): string {
  return value.replace(/['"]/g, "").trim().toLowerCase();
}

function normalizeToolbarColor(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === "transparent") return "";
  if (trimmed.startsWith("#")) return trimmed;

  const rgb = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) {
    return `#${[rgb[1], rgb[2], rgb[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
  }

  return trimmed;
}

function colorsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return normalizeToolbarColor(a) === normalizeToolbarColor(b);
}

function normalizeLineHeight(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "normal") return "1";
  if (trimmed.endsWith("px")) {
    const px = Number.parseFloat(trimmed);
    if (!Number.isFinite(px)) return "1";
    const ratio = px / 12;
    if (Math.abs(ratio - 1) < 0.08) return "1";
    if (Math.abs(ratio - 1.5) < 0.08) return "1.5";
    if (Math.abs(ratio - 2) < 0.08) return "2";
  }
  if (trimmed === "1" || trimmed === "1.0") return "1";
  if (trimmed === "1.5") return "1.5";
  if (trimmed === "2" || trimmed === "2.0") return "2";
  return trimmed;
}

function IconBold() {
  return <strong className="rich-text-editor__glyph rich-text-editor__glyph--bold">B</strong>;
}

function IconItalic() {
  return <em className="rich-text-editor__glyph rich-text-editor__glyph--italic">I</em>;
}

function IconUnderline() {
  return <span className="rich-text-editor__glyph rich-text-editor__glyph--underline">U</span>;
}

function IconStrike() {
  return <span className="rich-text-editor__glyph rich-text-editor__glyph--strike">S</span>;
}

function IconUndo() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M3.5 8H11a3.5 3.5 0 1 0 0-7H9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 5.5 3.5 8 6 10.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRedo() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M12.5 8H5a3.5 3.5 0 1 1 0-7h2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 5.5 12.5 8 10 10.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconHighlight() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M3 12.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="m5.5 11 4.5-7.5 2 2-4.5 7.5z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

function IconClearHighlight() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M4 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="m6 11 3.5-6 1.5 1.5-3.5 6z" fill="currentColor" opacity="0.45" />
      <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconAlignLeft() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M2.5 3.5h11M2.5 6.5h7M2.5 9.5h9M2.5 12.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconAlignCenter() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M2.5 3.5h11M4.5 6.5h7M3.5 9.5h9M5.5 12.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconAlignRight() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M2.5 3.5h11M6.5 6.5h7M4.5 9.5h9M8.5 12.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconAlignJustify() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M2.5 3.5h11M2.5 6.5h11M2.5 9.5h11M2.5 12.5h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconIndent() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M2.5 3.5h8M2.5 6.5h8M2.5 9.5h8M2.5 12.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11.5 6.5 13.5 8 11.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconOutdent() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M4.5 3.5h8M4.5 6.5h8M4.5 9.5h8M4.5 12.5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M2.5 6.5 4.5 8 2.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBulletList() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <circle cx="3" cy="4.5" r="1" fill="currentColor" />
      <circle cx="3" cy="8" r="1" fill="currentColor" />
      <circle cx="3" cy="11.5" r="1" fill="currentColor" />
      <path d="M6 4.5h7M6 8h7M6 11.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconNumberList() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M2.2 4.2h1.1M2.2 7.7h1.1M2.2 11.2h1.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M6 4.5h7M6 8h7M6 11.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconQuote() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M4.5 5.5c0-1.5 1-2.5 2.5-2.5v1.5c-.7 0-1 .5-1 1.2v.3h1.5V11H3.5V7.8c0-1 .5-1.6 1-2.3zM10 5.5c0-1.5 1-2.5 2.5-2.5v1.5c-.7 0-1 .5-1 1.2v.3H13V11h-3.5V7.8c0-1 .5-1.6 1-2.3z" fill="currentColor" />
    </svg>
  );
}

function IconRule() {
  return (
    <svg viewBox="0 0 16 16" className="rich-text-editor__svg" aria-hidden>
      <path d="M2.5 8h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
