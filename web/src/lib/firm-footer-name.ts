/** Two-line edge-aligned firm name for letter/SOA footers and app chrome. */
export const FIRM_FOOTER_CAPS_LINE_1 = "HERNANDEZ";
export const FIRM_FOOTER_CAPS_LINE_2 = "& ASSOCIATES";

export function splitFooterCapsChars(text: string): string[] {
  return [...text];
}

/** Natural width of the wider line — used to keep both rows aligned without full-page stretch. */
export function footerNameBlockWidth(measureChar: (char: string) => number): number {
  const lineWidth = (line: string) =>
    splitFooterCapsChars(line).reduce((sum, char) => sum + measureChar(char), 0);
  return Math.max(lineWidth(FIRM_FOOTER_CAPS_LINE_1), lineWidth(FIRM_FOOTER_CAPS_LINE_2));
}

export function footerNameBlockBounds(
  pageWidth: number,
  measureChar: (char: string) => number
): { left: number; right: number; width: number } {
  const width = footerNameBlockWidth(measureChar);
  const left = (pageWidth - width) / 2;
  return { left, right: left + width, width };
}
