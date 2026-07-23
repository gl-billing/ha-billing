"use client";

import { useMemo, useState } from "react";
import type { ActivityItem } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { filterTimelineItems, type TimelineFilter } from "@/lib/sheets/timeline-filters";
import { activityItemModificationNote } from "@/lib/history-modification-note";
import { EmptyState } from "@/components/office-tasks/PremiumUI";

const kindLabels: Record<ActivityItem["kind"], string> = {
  charge: "Charge",
  payment: "Payment",
  soa: "SOA",
  ar: "Receipt",
  billing: "Billing",
  task: "Task",
  hearing: "Hearing",
  "task-action": "Staff action"
};

const kindColors: Record<ActivityItem["kind"], string> = {
  charge: "text-[#8b1e1e]",
  payment: "text-ink",
  soa: "text-ink",
  ar: "text-ink",
  billing: "text-muted",
  task: "text-ink",
  hearing: "text-ink",
  "task-action": "text-muted"
};

const kindDotClasses: Record<ActivityItem["kind"], string> = {
  charge: "border-[#8b1e1e] bg-[#fde8e8]",
  payment: "border-ink bg-soft",
  soa: "border-ink bg-cream",
  ar: "border-ink bg-cream",
  billing: "border-line bg-soft",
  task: "border-ink bg-soft",
  hearing: "border-ink bg-ink",
  "task-action": "border-ink bg-white"
};

const DOT_LEGEND: Array<{ kind: ActivityItem["kind"]; label: string }> = [
  { kind: "task", label: "Task" },
  { kind: "task-action", label: "Staff action" },
  { kind: "hearing", label: "Hearing" },
  { kind: "charge", label: "Charge" },
  { kind: "payment", label: "Payment" },
  { kind: "soa", label: "SOA / Receipt" },
  { kind: "billing", label: "Billing" }
];

const FILTERS: Array<{ id: TimelineFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "billing", label: "Billing" },
  { id: "documents", label: "Documents" },
  { id: "tasks", label: "Tasks" },
  { id: "hearings", label: "Hearings" }
];

type Props = {
  items: ActivityItem[];
  loading?: boolean;
  showFilters?: boolean;
  /** When set, task/hearing rows show a link that scrolls to the item in the matter view. */
  enableMatterJump?: boolean;
  /** Override jump behavior (e.g. switch tabs before scrolling). */
  onMatterJump?: (anchorId: string) => void;
  /** Color-code timeline dots by item type (matter popup preview). */
  coloredDots?: boolean;
  /** Show a dot color key above the timeline. */
  showDotLegend?: boolean;
  /** Scroll/highlight a timeline row by activity id (from matter deep links). */
  highlightId?: string;
};

