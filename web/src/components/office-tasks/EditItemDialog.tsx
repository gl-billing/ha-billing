"use client";

import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import { EventEditForm } from "@/components/office-tasks/EventEditForm";
import { TaskEditForm } from "@/components/office-tasks/TaskEditForm";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

export type EditableItem = ItemSummary & {
  previousAction?: string;
  endTime?: string | null;
  eventDate?: string | null;
  filingDeadline?: string | null;
  reminderDays?: number;
  calendarSync?: boolean;
  platform?: string;
  filingMode?: string;
  pleadingType?: string;
  pleadingCaseNature?: string;
  receivedDate?: string | null;
  periodToFileDays?: number;
  filingDate?: string | null;
};

type Props = {
  item: EditableItem;
  options: EntryFormOptions;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (item: EditableItem, payload: Record<string, unknown>) => void;
};

export function EditItemDialog({ item, options, open, busy, onClose, onConfirm }: Props) {
  useBodyScrollLock(open);
  if (!open) return null;

  const isTask = item.source === "Task";

  return (
    <ModalPortal>
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-item-title">
      <div className={`modal-panel max-h-[90vh] w-full overflow-y-auto ${isTask ? "max-w-2xl" : "max-w-2xl"}`}>
        {isTask ? (
          <TaskEditForm
            item={item}
            options={options}
            busy={busy}
            onClose={onClose}
            onConfirm={(payload) => onConfirm(item, payload)}
          />
        ) : (
          <>
            <h2 id="edit-item-title" className="font-display text-lg font-semibold text-ink">
              Edit event
            </h2>
            <p className="mt-1 text-xs text-muted">
              {item.clientCase || "—"} · {item.id || "no code"}
            </p>
            <div className="mt-4">
              <EventEditForm
                item={item}
                options={options}
                busy={busy}
                onClose={onClose}
                onConfirm={(payload) => onConfirm(item, payload)}
              />
            </div>
          </>
        )}
      </div>
      </div>
    </ModalPortal>
  );
}
