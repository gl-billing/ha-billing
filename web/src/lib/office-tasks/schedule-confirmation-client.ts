import type { ScheduleConfirmationDraft } from "@/lib/office-tasks/event-form-utils";
import { buildScheduleConfirmationDraftItem } from "@/lib/office-tasks/event-form-utils";
import { isValidEmailAddress } from "@/lib/email-utils";
import { parseApiJson } from "@/lib/parse-api-response";

type PreviewPayload = {
  recipientEmail?: string;
  recipientEmails?: string[];
  hasValidRecipient?: boolean;
  error?: string;
};

type SendPayload = {
  message?: string;
  meetLink?: string | null;
  venue?: string;
  details?: string;
  error?: string;
};

export type ScheduleConfirmationSendResult = {
  message: string;
  meetLink?: string | null;
  venue?: string;
  details?: string;
};

export type ScheduleConfirmationSendInput = {
  source?: string;
  rowNumber: number;
  itemId?: string;
  recipientEmails: string[];
  customNote?: string;
  createMeetLink?: boolean;
};

export function normalizeRecipientEmailList(emails: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of emails) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

export function hasValidScheduleRecipients(emails: string[]): boolean {
  return normalizeRecipientEmailList(emails).some((email) => isValidEmailAddress(email));
}

export function validateScheduleDraftForSend(draft: ScheduleConfirmationDraft): string | null {
  if (!draft.clientCase.trim()) return "Select a client / case before sending schedule confirmation.";
  if (!String(draft.eventDate || "").trim()) return "Enter the event date before sending schedule confirmation.";
  return null;
}

export function resolveLocalScheduleRecipients(emails: string[]): string[] {
  return normalizeRecipientEmailList(emails);
}

export function canAutoSendScheduleConfirmation(emails: string[]): boolean {
  return hasValidScheduleRecipients(resolveLocalScheduleRecipients(emails));
}

export async function previewSavedEventScheduleRecipients(input: {
  source?: string;
  rowNumber: number;
  itemId?: string;
}): Promise<string[]> {
  const { ok, data, errorMessage } = await parseApiJson<PreviewPayload>(
    await fetch("/api/tasks/events/schedule-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "preview",
        source: input.source || "Event",
        rowNumber: input.rowNumber,
        itemId: input.itemId || undefined
      })
    })
  );
  if (!ok || errorMessage || data.error) {
    throw new Error(errorMessage || data.error || "Could not look up client email.");
  }
  const fromList = Array.isArray(data.recipientEmails) ? data.recipientEmails : [];
  if (fromList.length) return resolveLocalScheduleRecipients(fromList);
  if (data.recipientEmail?.trim()) return resolveLocalScheduleRecipients([data.recipientEmail]);
  return [];
}

export async function sendScheduleConfirmation(input: ScheduleConfirmationSendInput): Promise<ScheduleConfirmationSendResult> {
  const recipientEmails = resolveLocalScheduleRecipients(input.recipientEmails);
  if (!hasValidScheduleRecipients(recipientEmails)) {
    throw new Error("Add at least one valid client email before sending.");
  }

  const { ok, data, errorMessage } = await parseApiJson<SendPayload>(
    await fetch("/api/tasks/events/schedule-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        source: input.source || "Event",
        rowNumber: input.rowNumber,
        itemId: input.itemId || undefined,
        recipientEmails,
        customNote: input.customNote?.trim() || undefined,
        createMeetLink: input.createMeetLink !== false
      })
    })
  );
  if (!ok || errorMessage || data.error) {
    throw new Error(errorMessage || data.error || "Could not send schedule confirmation.");
  }
  return {
    message: data.message || "Schedule confirmation sent.",
    meetLink: data.meetLink ?? null,
    venue: data.venue,
    details: data.details
  };
}

export function buildScheduleDraftItem(draft: ScheduleConfirmationDraft) {
  return buildScheduleConfirmationDraftItem(draft);
}
