"use client";

import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { eventVenueDisplay, resolveEventJoinUrl } from "@/lib/office-tasks/event-join-link";
import { myWorkItemKindLabel } from "@/lib/office-tasks/schedule";

export type ItemDetailsSection = {
  label: string;
  value: string;
};

type Props = {
  item: ItemSummary;
  open: boolean;
  sections: ItemDetailsSection[];
  metaLine?: string;
  onClose: () => void;
};

export function ItemDetailsDialog({ item, open, sections, metaLine, onClose }: Props) {
  useBodyScrollLock(open);

  if (!open) return null;

  const kind = myWorkItemKindLabel(item);
  const joinUrl = item.source === "Event" ? resolveEventJoinUrl(item) : null;
  const venue = eventVenueDisplay(item.venue, joinUrl);

  return (
    <ModalPortal>
      <div className="modal-backdrop item-details-dialog__backdrop" role="dialog" aria-modal="true" aria-labelledby="item-details-title">
        <div className="modal-panel item-details-dialog">
          <div className="item-details-dialog__accent" aria-hidden />

          <div className="item-details-dialog__inner">
            <header className="item-details-dialog__head">
              <div className="item-details-dialog__head-main">
                <p className="item-details-dialog__kind">{kind}</p>
                <h2 id="item-details-title" className="item-details-dialog__title">
                  {item.clientCase?.trim() || "Task details"}
                </h2>
                {metaLine ? <p className="item-details-dialog__meta">{metaLine}</p> : null}
                {venue ? <p className="item-details-dialog__meta">Venue: {venue}</p> : null}
              </div>
              <button
                type="button"
                className="item-details-dialog__close"
                aria-label="Close"
                onClick={onClose}
              >
                ×
              </button>
            </header>

            <div className="item-details-dialog__body">
              {sections.map((section) => (
                <section key={section.label} className="item-details-dialog__section">
                  <h3 className="item-details-dialog__label">{section.label}</h3>
                  <p className="item-details-dialog__text">{section.value}</p>
                </section>
              ))}
            </div>

            <footer className="item-details-dialog__foot">
              <button type="button" className="item-details-dialog__done" onClick={onClose}>
                Close
              </button>
            </footer>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function buildItemDetailsSections(input: {
  description: string;
  nextAction: string;
  followUpNote?: string;
  workflowHint?: string | null;
}): ItemDetailsSection[] {
  const sections: ItemDetailsSection[] = [];
  const description = input.description.trim();
  const nextAction = input.nextAction.trim();
  const followUpNote = input.followUpNote?.trim() || "";
  const workflowHint = input.workflowHint?.trim() || "";

  if (description) sections.push({ label: "Details", value: description });
  if (nextAction && nextAction !== description) {
    sections.push({ label: "Next action", value: nextAction });
  }
  if (workflowHint) sections.push({ label: "Workflow", value: workflowHint });
  if (followUpNote) sections.push({ label: "Follow-up note", value: followUpNote });

  if (!sections.length) {
    sections.push({ label: "Details", value: "—" });
  }

  return sections;
}

export function shouldOfferReadAllDetails(input: {
  description: string;
  nextAction: string;
  followUpNote?: string;
  workflowHint?: string | null;
  previewLimit?: number;
}): boolean {
  const limit = input.previewLimit ?? 120;
  const description = input.description.trim();
  const nextAction = input.nextAction.trim();
  const followUpNote = input.followUpNote?.trim() || "";
  const workflowHint = input.workflowHint?.trim() || "";
  const primary = description || nextAction;

  if (workflowHint) return true;
  if (followUpNote.length > 80) return true;
  if (primary.length > limit) return true;
  if (description && nextAction && nextAction !== description && nextAction.length > 60) return true;
  return false;
}
