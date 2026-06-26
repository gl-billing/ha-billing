export type MatterTab = "overview" | "tasks" | "billing" | "documents";

export type BillingSection = "add" | "documents" | "advanced";

export type MatterQuery = {
  tab?: MatterTab;
  intake?: boolean;
  walkin?: string;
  section?: BillingSection;
  edit?: boolean;
  case?: string;
  birthdayGreeting?: boolean;
  from?: string;
  highlightTask?: string;
};

export function matterHref(code: string, tab?: MatterTab, extra?: Omit<MatterQuery, "tab">): string {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return "/app";
  const base = `/matter/${encodeURIComponent(trimmed)}`;
  const params = new URLSearchParams();
  if (tab && tab !== "overview") params.set("tab", tab);
  if (extra?.intake) params.set("intake", "1");
  if (extra?.walkin?.trim()) params.set("walkin", extra.walkin.trim());
  if (extra?.section) params.set("section", extra.section);
  if (extra?.edit) params.set("edit", "1");
  if (extra?.case?.trim()) params.set("case", extra.case.trim());
  if (extra?.birthdayGreeting) params.set("birthdayGreeting", "1");
  if (extra?.from?.trim()) params.set("from", extra.from.trim());
  if (extra?.highlightTask?.trim()) params.set("highlightTask", extra.highlightTask.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function parseBillingSection(value: string | null | undefined): BillingSection | null {
  const section = value?.trim().toLowerCase();
  if (section === "add" || section === "documents" || section === "advanced") {
    return section;
  }
  if (section === "client" || section === "history") return "advanced";
  return null;
}

export function parseMatterTab(value: string | null | undefined): MatterTab {
  const tab = value?.trim().toLowerCase();
  if (tab === "tasks" || tab === "billing" || tab === "documents") return tab;
  return "overview";
}
