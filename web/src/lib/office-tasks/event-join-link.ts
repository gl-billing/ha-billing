import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isScheduleConfirmationEvent } from "@/lib/office-tasks/event-form-utils";

export type EventJoinLinkFields = Pick<OfficeItem, "source" | "category" | "platform" | "venue" | "details">;

function extractUrlFromText(value: string): string | null {
  const match = String(value || "").match(/https?:\/\/[^\s<>"']+/i);
  return match?.[0] || null;
}

/** Reuse an existing join URL from venue or details when present. */
export function resolveEventJoinUrl(item: Pick<OfficeItem, "venue" | "details">): string | null {
  const fromVenue = extractUrlFromText(item.venue);
  if (fromVenue) return fromVenue;
  const fromDetails = extractUrlFromText(item.details);
  if (fromDetails) return fromDetails;
  if (/meet\.google\.com/i.test(item.venue)) {
    const bare = item.venue.trim();
    return bare.startsWith("http") ? bare : `https://${bare.replace(/^\/\//, "")}`;
  }
  return null;
}

export function shouldShowEventJoinLink(item: EventJoinLinkFields): boolean {
  if (item.source !== "Event") return false;
  if (!isScheduleConfirmationEvent(item)) return false;
  return Boolean(resolveEventJoinUrl(item));
}

export function eventJoinLinkLabel(platform: string): string {
  switch (platform.trim()) {
    case "Google Meet":
      return "Join via Google Meet";
    case "Zoom":
      return "Join via Zoom";
    case "Microsoft Teams":
      return "Join via Microsoft Teams";
    case "Phone":
      return "Phone conference";
    case "Court AVR":
      return "Court AVR session";
    default:
      return "Open meeting link";
  }
}

/** Venue text without duplicating a join URL already shown separately. */
export function eventVenueDisplay(
  venue: string | undefined,
  joinUrl: string | null
): string {
  const trimmed = venue?.trim() || "";
  if (!trimmed) return "";
  if (!joinUrl) return trimmed;
  if (trimmed === joinUrl) return "";
  if (extractUrlFromText(trimmed) === joinUrl && trimmed.replace(joinUrl, "").trim().length === 0) {
    return "";
  }
  return trimmed;
}

export type EventJoinLinkPatch = {
  meetLink?: string | null;
  venue?: string;
  details?: string;
};

export type EventScheduleEmailSentPatch = EventJoinLinkPatch & {
  source: string;
  rowNumber: number;
};

export function buildPersistedEventJoinFields(
  item: Pick<OfficeItem, "venue" | "details">,
  meetLink: string
): { venue: string; details: string } {
  const link = meetLink.trim();
  const venue = item.venue?.trim() || "";
  const details = item.details?.trim() || "";

  if (!venue) {
    return { venue: link, details };
  }

  if (extractUrlFromText(venue)) {
    return { venue, details };
  }

  return {
    venue,
    details: details ? `${details}\nMeeting link: ${link}` : `Meeting link: ${link}`
  };
}

export function applyEventJoinLinkPatch<T extends Pick<OfficeItem, "venue" | "details">>(
  item: T,
  patch: EventJoinLinkPatch
): T {
  if (patch.venue !== undefined || patch.details !== undefined) {
    return {
      ...item,
      ...(patch.venue !== undefined ? { venue: patch.venue } : {}),
      ...(patch.details !== undefined ? { details: patch.details } : {})
    };
  }

  if (!patch.meetLink?.trim() || resolveEventJoinUrl(item)) {
    return item;
  }

  const next = buildPersistedEventJoinFields(item, patch.meetLink);
  return { ...item, ...next };
}
