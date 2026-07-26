import { SHEETS } from "@/lib/tasks-config";
import {
  appendSheetValues,
  getSheetValues,
  getSheetsClient,
  getSpreadsheetIdAsync,
  listSheetTitles,
  toA1Range,
  updateSheetValues
} from "@/lib/office-tasks/sheets/client";
import {
  EXTERNAL_COUNSEL_ROLES,
  type ExternalCounselRecord,
  type ExternalCounselWriteInput
} from "@/lib/office-tasks/external-counsel";

export {
  EXTERNAL_COUNSEL_ROLES,
  formatCollaboratingCounsel,
  parseCollaboratingCounsel,
  resolveCollaboratingCounselDetails,
  type CollaboratingCounselDetails,
  type ExternalCounselRecord,
  type ExternalCounselRole,
  type ExternalCounselWriteInput
} from "@/lib/office-tasks/external-counsel";

export const EXTERNAL_COUNSEL_HEADERS = [
  "Counsel ID",
  "Name",
  "Firm",
  "Email",
  "Phone",
  "Office Address",
  "Role",
  "Notes",
  "Active",
  "Last Updated"
] as const;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeRole(value: string | undefined): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "Collaborating counsel";
  const match = EXTERNAL_COUNSEL_ROLES.find((role) => role.toLowerCase() === trimmed.toLowerCase());
  return match || trimmed;
}

function nextCounselId(existing: ExternalCounselRecord[]): string {
  let max = 0;
  for (const row of existing) {
    const match = row.id.match(/^XC-(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }
  return `XC-${String(max + 1).padStart(4, "0")}`;
}

function isLegacyHeaderRow(header: unknown[]): boolean {
  return String(header[5] || "")
    .trim()
    .toLowerCase() === "role";
}

function rowToRecord(row: unknown[], rowNumber: number, legacy: boolean): ExternalCounselRecord | null {
  const id = String(row[0] || "").trim();
  const name = normalizeName(String(row[1] || ""));
  if (!name) return null;
  if (legacy) {
    return {
      id: id || `ROW-${rowNumber}`,
      name,
      firm: String(row[2] || "").trim(),
      email: String(row[3] || "").trim(),
      phone: String(row[4] || "").trim(),
      address: "",
      role: String(row[5] || "").trim() || "Collaborating counsel",
      notes: String(row[6] || "").trim(),
      active: String(row[7] ?? "").toUpperCase() !== "FALSE",
      lastUpdated: String(row[8] || "").trim(),
      rowNumber
    };
  }
  return {
    id: id || `ROW-${rowNumber}`,
    name,
    firm: String(row[2] || "").trim(),
    email: String(row[3] || "").trim(),
    phone: String(row[4] || "").trim(),
    address: String(row[5] || "").trim(),
    role: String(row[6] || "").trim() || "Collaborating counsel",
    notes: String(row[7] || "").trim(),
    active: String(row[8] ?? "").toUpperCase() !== "FALSE",
    lastUpdated: String(row[9] || "").trim(),
    rowNumber
  };
}

function recordToRow(record: ExternalCounselRecord): string[] {
  return [
    record.id,
    record.name,
    record.firm,
    record.email,
    record.phone,
    record.address,
    record.role,
    record.notes,
    record.active ? "TRUE" : "FALSE",
    record.lastUpdated
  ];
}

async function ensureExternalCounselSheet(accessToken: string): Promise<void> {
  const sheetName = SHEETS.externalCounsel;
  const titles = await listSheetTitles(accessToken);
  if (!titles.includes(sheetName)) {
    const sheets = getSheetsClient(accessToken);
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: await getSpreadsheetIdAsync(),
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }]
        }
      });
    } catch (error) {
      // Another request may have created the tab first.
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists|duplicate/i.test(message)) throw error;
    }
  }

  const header = await getSheetValues(accessToken, toA1Range(sheetName, "A1:J1"));
  const first = String(header[0]?.[0] || "").trim();
  if (!first) {
    await updateSheetValues(accessToken, toA1Range(sheetName, "A1:J1"), [
      Array.from(EXTERNAL_COUNSEL_HEADERS)
    ]);
    return;
  }

  if (isLegacyHeaderRow(header[0] || [])) {
    const dataRows = await getSheetValues(accessToken, toA1Range(sheetName, "A2:I"));
    const migrated = dataRows.map((row, index) => {
      const record = rowToRecord(row, index + 2, true);
      if (!record) return Array.from({ length: EXTERNAL_COUNSEL_HEADERS.length }, () => "");
      return recordToRow(record);
    });
    await updateSheetValues(accessToken, toA1Range(sheetName, "A1:J1"), [
      Array.from(EXTERNAL_COUNSEL_HEADERS)
    ]);
    if (migrated.length) {
      await updateSheetValues(
        accessToken,
        toA1Range(sheetName, `A2:J${migrated.length + 1}`),
        migrated
      );
    }
    return;
  }

  if (!String(header[0]?.[5] || "").trim()) {
    await updateSheetValues(accessToken, toA1Range(sheetName, "A1:J1"), [
      Array.from(EXTERNAL_COUNSEL_HEADERS)
    ]);
  }
}

