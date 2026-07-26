import { randomUUID } from "crypto";
import {
  appendSheetValues,
  getSheetValues,
  toA1Range,
  updateSheetValues
} from "@/lib/sheets/client";
import { ensureSheetTitle } from "@/lib/sheets/sheet-meta";
import { primaryContactEmail } from "@/lib/contact-emails";
import { isValidEmailAddress } from "@/lib/email-utils";

export const CLIENT_MESSAGES_SHEET = "Client Messages";

const HEADERS = [
  "Message ID",
  "Sent At",
  "From Email",
  "From Name",
  "Client Code",
  "To Email",
  "To Name",
  "Subject",
  "Body",
  "Gmail Sent",
  "WhatsApp Sent"
] as const;

export type ClientMessageRecord = {
  id: string;
  sentAt: string;
  fromEmail: string;
  fromName: string;
  clientCode: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  gmailSent: boolean;
  whatsAppSent: boolean;
  rowNumber: number;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function rowToMessage(row: string[], rowNumber: number): ClientMessageRecord | null {
  const id = String(row[0] || "").trim();
  if (!id) return null;
  return {
    id,
    sentAt: String(row[1] || "").trim(),
    fromEmail: normalizeEmail(String(row[2] || "")),
    fromName: String(row[3] || "").trim(),
    clientCode: String(row[4] || "").trim().toUpperCase(),
    toEmail: normalizeEmail(String(row[5] || "")),
    toName: String(row[6] || "").trim(),
    subject: String(row[7] || "").trim(),
    body: String(row[8] || "").trim(),
    gmailSent: String(row[9] || "").trim().toUpperCase() === "TRUE",
    whatsAppSent: String(row[10] || "").trim().toUpperCase() === "TRUE",
    rowNumber
  };
}

async function ensureClientMessagesSheet(accessToken: string): Promise<void> {
  await ensureSheetTitle(accessToken, CLIENT_MESSAGES_SHEET);
  const headerRow = await getSheetValues(accessToken, toA1Range(CLIENT_MESSAGES_SHEET, "A1:K1"));
  if (!headerRow[0]?.[0]) {
    await updateSheetValues(accessToken, toA1Range(CLIENT_MESSAGES_SHEET, "A1:K1"), [[...HEADERS]]);
  }
}

export async function listClientMessages(accessToken: string, limit = 80): Promise<ClientMessageRecord[]> {
  await ensureClientMessagesSheet(accessToken);
  const values = await getSheetValues(accessToken, toA1Range(CLIENT_MESSAGES_SHEET, "A2:K"));
  const messages = values
    .map((row, index) => rowToMessage(row, index + 2))
    .filter((row): row is ClientMessageRecord => Boolean(row));

  messages.sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.rowNumber - a.rowNumber);
  return messages.slice(0, limit);
}

export async function appendClientMessage(
  accessToken: string,
  input: {
    fromEmail: string;
    fromName: string;
    clientCode: string;
    toEmail: string;
    toName: string;
    subject: string;
    body: string;
    gmailSent?: boolean;
    whatsAppSent?: boolean;
  }
): Promise<ClientMessageRecord> {
  await ensureClientMessagesSheet(accessToken);

  const subject = input.subject.trim();
  const body = input.body.trim();
  const toEmail = normalizeEmail(input.toEmail);
  const fromEmail = normalizeEmail(input.fromEmail);
  const clientCode = input.clientCode.trim().toUpperCase();

  if (!clientCode) throw new Error("Choose a client.");
  if (!toEmail || !isValidEmailAddress(toEmail)) throw new Error("Client needs a valid email on file.");
  if (!subject) throw new Error("Subject is required.");
  if (!body) throw new Error("Message body is required.");
  if (subject.length > 120) throw new Error("Subject must be 120 characters or less.");
  if (body.length > 4000) throw new Error("Message must be 4000 characters or less.");

  const id = `CMSG-${randomUUID().slice(0, 8).toUpperCase()}`;
  const sentAt = new Date().toISOString();

  await appendSheetValues(accessToken, toA1Range(CLIENT_MESSAGES_SHEET, "A:K"), [
    [
      id,
      sentAt,
      fromEmail,
      input.fromName.trim(),
      clientCode,
      toEmail,
      input.toName.trim(),
      subject,
      body,
      input.gmailSent ? "TRUE" : "FALSE",
      input.whatsAppSent ? "TRUE" : "FALSE"
    ]
  ]);

  const rows = await getSheetValues(accessToken, toA1Range(CLIENT_MESSAGES_SHEET, "A2:K"));
  const rowNumber = rows.findIndex((row) => String(row[0] || "").trim() === id) + 2;
  const message = rowToMessage(rows[rowNumber - 2] || [], rowNumber);
  if (!message) throw new Error("Could not save client message.");
  return message;
}

export function resolveClientMessageRecipient(input: {
  code: string;
  name: string;
  email?: string;
  phone?: string;
}): { code: string; name: string; email: string; phone: string } | null {
  const email = primaryContactEmail(input.email || "");
  if (!email || !isValidEmailAddress(email)) return null;
  return {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim() || input.code.trim().toUpperCase(),
    email: normalizeEmail(email),
    phone: String(input.phone || "").trim()
  };
}
