import { appendSheetValues, getSheetValues, getSheetsClient, getSpreadsheetId, listSheetTitles, toA1Range, updateSheetValues } from "@/lib/office-tasks/sheets/client";
import type { FilingQueueKind } from "@/lib/office-tasks/filing-queue-route";
import type {
  FilingCopyFurnishedParty,
  FilingQueueCreateInput,
  FilingQueueRow,
  FilingQueueUpdateInput
} from "@/lib/office-tasks/filing-queue-types";

export type {
  FilingCopyFurnishedParty,
  FilingPhysicalManner,
  FilingQueueCreateInput,
  FilingQueueRow,
  FilingQueueStatus,
  FilingQueueUpdateInput
} from "@/lib/office-tasks/filing-queue-types";
export {
  FILING_PHYSICAL_MANNERS,
  FILING_QUEUE_STATUSES
} from "@/lib/office-tasks/filing-queue-types";

export const FILING_QUEUE_SHEET = "Filing Queue";

const HEADERS = [
  "Created",
  "Queue",
  "Event ID",
  "Client Code",
  "Pleading",
  "Client / Party",
  "Where Filed",
  "Court Address",
  "Court Email",
  "Copy Furnished JSON",
  "Manner",
  "Assigned To",
  "Status",
  "Deadline",
  "Date Filed",
  "Tracking / ACK",
  "Proof",
  "Notes",
  "Client Case Label",
  "Event Row"
] as const;

function parseCopyFurnished(raw: unknown): FilingCopyFurnishedParty[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as FilingCopyFurnishedParty[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => ({
        name: String(p?.name || "").trim(),
        address: String(p?.address || "").trim() || undefined,
        email: String(p?.email || "").trim() || undefined
      }))
      .filter((p) => p.name);
  } catch {
    return [];
  }
}

function serializeCopyFurnished(parties: FilingCopyFurnishedParty[] | undefined): string {
  if (!parties?.length) return "[]";
  return JSON.stringify(
    parties.map((p) => ({
      name: p.name.trim(),
      ...(p.address?.trim() ? { address: p.address.trim() } : {}),
      ...(p.email?.trim() ? { email: p.email.trim() } : {})
    }))
  );
}

function rowToEntry(row: unknown[], sheetRow: number): FilingQueueRow | null {
  const eventId = String(row[2] || "").trim();
  if (!eventId && !String(row[4] || "").trim()) return null;
  const queueRaw = String(row[1] || "").trim().toLowerCase();
  const queue: FilingQueueKind = queueRaw === "physical" ? "physical" : "e-filing";
  return {
    sheetRow,
    created: String(row[0] || ""),
    queue,
    eventId,
    clientCode: String(row[3] || "").trim(),
    pleading: String(row[4] || ""),
    clientParty: String(row[5] || ""),
    whereFiled: String(row[6] || ""),
    courtAddress: String(row[7] || ""),
    courtEmail: String(row[8] || ""),
    copyFurnished: parseCopyFurnished(row[9]),
    manner: String(row[10] || ""),
    assignedTo: String(row[11] || ""),
    status: String(row[12] || "Queued"),
    deadline: String(row[13] || ""),
    dateFiled: String(row[14] || ""),
    trackingOrAck: String(row[15] || ""),
    proof: String(row[16] || ""),
    notes: String(row[17] || ""),
    clientCaseLabel: String(row[18] || ""),
    eventRow: Number(row[19]) || 0
  };
}

function isSheetAlreadyExistsError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  return /already exists/i.test(message);
}

export async function ensureFilingQueueSheet(accessToken: string): Promise<void> {
  const titles = await listSheetTitles(accessToken);
  if (!titles.includes(FILING_QUEUE_SHEET)) {
    const sheets = getSheetsClient(accessToken);
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: getSpreadsheetId(),
        requestBody: {
          requests: [{ addSheet: { properties: { title: FILING_QUEUE_SHEET } } }]
        }
      });
    } catch (error) {
      // Parallel list/create races (e.g. Filing tab + Mark filed) can both see the tab
      // missing and both call addSheet; the second request is fine to ignore.
      if (!isSheetAlreadyExistsError(error)) throw error;
    }
  }

  const headerRow = await getSheetValues(accessToken, toA1Range(FILING_QUEUE_SHEET, "A1:T1"));
  if (!headerRow[0]?.[0]) {
    await updateSheetValues(accessToken, toA1Range(FILING_QUEUE_SHEET, "A1:T1"), [[...HEADERS]]);
  }
}

