export type FirmStatusVariant = "ok" | "warn" | "error" | "processing";

export type FormSavePhase = "processing" | "success" | "error";

export type FormSaveStatus = {
  phase: FormSavePhase;
  message: string;
};

/** How long the bottom status toast stays visible (0 = until dismissed). */
export function firmStatusDismissMs(variant: FirmStatusVariant): number {
  if (variant === "processing") return 0;
  if (variant === "error") return 0;
  if (variant === "warn") return 10_000;
  return 5_000;
}

export function formatSuccessReport(action: string, detail?: string): string {
  const trimmed = action.trim();
  if (!trimmed) return "Saved.";
  if (/^saved\.?$/i.test(trimmed) && !detail) return "Saved.";
  return detail ? `${trimmed} — ${detail}` : trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}
