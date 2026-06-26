import type { CaseOption } from "@/lib/gl-config";
import type { OfficeItem } from "@/lib/office-tasks/item-types";

/** Case labels for task forms when staff cannot read the billing Master List. */
export function buildCaseOptionsFromTaskItems(items: OfficeItem[]): CaseOption[] {
  const labels = new Set<string>();
  for (const item of items) {
    const label = item.clientCase?.trim();
    if (label) labels.add(label);
  }

  return [...labels].map((label, index) => {
    const dash = label.indexOf(" — ");
    const name = dash >= 0 ? label.slice(0, dash).trim() : label;
    const matter = dash >= 0 ? label.slice(dash + 3).trim() : "";
    return {
      id: `task:${index}:${label}`,
      label,
      name,
      matter,
      kind: "task"
    };
  });
}
