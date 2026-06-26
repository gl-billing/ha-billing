import {
  formatClientCaseLabel,
  GL,
  normalizePaymentMethod,
  parseMoney,
  type CaseOption,
  type NewClientPayload,
  type WalkInBillingPayload,
  type WalkInClient,
  type WalkInClientPayload
} from "@/lib/gl-config";
import type { ClientSummary } from "@/lib/gl-config";
import {
  appendSheetValues,
  getSheetValues,
  toA1Range,
  updateSheetValues
} from "@/lib/sheets/client";
import { createClient } from "@/lib/sheets/clients-create";
import { addLedgerEntry } from "@/lib/sheets/ledger";
import { getClientLedger } from "@/lib/sheets/ledger-read";
import { buildPaymentLedgerFields } from "@/lib/payment-income";
import { ensureSheetTitle } from "@/lib/sheets/sheet-meta";

const WALK_IN_HEADERS = [...GL.walkInHeaders];
const WALK_IN_COLS = WALK_IN_HEADERS.length;
const WALK_IN_HEADER_RANGE = `A1:O1`;

function todayYmd(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function cell(row: unknown[], index: number): string {
  const v = row[index];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function numCell(row: unknown[], index: number): number {
  return parseMoney(row[index]) || 0;
}

export function walkInBillingStatus(
  charge: number,
  payment: number,
  billingKind?: WalkInBillingPayload["billingKind"]
): string {
  if (billingKind === "retainer") return "Retainer";
  if (charge <= 0) return "";
  if (payment >= charge) return "Paid";
  if (payment > 0) return "Partial";
  return "Unpaid";
}

function rowToWalkIn(row: unknown[], rowNumber: number): WalkInClient {
  return {
    walkInId: cell(row, 0),
    dateAdded: cell(row, 1),
    name: cell(row, 2),
    matter: cell(row, 3),
    phone: cell(row, 4),
    email: cell(row, 5),
    notes: cell(row, 6),
    status: cell(row, 7) || "Active",
    promotedClientCode: cell(row, 8),
    chargeAmount: numCell(row, 9),
    paymentAmount: numCell(row, 10),
    paymentMethod: cell(row, 11),
    billingDate: cell(row, 12),
    billingStatus: cell(row, 13),
    serviceType: cell(row, 14),
    rowNumber
  };
}

function padWalkInRow(values: unknown[]): unknown[] {
  const row = values.slice();
  while (row.length < WALK_IN_COLS) row.push("");
  return row;
}

async function ensureWalkInSheetReady(accessToken: string): Promise<void> {
  const sheetName = GL.sheets.walkIn;
  await ensureSheetTitle(accessToken, sheetName);

  const headerRow = await getSheetValues(accessToken, toA1Range(sheetName, WALK_IN_HEADER_RANGE));
  const firstHeader = headerRow[0]?.[0] && String(headerRow[0][0]).trim();

  if (!firstHeader) {
    await updateSheetValues(accessToken, toA1Range(sheetName, WALK_IN_HEADER_RANGE), [WALK_IN_HEADERS]);
    return;
  }

  const existingCount = headerRow[0]?.filter((v) => v !== "" && v !== null && v !== undefined).length || 0;
  if (existingCount < WALK_IN_COLS) {
    await updateSheetValues(accessToken, toA1Range(sheetName, WALK_IN_HEADER_RANGE), [WALK_IN_HEADERS]);
  }
}

async function nextWalkInId(accessToken: string): Promise<string> {
  const sheetName = GL.sheets.walkIn;
  const values = await getSheetValues(accessToken, toA1Range(sheetName, "A2:A"));
  let max = 0;
  for (const row of values) {
    const id = cell(row, 0).toUpperCase();
    const match = id.match(/^WALK-(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `WALK-${String(max + 1).padStart(4, "0")}`;
}

function findWalkInEntry(walkIns: WalkInClient[], walkInId: string): WalkInClient {
  const id = walkInId.trim().toUpperCase();
  const entry = walkIns.find((w) => w.walkInId.toUpperCase() === id);
  if (!entry) throw new Error(`Walk-in not found: ${walkInId}`);
  return entry;
}

export function walkInToCaseOption(entry: WalkInClient): CaseOption {
  return {
    id: entry.walkInId,
    walkInId: entry.walkInId,
    label: formatClientCaseLabel(entry.name, entry.matter),
    name: entry.name,
    matter: entry.matter,
    kind: "walkin",
    email: entry.email?.trim() || undefined,
    phone: entry.phone?.trim() || undefined
  };
}

export function clientToCaseOption(client: ClientSummary): CaseOption {
  return {
    id: client.code,
    clientCode: client.code,
    label: formatClientCaseLabel(client.name, client.caseTitle),
    name: client.name,
    matter: client.caseTitle,
    kind: "master",
    courtPending: client.courtPending?.trim() || undefined,
    assignedAttorney: client.assignedAttorney?.trim() || undefined,
    email: client.email?.trim() || undefined,
    phone: client.phone?.trim() || undefined
  };
}

export function buildCaseOptions(
  clients: ClientSummary[],
  walkIns: WalkInClient[],
  options?: { includeClosed?: boolean }
): { clients: CaseOption[]; walkIns: CaseOption[] } {
  const activeClients = options?.includeClosed
    ? clients.filter((c) => c.code)
    : clients.filter((c) => c.code && c.status !== "Closed");

  const activeWalkIns = walkIns.filter(
    (w) => w.walkInId && w.status !== "Promoted" && w.status !== "Closed"
  );

  return {
    clients: activeClients.map(clientToCaseOption),
    walkIns: activeWalkIns.map(walkInToCaseOption)
  };
}

export async function listWalkInClients(accessToken: string): Promise<WalkInClient[]> {
  await ensureWalkInSheetReady(accessToken);
  const sheetName = GL.sheets.walkIn;
  const values = await getSheetValues(accessToken, toA1Range(sheetName, `A2:O`));
  return values
    .map((row, index) => rowToWalkIn(row, index + 2))
    .filter((entry) => entry.walkInId);
}

export async function recordWalkInBilling(
  accessToken: string,
  walkInId: string,
  billing: WalkInBillingPayload
): Promise<WalkInClient> {
  const serviceType = billing.serviceType?.trim();
  const isRetainer = billing.billingKind === "retainer";
  const charge = isRetainer ? 0 : parseMoney(billing.charge);
  const payment = isRetainer ? 0 : parseMoney(billing.payment);
  const billingDate = billing.date?.trim() || todayYmd();
  const method =
    !isRetainer && billing.method?.trim()
      ? normalizePaymentMethod(billing.method) || billing.method.trim()
      : "";

  if (!serviceType) throw new Error("Service type is required.");
  if (!isRetainer && (!charge || charge <= 0)) throw new Error("Enter a valid charge amount.");

  const walkIns = await listWalkInClients(accessToken);
  const entry = findWalkInEntry(walkIns, walkInId);

  if (entry.status === "Closed") {
    throw new Error(`Walk-in ${walkInId} is closed.`);
  }

  let notes = entry.notes;
  if (billing.description?.trim()) {
    const line = `[${billingDate}] ${serviceType}: ${billing.description.trim()}`;
    notes = notes ? `${notes}\n${line}` : line;
  }

  const status = walkInBillingStatus(charge, payment, billing.billingKind);

  await updateSheetValues(accessToken, toA1Range(GL.sheets.walkIn, `G${entry.rowNumber}:O${entry.rowNumber}`), [
    [
      notes,
      entry.status,
      entry.promotedClientCode,
      charge,
      payment || "",
      method,
      billingDate,
      status,
      serviceType
    ]
  ]);

  const updated: WalkInClient = {
    ...entry,
    notes,
    chargeAmount: charge,
    paymentAmount: payment,
    paymentMethod: method,
    billingDate,
    billingStatus: status,
    serviceType
  };

  if (entry.promotedClientCode && !isRetainer) {
    await syncPromotedWalkInBillingToLedger(accessToken, updated, {
      charge,
      payment,
      method,
      date: billingDate,
      serviceType
    });
  }

  return updated;
}

async function syncPromotedWalkInBillingToLedger(
  accessToken: string,
  entry: WalkInClient,
  billing: {
    charge: number;
    payment: number;
    method: string;
    date: string;
    serviceType: string;
  }
): Promise<void> {
  const clientCode = entry.promotedClientCode?.trim();
  if (!clientCode) return;

  const ledger = await getClientLedger(accessToken, clientCode);
  const marker = entry.walkInId;
  const description = walkInBillingLedgerDescription(entry);
  const category = billing.serviceType.trim() || "Professional Fee";

  const hasCharge = ledger.entries.some(
    (row) => row.charge > 0 && row.description.includes(marker)
  );
  if (billing.charge > 0 && !hasCharge) {
    await addLedgerEntry(accessToken, {
      clientCode,
      type: "Charge",
      date: billing.date,
      category,
      description,
      charge: billing.charge
    });
  }

  const hasPayment = ledger.entries.some(
    (row) => row.payment > 0 && row.description.includes(marker)
  );
  if (billing.payment > 0 && !hasPayment) {
    const paymentFields = buildPaymentLedgerFields(category, `Payment — ${description}`);
    await addLedgerEntry(accessToken, {
      clientCode,
      type: "Payment",
      date: billing.date,
      category: paymentFields.category,
      description: paymentFields.description,
      payment: billing.payment,
      method: billing.method || undefined
    });
  }
}

export async function createWalkInClient(
  accessToken: string,
  payload: WalkInClientPayload
): Promise<{ walkIn: WalkInClient; clientCase: string }> {
  const name = payload.name?.trim();
  const matter = payload.matter?.trim();
  if (!name) throw new Error("Client name is required.");
  if (!matter) throw new Error("Consultation or matter title is required.");

  await ensureWalkInSheetReady(accessToken);
  const sheetName = GL.sheets.walkIn;
  const walkInId = await nextWalkInId(accessToken);
  const dateAdded = todayYmd();

  const row = padWalkInRow([
    walkInId,
    dateAdded,
    name,
    matter,
    payload.phone?.trim() || "",
    payload.email?.trim() || "",
    payload.notes?.trim() || "",
    "Active",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  await appendSheetValues(accessToken, toA1Range(sheetName, "A:O"), [row]);

  if (payload.billing) {
    const walkIn = await recordWalkInBilling(accessToken, walkInId, payload.billing);
    return { walkIn, clientCase: formatClientCaseLabel(name, matter) };
  }

  const walkIns = await listWalkInClients(accessToken);
  const walkIn = findWalkInEntry(walkIns, walkInId);

  return {
    walkIn,
    clientCase: formatClientCaseLabel(name, matter)
  };
}

export async function updateWalkInContact(
  accessToken: string,
  walkInId: string,
  contact: { email?: string; phone?: string }
): Promise<WalkInClient> {
  const walkIns = await listWalkInClients(accessToken);
  const entry = findWalkInEntry(walkIns, walkInId);
  const nextEmail = contact.email !== undefined ? contact.email.trim() : entry.email;
  const nextPhone = contact.phone !== undefined ? contact.phone.trim() : entry.phone;

  await updateSheetValues(accessToken, toA1Range(GL.sheets.walkIn, `E${entry.rowNumber}:F${entry.rowNumber}`), [
    [nextPhone, nextEmail]
  ]);

  return { ...entry, phone: nextPhone, email: nextEmail };
}

export function walkInHasTransferableBilling(entry: WalkInClient): boolean {
  if (entry.billingStatus === "Retainer") return false;
  return entry.chargeAmount > 0 || entry.paymentAmount > 0;
}

export function walkInBillingLedgerDescription(entry: WalkInClient): string {
  const service = entry.serviceType?.trim() || "Walk-in consultation";
  const matter = entry.matter?.trim();
  const base = matter ? `${service} — ${matter}` : service;
  return `${base} (${entry.walkInId})`;
}

/** Copy walk-in sheet billing onto the new client ledger after promotion. */
export async function transferWalkInBillingToLedger(
  accessToken: string,
  entry: WalkInClient,
  clientCode: string
): Promise<string | null> {
  if (!walkInHasTransferableBilling(entry)) return null;

  const date = entry.billingDate?.trim() || todayYmd();
  const description = walkInBillingLedgerDescription(entry);
  const category = entry.serviceType?.trim() || "Professional Fee";
  const parts: string[] = [];

  if (entry.chargeAmount > 0) {
    await addLedgerEntry(accessToken, {
      clientCode,
      type: "Charge",
      date,
      category,
      description,
      charge: entry.chargeAmount
    });
    parts.push(`charge ${entry.chargeAmount}`);
  }

  if (entry.paymentAmount > 0) {
    const paymentFields = buildPaymentLedgerFields(
      entry.serviceType?.trim() || category,
      `Payment — ${description}`
    );
    await addLedgerEntry(accessToken, {
      clientCode,
      type: "Payment",
      date,
      category: paymentFields.category,
      description: paymentFields.description,
      payment: entry.paymentAmount,
      method: entry.paymentMethod || undefined
    });
    parts.push(`payment ${entry.paymentAmount}`);
  }

  return parts.length ? `Transferred walk-in billing (${parts.join(", ")}).` : null;
}

export async function promoteWalkInClient(
  accessToken: string,
  walkInId: string,
  clientPayload: NewClientPayload
): Promise<{ clientCode: string; clientCase: string }> {
  const entry = findWalkInEntry(await listWalkInClients(accessToken), walkInId);
  if (entry.status === "Promoted") {
    throw new Error(`Walk-in ${walkInId} was already promoted to ${entry.promotedClientCode || "a client file"}.`);
  }

  const payload: NewClientPayload = {
    clientCode: clientPayload.clientCode,
    clientName: clientPayload.clientName?.trim() || entry.name,
    caseTitle: clientPayload.caseTitle?.trim() || entry.matter,
    caseNumber: clientPayload.caseNumber,
    courtPending: clientPayload.courtPending,
    contactEmail: clientPayload.contactEmail?.trim() || entry.email,
    contactPhone: clientPayload.contactPhone?.trim() || entry.phone,
    clientAddress: clientPayload.clientAddress,
    prevBalance: clientPayload.prevBalance,
    preferredGreeting: clientPayload.preferredGreeting,
    clientStatus: clientPayload.clientStatus || "Active"
  };

  const result = await createClient(accessToken, payload);

  await updateSheetValues(accessToken, toA1Range(GL.sheets.walkIn, `H${entry.rowNumber}:I${entry.rowNumber}`), [
    ["Promoted", result.clientCode]
  ]);

  const clientCase = formatClientCaseLabel(payload.clientName, payload.caseTitle);
  return { clientCode: result.clientCode, clientCase };
}

export async function closeWalkInClient(accessToken: string, walkInId: string): Promise<void> {
  const entry = findWalkInEntry(await listWalkInClients(accessToken), walkInId);
  await updateSheetValues(accessToken, toA1Range(GL.sheets.walkIn, `H${entry.rowNumber}`), [["Closed"]]);
}
