export const FIRM_COPYRIGHT_HOLDER = "Hernandez & Associates";

export const APP_SHORT_NAME = process.env.NEXT_PUBLIC_APP_SHORT_NAME?.trim() || "HA Office";

export function firmCopyrightLine(): string {
  return "© 2026 AEGYS, a product of A & S INFORMATION SOLUTIONS OPC. All rights reserved.";
}
