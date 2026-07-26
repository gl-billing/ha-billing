import { randomUUID } from "crypto";
import {
  appendSheetValues,
  getSheetValues,
  getSheetsClient,
  getSpreadsheetIdAsync,
  listSheetTitles,
  toA1Range,
  updateSheetValues
} from "@/lib/office-tasks/sheets/client";
import { getEmployeeDirectory, type EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import type { ExternalCounselRecord } from "@/lib/office-tasks/external-counsel";

export const STAFF_MESSAGES_SHEET = "Staff Messages";

const HEADERS = [
  "Message ID",
  "Sent At",
  "From Email",
  "From Name",
  "To Email",
  "To Name",
  "Subject",
  "Body",
  "Read At",
  "WhatsApp Sent"
] as const;

export type StaffMessageRecord = {
  id: string;
  sentAt: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  readAt: string | null;
  whatsAppSent: boolean;
  rowNumber: number;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function rowToMessage(row: string[], rowNumber: number): StaffMessageRecord | null {
  const id = String(row[0] || "").trim();
  if (!id) return null;
  return {
    id,
    sentAt: String(row[1] || "").trim(),
    fromEmail: normalizeEmail(String(row[2] || "")),
    fromName: String(row[3] || "").trim(),
    toEmail: normalizeEmail(String(row[4] || "")),
    toName: String(row[5] || "").trim(),
    subject: String(row[6] || "").trim(),
    body: String(row[7] || "").trim(),
    readAt: String(row[8] || "").trim() || null,
    whatsAppSent: String(row[9] || "").trim().toUpperCase() === "TRUE",
    rowNumber
  };
}

async function ensureStaffMessagesSheet(accessToken: string): Promise<void> {
  const titles = await listSheetTitles(accessToken);
  if (!titles.includes(STAFF_MESSAGES_SHEET)) {
    const sheets = getSheetsClient(accessToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: await getSpreadsheetIdAsync(),
      requestBody: {
        requests: [{ addSheet: { properties: { title: STAFF_MESSAGES_SHEET } } }]
      }
    });
  }

  const headerRow = await getSheetValues(accessToken, toA1Range(STAFF_MESSAGES_SHEET, "A1:J1"));
  if (!headerRow[0]?.[0]) {
    await updateSheetValues(accessToken, toA1Range(STAFF_MESSAGES_SHEET, "A1:J1"), [[...HEADERS]]);
  }
}

export async function listStaffMessages(accessToken: string, limit = 200): Promise<StaffMessageRecord[]> {
  await ensureStaffMessagesSheet(accessToken);
  const values = await getSheetValues(accessToken, toA1Range(STAFF_MESSAGES_SHEET, "A2:J"));
  const messages = values
    .map((row, index) => rowToMessage(row, index + 2))
    .filter((row): row is StaffMessageRecord => Boolean(row));

  messages.sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.rowNumber - a.rowNumber);
  return messages.slice(0, limit);
}

export async function listInboxForEmail(
  accessToken: string,
  recipientEmail: string,
  limit = 80
): Promise<StaffMessageRecord[]> {
  const email = normalizeEmail(recipientEmail);
  return (await listStaffMessages(accessToken, limit * 2))
    .filter((message) => message.toEmail === email)
    .slice(0, limit);
}

export function countUnreadMessages(messages: StaffMessageRecord[]): number {
  return messages.filter((message) => !message.readAt).length;
}

