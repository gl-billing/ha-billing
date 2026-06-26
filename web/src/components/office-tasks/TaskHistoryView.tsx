"use client";

import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { HistorySkeleton } from "@/components/Skeleton";
import type { TaskActivityEntry } from "@/lib/office-tasks/sheets/activity-log";
import { taskActivityModificationNote } from "@/lib/history-modification-note";

type Props = {
  items: TaskActivityEntry[];
  loading?: boolean;
};

const actionLabels: Record<string, string> = {
  status: "Status change",
  done: "Marked done",
  reopen: "Reopened",
  "next-action": "Next action",
  edit: "Edited",
  create: "Created",
  delete: "Deleted",
  cancel: "Cancelled",
  remove: "Removed"
};

export function TaskHistoryView({ items, loading }: Props) {
  if (loading) {
    return <HistorySkeleton />;
  }

  if (!items.length) {
    return (
      <EmptyState
        title="No history yet"
        message="Staff actions from the Tasks app — status changes, done, next action, and edits — will appear here as they happen."
      />
    );
  }

  return (
    <div className="relative space-y-0 pl-4">
      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-line" />
      {items.map((item) => {
        const modificationNote = taskActivityModificationNote(item);
        return (
        <article key={item.logRow} className="relative pb-4 last:pb-0">
          <div className="absolute -left-4 top-1.5 h-3 w-3 rounded-full border-2 border-gold bg-white" />
          <div
            className={`history-entry rounded-lg border border-line/60 bg-[#faf9f7] p-2.5 ${
              modificationNote ? "history-entry--noted" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="history-entry__action text-[11px] font-semibold text-gold-dark">
                  {actionLabels[item.action] || item.action}
                  {item.source ? ` · ${item.source}` : ""}
                </p>
                <p className="text-sm font-bold text-ink">{item.summary}</p>
                <p className="text-[11px] text-muted">
                  {item.timestamp}
                  {item.user ? ` · ${item.user}` : ""}
                </p>
              </div>
              {item.itemId && (
                <span className="shrink-0 rounded bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-muted">
                  {item.itemId}
                </span>
              )}
            </div>
            {item.clientCase && <p className="mt-1 text-xs text-muted">{item.clientCase}</p>}
            {item.details && <p className="mt-1 text-xs text-ink/80">{item.details}</p>}
            {modificationNote ? <span className="history-entry__note">{modificationNote}</span> : null}
          </div>
        </article>
        );
      })}
    </div>
  );
}