export async function listFilingQueueRows(
  accessToken: string,
  options?: { queue?: FilingQueueKind }
): Promise<FilingQueueRow[]> {
  await ensureFilingQueueSheet(accessToken);
  const values = await getSheetValues(accessToken, toA1Range(FILING_QUEUE_SHEET, "A2:T"));
  let rows = values
    .map((row, index) => rowToEntry(row, index + 2))
    .filter((row): row is FilingQueueRow => Boolean(row));

  if (options?.queue) {
    rows = rows.filter((row) => row.queue === options.queue);
  }

  rows.sort((a, b) => {
    const da = a.deadline || "9999-99-99";
    const db = b.deadline || "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    return a.sheetRow - b.sheetRow;
  });

  return rows;
}

export async function findFilingQueueByEventId(
  accessToken: string,
  eventId: string
): Promise<FilingQueueRow | null> {
  const id = eventId.trim();
  if (!id) return null;
  const rows = await listFilingQueueRows(accessToken);
  return rows.find((row) => row.eventId === id) || null;
}

export async function createFilingQueueRow(
  accessToken: string,
  input: FilingQueueCreateInput
): Promise<FilingQueueRow> {
  await ensureFilingQueueSheet(accessToken);
  const existing = await findFilingQueueByEventId(accessToken, input.eventId);
  if (existing) return existing;

  const created = new Date().toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila"
  });

  await appendSheetValues(accessToken, toA1Range(FILING_QUEUE_SHEET, "A:T"), [
    [
      created,
      input.queue,
      input.eventId,
      input.clientCode || "",
      input.pleading,
      input.clientParty,
      input.whereFiled || "",
      input.courtAddress || "",
      input.courtEmail || "",
      serializeCopyFurnished(input.copyFurnished),
      input.manner || "",
      input.assignedTo || "",
      input.status || "Queued",
      input.deadline || "",
      input.dateFiled || "",
      input.trackingOrAck || "",
      input.proof || "",
      input.notes || "",
      input.clientCaseLabel || "",
      input.eventRow || ""
    ]
  ]);

  const createdRow = await findFilingQueueByEventId(accessToken, input.eventId);
  if (!createdRow) throw new Error("Filing queue row was not created.");
  return createdRow;
}

export async function updateFilingQueueRow(
  accessToken: string,
  sheetRow: number,
  patch: FilingQueueUpdateInput
): Promise<FilingQueueRow> {
  await ensureFilingQueueSheet(accessToken);
  const values = await getSheetValues(accessToken, toA1Range(FILING_QUEUE_SHEET, `A${sheetRow}:T${sheetRow}`));
  const current = values[0];
  if (!current) throw new Error("Filing queue row not found.");

  const entry = rowToEntry(current, sheetRow);
  if (!entry) throw new Error("Filing queue row is empty.");

  const next: FilingQueueRow = {
    ...entry,
    queue: patch.queue || entry.queue,
    pleading: patch.pleading !== undefined ? patch.pleading : entry.pleading,
    clientParty: patch.clientParty !== undefined ? patch.clientParty : entry.clientParty,
    whereFiled: patch.whereFiled !== undefined ? patch.whereFiled : entry.whereFiled,
    courtAddress: patch.courtAddress !== undefined ? patch.courtAddress : entry.courtAddress,
    courtEmail: patch.courtEmail !== undefined ? patch.courtEmail : entry.courtEmail,
    copyFurnished: patch.copyFurnished !== undefined ? patch.copyFurnished : entry.copyFurnished,
    manner: patch.manner !== undefined ? patch.manner : entry.manner,
    assignedTo: patch.assignedTo !== undefined ? patch.assignedTo : entry.assignedTo,
    status: patch.status !== undefined ? patch.status : entry.status,
    deadline: patch.deadline !== undefined ? patch.deadline : entry.deadline,
    dateFiled: patch.dateFiled !== undefined ? patch.dateFiled : entry.dateFiled,
    trackingOrAck: patch.trackingOrAck !== undefined ? patch.trackingOrAck : entry.trackingOrAck,
    proof: patch.proof !== undefined ? patch.proof : entry.proof,
    notes: patch.notes !== undefined ? patch.notes : entry.notes,
    clientCaseLabel: patch.clientCaseLabel !== undefined ? patch.clientCaseLabel : entry.clientCaseLabel,
    clientCode: patch.clientCode !== undefined ? patch.clientCode : entry.clientCode
  };

  await updateSheetValues(accessToken, toA1Range(FILING_QUEUE_SHEET, `A${sheetRow}:T${sheetRow}`), [
    [
      next.created,
      next.queue,
      next.eventId,
      next.clientCode,
      next.pleading,
      next.clientParty,
      next.whereFiled,
      next.courtAddress,
      next.courtEmail,
      serializeCopyFurnished(next.copyFurnished),
      next.manner,
      next.assignedTo,
      next.status,
      next.deadline,
      next.dateFiled,
      next.trackingOrAck,
      next.proof,
      next.notes,
      next.clientCaseLabel,
      next.eventRow || ""
    ]
  ]);

  return next;
}
