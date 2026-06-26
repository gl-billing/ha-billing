import {
  birthdayGreetingSentYear,
  birthdayGreetingSubject,
  buildBirthdayGreetingHtml,
  buildBirthdayGreetingPlain,
  formatBirthdayDisplay,
  isBirthdayToday
} from "@/lib/birthday-greeting";
import { GL, type ClientSummary } from "@/lib/gl-config";
import { isValidEmailAddress, sendClientEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { ensureMasterListColumns, getAllMasterRows } from "@/lib/sheets/master";
import { updateSheetValues } from "@/lib/sheets/client";
import { parseBirthdayMonthDay } from "@/lib/birthday-greeting";

export type BirthdayGreetingCandidate = {
  code: string;
  name: string;
  email: string;
  caseTitle: string;
  preferredGreeting: string;
  masterRow: number;
};

export type BirthdayGreetingRunResult = {
  today: string;
  candidates: number;
  sent: string[];
  skipped: Array<{ code: string; reason: string }>;
};

export type TodayBirthdaySummary = {
  code: string;
  name: string;
  caseTitle: string;
  birthdayLabel: string;
  email: string;
  hasValidEmail: boolean;
  greetingSentThisYear: boolean;
  greetingSentDate: string;
};

function rowToCandidate(
  row: unknown[],
  masterRow: number,
  options?: { requireBirthdayToday?: boolean; skipIfSentThisYear?: boolean }
): BirthdayGreetingCandidate | null {
  const code = String(row[0] || "").trim();
  if (!code) return null;
  const status = String(row[20] || "Active").toLowerCase();
  if (status === "closed") return null;
  const email = String(row[4] || "").trim();
  if (!email || !isValidEmailAddress(email)) return null;
  if (!parseBirthdayMonthDay(row[27])) return null;
  if (options?.requireBirthdayToday !== false && !isBirthdayToday(row[27])) return null;
  const sentYear = birthdayGreetingSentYear(row[28]);
  const thisYear = new Date().getFullYear();
  if (options?.skipIfSentThisYear !== false && sentYear === thisYear) return null;

  return {
    code,
    name: String(row[1] || "").trim(),
    email,
    caseTitle: String(row[2] || "").trim(),
    preferredGreeting: String(row[19] || "").trim(),
    masterRow
  };
}

export async function listTodayBirthdayClients(accessToken: string): Promise<TodayBirthdaySummary[]> {
  const rows = await getAllMasterRows(accessToken);
  const thisYear = new Date().getFullYear();
  const clients: TodayBirthdaySummary[] = [];

  rows.forEach((row) => {
    const code = String(row[0] || "").trim();
    if (!code) return;
    const status = String(row[20] || "Active").toLowerCase();
    if (status === "closed") return;
    if (!parseBirthdayMonthDay(row[27])) return;
    if (!isBirthdayToday(row[27])) return;

    const email = String(row[4] || "").trim();
    const sentYear = birthdayGreetingSentYear(row[28]);

    clients.push({
      code,
      name: String(row[1] || "").trim() || code,
      caseTitle: String(row[2] || "").trim(),
      birthdayLabel: formatBirthdayDisplay(row[27]),
      email,
      hasValidEmail: Boolean(email && isValidEmailAddress(email)),
      greetingSentThisYear: sentYear === thisYear,
      greetingSentDate: String(row[28] || "").trim()
    });
  });

  return clients.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function listBirthdayGreetingCandidates(accessToken: string): Promise<BirthdayGreetingCandidate[]> {
  const rows = await getAllMasterRows(accessToken);
  const candidates: BirthdayGreetingCandidate[] = [];
  rows.forEach((row, index) => {
    const candidate = rowToCandidate(row, index + 2);
    if (candidate) candidates.push(candidate);
  });
  return candidates;
}

export async function sendBirthdayGreetingForClient(
  accessToken: string,
  input: {
    clientCode: string;
    fromEmail?: string;
    actorEmail?: string;
    force?: boolean;
  }
): Promise<{ ok: true; message: string; recipient: string }> {
  const rows = await getAllMasterRows(accessToken);
  const index = rows.findIndex((row) => String(row[0] || "").trim() === input.clientCode);
  if (index < 0) throw new Error("Client not found.");

  const row = rows[index];
  const status = String(row[20] || "Active").toLowerCase();
  if (status === "closed") throw new Error("Client matter is closed.");
  const email = String(row[4] || "").trim();
  if (!email || !isValidEmailAddress(email)) throw new Error("Add a valid contact email first.");
  if (!parseBirthdayMonthDay(row[27])) throw new Error("Add a birthday on the client profile first.");
  if (!input.force && !isBirthdayToday(row[27])) {
    throw new Error("Birthday greetings send automatically on the client's birthday. Use force send to test early.");
  }
  const sentYear = birthdayGreetingSentYear(row[28]);
  const thisYear = new Date().getFullYear();
  if (!input.force && sentYear === thisYear) {
    throw new Error(`A birthday greeting was already sent this year (${String(row[28] || "").trim()}).`);
  }

  const candidate = rowToCandidate(row, index + 2, {
    requireBirthdayToday: !input.force,
    skipIfSentThisYear: !input.force
  });
  if (!candidate) throw new Error("Could not prepare birthday greeting for this client.");

  await sendClientEmailViaGmail({
    accessToken,
    fromEmail: input.fromEmail,
    to: candidate.email,
    subject: birthdayGreetingSubject(),
    html: buildBirthdayGreetingHtml({
      clientName: candidate.name,
      preferredGreeting: candidate.preferredGreeting,
      caseTitle: candidate.caseTitle
    }),
    plain: buildBirthdayGreetingPlain({
      clientName: candidate.name,
      preferredGreeting: candidate.preferredGreeting,
      caseTitle: candidate.caseTitle
    })
  });

  const today = new Date().toISOString().slice(0, 10);
  await ensureMasterListColumns(accessToken);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!AC${candidate.masterRow}`, [[today]]);

  await appendAuditLog(accessToken, {
    user: input.actorEmail || "system",
    action: "birthday.greeting",
    clientCode: candidate.code,
    summary: `Birthday greeting sent to ${candidate.email}`,
    details: today
  });

  return {
    ok: true,
    message: `Birthday greeting sent to ${candidate.email}.`,
    recipient: candidate.email
  };
}

export async function runDailyBirthdayGreetings(
  accessToken: string,
  options?: { fromEmail?: string; actorEmail?: string }
): Promise<BirthdayGreetingRunResult> {
  const today = new Date().toISOString().slice(0, 10);
  const candidates = await listBirthdayGreetingCandidates(accessToken);
  const sent: string[] = [];
  const skipped: Array<{ code: string; reason: string }> = [];

  for (const candidate of candidates) {
    try {
      const result = await sendBirthdayGreetingForClient(accessToken, {
        clientCode: candidate.code,
        fromEmail: options?.fromEmail,
        actorEmail: options?.actorEmail || "birthday-cron"
      });
      sent.push(`${candidate.code} → ${result.recipient}`);
    } catch (error) {
      skipped.push({
        code: candidate.code,
        reason: error instanceof Error ? error.message : "Send failed."
      });
    }
  }

  return { today, candidates: candidates.length, sent, skipped };
}

export function clientSummaryHasBirthday(client: Pick<ClientSummary, "birthday">): boolean {
  return Boolean(String(client.birthday || "").trim());
}
