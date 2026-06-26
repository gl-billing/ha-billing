export const FIRM_COPYRIGHT_HOLDER = "Hernandez & Associates";

export function firmCopyrightLine(year = new Date().getFullYear()): string {
  return `© ${year} ${FIRM_COPYRIGHT_HOLDER}`;
}