export async function listExternalCounsel(
  accessToken: string,
  options?: { includeInactive?: boolean }
): Promise<ExternalCounselRecord[]> {
  await ensureExternalCounselSheet(accessToken);
  const header = await getSheetValues(accessToken, toA1Range(SHEETS.externalCounsel, "A1:J1"));
  const legacy = isLegacyHeaderRow(header[0] || []);
  const rows = await getSheetValues(
    accessToken,
    toA1Range(SHEETS.externalCounsel, legacy ? "A2:I" : "A2:J")
  );
  const includeInactive = options?.includeInactive === true;
  const list: ExternalCounselRecord[] = [];
  rows.forEach((row, index) => {
    const record = rowToRecord(row, index + 2, legacy);
    if (!record) return;
    if (!includeInactive && !record.active) return;
    list.push(record);
  });
  return list.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function createExternalCounsel(
  accessToken: string,
  input: ExternalCounselWriteInput
): Promise<ExternalCounselRecord> {
  const name = normalizeName(input.name);
  if (!name) throw new Error("Lawyer name is required.");
  const existing = await listExternalCounsel(accessToken, { includeInactive: true });
  if (existing.some((row) => row.name.toLowerCase() === name.toLowerCase() && row.active)) {
    throw new Error(`An active lawyer named "${name}" is already in the directory.`);
  }
  const id = nextCounselId(existing);
  const now = new Date().toISOString();
  const role = normalizeRole(input.role);
  const record: ExternalCounselRecord = {
    id,
    name,
    firm: String(input.firm || "").trim(),
    email: String(input.email || "").trim(),
    phone: String(input.phone || "").trim(),
    address: String(input.address || "").trim(),
    role,
    notes: String(input.notes || "").trim(),
    active: true,
    lastUpdated: now,
    rowNumber: 0
  };
  await appendSheetValues(accessToken, toA1Range(SHEETS.externalCounsel, "A:J"), [recordToRow(record)]);
  const refreshed = await listExternalCounsel(accessToken, { includeInactive: true });
  const created = refreshed.find((row) => row.id === id);
  if (!created) throw new Error("Lawyer was saved but could not be reloaded.");
  return created;
}

export async function updateExternalCounsel(
  accessToken: string,
  id: string,
  input: ExternalCounselWriteInput & { active?: boolean }
): Promise<ExternalCounselRecord> {
  const counselId = String(id || "").trim();
  if (!counselId) throw new Error("Counsel id is required.");
  const existing = await listExternalCounsel(accessToken, { includeInactive: true });
  const current = existing.find((row) => row.id === counselId);
  if (!current) throw new Error(`Lawyer not found: ${counselId}`);

  const name = normalizeName(input.name || current.name);
  if (!name) throw new Error("Lawyer name is required.");
  const duplicate = existing.find(
    (row) => row.id !== counselId && row.active && row.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) throw new Error(`An active lawyer named "${name}" is already in the directory.`);

  const next: ExternalCounselRecord = {
    ...current,
    name,
    firm: input.firm !== undefined ? String(input.firm).trim() : current.firm,
    email: input.email !== undefined ? String(input.email).trim() : current.email,
    phone: input.phone !== undefined ? String(input.phone).trim() : current.phone,
    address: input.address !== undefined ? String(input.address).trim() : current.address,
    role: input.role !== undefined ? normalizeRole(input.role) : current.role,
    notes: input.notes !== undefined ? String(input.notes).trim() : current.notes,
    active: input.active !== undefined ? Boolean(input.active) : current.active,
    lastUpdated: new Date().toISOString()
  };

  await updateSheetValues(
    accessToken,
    toA1Range(SHEETS.externalCounsel, `A${current.rowNumber}:J${current.rowNumber}`),
    [recordToRow(next)]
  );
  return next;
}

export async function deactivateExternalCounsel(
  accessToken: string,
  id: string
): Promise<ExternalCounselRecord> {
  const existing = await listExternalCounsel(accessToken, { includeInactive: true });
  const current = existing.find((row) => row.id === String(id || "").trim());
  if (!current) throw new Error(`Lawyer not found: ${id}`);
  return updateExternalCounsel(accessToken, id, { name: current.name, active: false });
}
