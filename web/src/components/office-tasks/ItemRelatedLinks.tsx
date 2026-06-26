"use client";

import { parseEventTaskLinks, parsePtoBatchId, parseTaskEventLink } from "@/lib/office-tasks/event-item-links";
import { SourceIdDisplay } from "@/components/office-tasks/SourceIdDisplay";

type Props = {
  source: "Task" | "Event";
  remarks: string;
  clientCase?: string;
  className?: string;
};

export function ItemRelatedLinks({ source, remarks, clientCase, className = "" }: Props) {
  if (source === "Event") {
    const links = parseEventTaskLinks(remarks);
    const ptoBatchId = parsePtoBatchId(remarks);
    const rows: Array<{ label: string; id: string }> = [];
    if (links.followUpTaskId) rows.push({ label: "Filing follow-up", id: links.followUpTaskId });
    if (links.reminderTaskId) rows.push({ label: "Prep reminder", id: links.reminderTaskId });

    if (!rows.length && !ptoBatchId) return null;
    return (
      <div className={`item-related-links ${className}`.trim()}>
        {ptoBatchId ? (
          <span className="item-related-links__pill item-related-links__pill--pto">
            <span className="item-related-links__label">PTO schedule</span>
            <span className="item-related-links__batch">{ptoBatchId}</span>
          </span>
        ) : null}
        {rows.map((row) => (
          <span key={row.id} className="item-related-links__pill">
            <span className="item-related-links__label">{row.label}</span>
            <SourceIdDisplay id={row.id} clientCase={clientCase} variant="mini" />
          </span>
        ))}
      </div>
    );
  }

  const link = parseTaskEventLink(remarks);
  if (!link) return null;
  return (
    <div className={`item-related-links ${className}`.trim()}>
      <span className="item-related-links__pill">
        <span className="item-related-links__label">
          {link.kind === "reminder" ? "Prep for event" : "Linked event"}
        </span>
        <SourceIdDisplay id={link.eventId} clientCase={clientCase} variant="mini" />
      </span>
    </div>
  );
}