export async function appendStaffMessage(
  accessToken: string,
  input: {
    fromEmail: string;
    fromName: string;
    toEmail: string;
    toName: string;
    subject: string;
    body: string;
    whatsAppSent?: boolean;
  }
): Promise<StaffMessageRecord> {
  await ensureStaffMessagesSheet(accessToken);

  const subject = input.subject.trim();
  const body = input.body.trim();
  const toEmail = normalizeEmail(input.toEmail);
  const fromEmail = normalizeEmail(input.fromEmail);

  if (!toEmail) throw new Error("Choose a recipient.");
  if (!subject) throw new Error("Subject is required.");
  if (!body) throw new Error("Message body is required.");
  if (subject.length > 120) throw new Error("Subject must be 120 characters or less.");
  if (body.length > 2000) throw new Error("Message must be 2000 characters or less.");
  if (fromEmail && toEmail === fromEmail) throw new Error("You cannot message yourself.");

  const id = `MSG-${randomUUID().slice(0, 8).toUpperCase()}`;
  const sentAt = new Date().toISOString();

  await appendSheetValues(accessToken, toA1Range(STAFF_MESSAGES_SHEET, "A:J"), [
    [
      id,
      sentAt,
      fromEmail,
      input.fromName.trim(),
      toEmail,
      input.toName.trim(),
      subject,
      body,
      "",
      input.whatsAppSent ? "TRUE" : "FALSE"
    ]
  ]);

  const rows = await getSheetValues(accessToken, toA1Range(STAFF_MESSAGES_SHEET, "A2:J"));
  const rowNumber = rows.findIndex((row) => String(row[0] || "").trim() === id) + 2;
  const message = rowToMessage(rows[rowNumber - 2] || [], rowNumber);
  if (!message) throw new Error("Could not save staff message.");
  return message;
}

export async function markStaffMessageRead(
  accessToken: string,
  messageId: string,
  recipientEmail: string
): Promise<StaffMessageRecord | null> {
  await ensureStaffMessagesSheet(accessToken);
  const email = normalizeEmail(recipientEmail);
  const id = messageId.trim();
  if (!id) return null;

  const values = await getSheetValues(accessToken, toA1Range(STAFF_MESSAGES_SHEET, "A2:J"));
  for (let index = 0; index < values.length; index++) {
    const row = values[index];
    if (String(row[0] || "").trim() !== id) continue;
    const message = rowToMessage(row, index + 2);
    if (!message || message.toEmail !== email) return null;
    if (message.readAt) return message;

    const readAt = new Date().toISOString();
    await updateSheetValues(accessToken, toA1Range(STAFF_MESSAGES_SHEET, `I${message.rowNumber}:I${message.rowNumber}`), [
      [readAt]
    ]);
    return { ...message, readAt };
  }

  return null;
}

export function resolveEmployeeRecipient(
  directory: EmployeeRecord[],
  recipientEmail: string
): EmployeeRecord | null {
  const email = normalizeEmail(recipientEmail);
  return directory.find((employee) => normalizeEmail(employee.email) === email) ?? null;
}

export function isMessengerCollaboratingCounsel(row: Pick<ExternalCounselRecord, "active" | "email" | "role">): boolean {
  if (row.active === false) return false;
  if (!normalizeEmail(row.email)) return false;
  return row.role.trim().toLowerCase() === "collaborating counsel";
}

export function resolveCounselRecipient(
  directory: ExternalCounselRecord[],
  recipientEmail: string
): ExternalCounselRecord | null {
  const email = normalizeEmail(recipientEmail);
  return (
    directory.find(
      (counsel) => isMessengerCollaboratingCounsel(counsel) && normalizeEmail(counsel.email) === email
    ) ?? null
  );
}

export type MessengerRecipient =
  | { kind: "staff"; name: string; email: string; phone: string }
  | { kind: "counsel"; name: string; email: string; phone: string; firm: string };

export function resolveMessengerRecipient(input: {
  recipientEmail: string;
  employees: EmployeeRecord[];
  counsel: ExternalCounselRecord[];
}): MessengerRecipient | null {
  const employee = resolveEmployeeRecipient(input.employees, input.recipientEmail);
  if (employee && employee.active !== false && normalizeEmail(employee.email)) {
    return {
      kind: "staff",
      name: employee.name,
      email: normalizeEmail(employee.email),
      phone: employee.phone || ""
    };
  }
  const counsel = resolveCounselRecipient(input.counsel, input.recipientEmail);
  if (counsel) {
    return {
      kind: "counsel",
      name: counsel.name,
      email: normalizeEmail(counsel.email),
      phone: counsel.phone || "",
      firm: counsel.firm || ""
    };
  }
  return null;
}
