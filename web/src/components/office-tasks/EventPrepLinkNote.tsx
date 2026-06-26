"use client";

import { useMemo } from "react";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { buildEventPrepLinkNote } from "@/lib/office-tasks/event-prep-workload";
import { resolvePrepWorkloadViewRole, type PrepWorkloadViewRole } from "@/lib/office-tasks/prep-workload-view";

type Props = {
  item: OfficeItem;
  allItems?: OfficeItem[];
  viewerStaffName?: string;
  viewerPrepRole?: PrepWorkloadViewRole;
  roster?: string[];
};

function scrollToLinkedItem(anchorId: string): void {
  document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function EventPrepLinkNote({
  item,
  allItems = [],
  viewerStaffName,
  viewerPrepRole,
  roster = []
}: Props) {
  const role = useMemo(() => {
    if (viewerPrepRole) return viewerPrepRole;
    if (!viewerStaffName?.trim()) return "neutral" as const;
    return resolvePrepWorkloadViewRole(viewerStaffName, roster);
  }, [viewerStaffName, roster, viewerPrepRole]);

  const note = useMemo(() => buildEventPrepLinkNote(item, allItems, role), [item, allItems, role]);
  if (!note) return null;

  return (
    <p className="my-work-list__linked-note">
      <span>{note.text} </span>
      <button
        type="button"
        className="my-work-list__linked-link"
        onClick={() => scrollToLinkedItem(note.anchorId)}
      >
        {note.linkLabel}
      </button>
    </p>
  );
}
