"use client";

import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import {
  eventJoinLinkLabel,
  resolveEventJoinUrl,
  shouldShowEventJoinLink
} from "@/lib/office-tasks/event-join-link";

type Props = {
  item: Pick<ItemSummary, "source" | "category" | "platform" | "venue" | "details">;
  variant?: "card" | "list";
  className?: string;
};

export function EventJoinLink({ item, variant = "card", className = "" }: Props) {
  if (!shouldShowEventJoinLink(item)) return null;

  const joinUrl = resolveEventJoinUrl(item);
  if (!joinUrl) return null;

  const label = eventJoinLinkLabel(item.platform || "");
  const rootClass = [
    variant === "list" ? "event-join-link event-join-link--list" : "event-join-link event-join-link--card",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <p className={rootClass}>
      <span className="event-join-link__label">{label}</span>
      <a
        href={joinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="event-join-link__anchor"
        title={joinUrl}
      >
        {joinUrl}
      </a>
    </p>
  );
}