function TimelineDot({ kind, className = "" }: { kind: ActivityItem["kind"]; className?: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 ${kindDotClasses[kind]} ${className}`}
      aria-hidden
    />
  );
}

function TimelineDotLegend() {
  return (
    <div className="activity-timeline__dot-legend" aria-label="Timeline dot colors">
      <p className="activity-timeline__dot-legend-title">Dot colors</p>
      <ul className="activity-timeline__dot-legend-list">
        {DOT_LEGEND.map(({ kind, label }) => (
          <li key={kind} className="activity-timeline__dot-legend-item">
            <TimelineDot kind={kind} />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function jumpToMatterItem(anchorId: string) {
  const el = document.getElementById(anchorId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("matter-item-anchor--highlight");
  window.setTimeout(() => el.classList.remove("matter-item-anchor--highlight"), 1800);
}

function docStatusTone(status: string): "sent" | "draft" | "pending" | "default" {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("sent") || normalized.includes("paid") || normalized.includes("complete")) {
    return "sent";
  }
  if (normalized.includes("draft")) return "draft";
  if (
    normalized.includes("pending") ||
    normalized.includes("overdue") ||
    normalized.includes("await") ||
    normalized.includes("due")
  ) {
    return "pending";
  }
  return "default";
}

function DocStatusPill({ status, kind }: { status: string; kind: ActivityItem["kind"] }) {
  const tone = docStatusTone(status);
  const label =
    kind === "soa" ? "SOA" : kind === "ar" ? "Receipt" : kind === "billing" ? "Document" : "Status";
  return (
    <span className={`activity-timeline__doc-status activity-timeline__doc-status--${tone}`}>
      {label}: {status}
    </span>
  );
}

export function ClientActivityTimeline({
  items,
  loading,
  showFilters = true,
  enableMatterJump = false,
  onMatterJump,
  coloredDots = false,
  showDotLegend = false,
  highlightId
}: Props) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const visible = useMemo(() => filterTimelineItems(items, filter), [items, filter]);

  if (loading) {
    return <p className="text-sm text-muted">Loading activity...</p>;
  }

  if (!items.length) {
    return <EmptyState compact message="No activity recorded yet." />;
  }

  return (
    <div>
      {showFilters ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`activity-timeline__filter-pill${filter === id ? " activity-timeline__filter-pill--active" : ""}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {showDotLegend ? <TimelineDotLegend /> : null}

      {!visible.length ? (
        <EmptyState compact message="No items in this filter." />
      ) : (
        <div className="relative space-y-0 pl-4">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-line" />
          {visible.map((item) => {
            const isStaffAction = item.kind === "task-action";
            const modificationNote = activityItemModificationNote(item);
            const canJump =
              enableMatterJump &&
              (item.kind === "task" || item.kind === "hearing") &&
              Boolean(item.matterAnchor);

            return (
              <article
                key={item.id}
                id={`timeline-${item.id}`}
                className={`relative pb-4 last:pb-0${highlightId === item.id ? " activity-timeline__entry--highlight" : ""}`}
              >
                <div
                  className={`absolute -left-4 top-1.5 h-3 w-3 rounded-full border-2 ${
                    coloredDots ? kindDotClasses[item.kind] : "border-ink bg-white"
                  }`}
                  aria-hidden
                />
                <div
                  className={`history-entry rounded-lg border border-line/60 bg-[#faf9f7] p-2.5 ${
                    modificationNote ? "history-entry--noted" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                        {kindLabels[item.kind]}
                      </p>
                      <p className="text-sm font-bold text-ink">{item.title}</p>
                      <p className="text-[11px] text-muted">{item.date}</p>
                    </div>
                    {item.amount !== undefined && item.amount > 0 && (
                      <p className={`shrink-0 font-extrabold ${kindColors[item.kind]}`}>
                        {formatPeso(item.amount)}
                      </p>
                    )}
                  </div>
                  {item.subtitle ? <p className="mt-1 text-xs text-muted">{item.subtitle}</p> : null}
                  {!isStaffAction && item.status && (item.kind === "soa" || item.kind === "ar" || item.kind === "billing") ? (
                    <DocStatusPill status={item.status} kind={item.kind} />
                  ) : !isStaffAction && item.status ? (
                    <p className="mt-1 text-[11px] font-bold text-muted">{item.status}</p>
                  ) : null}
                  {item.pdfUrl ? (
                    <a
                      href={item.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-gold mt-2 inline-block"
                    >
                      View PDF
                    </a>
                  ) : null}
                  {canJump ? (
                    <div className="mt-2 flex items-center justify-end gap-2 border-t border-line/40 pt-2">
                      {canJump && item.matterAnchor ? (
                        <button
                          type="button"
                          className="activity-timeline__jump-link"
                          onClick={() =>
                            onMatterJump
                              ? onMatterJump(item.matterAnchor!)
                              : jumpToMatterItem(item.matterAnchor!)
                          }
                        >
                          {item.kind === "hearing" ? "View event →" : "View task →"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {modificationNote ? <span className="history-entry__note">{modificationNote}</span> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
