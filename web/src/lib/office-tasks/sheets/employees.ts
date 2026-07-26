import { SHEETS } from "@/lib/tasks-config";
import {
  appendSheetValues,
  getSheetValues,
  toA1Range,
  updateSheetValues
} from "@/lib/office-tasks/sheets/client";

export type EmployeeRecord = {
  name: string;
  email: string;
  role: string;
  active: boolean;
  /** Optional WhatsApp/SMS mobile when present on the Employees sheet. */
  phone?: string;
  /** 1-based sheet row when loaded from the full directory (including inactive). */
  rowNumber?: number;
};

export type EmployeeUpsertPayload = {
  name: string;
  email: string;
  role?: string;
  active?: boolean;
  phone?: string;
  /** When set, updates this row; otherwise matches by email or appends. */
  rowNumber?: number;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function rowToEmployee(row: unknown[], rowNumber: number): EmployeeRecord | null {
  const name = String(row[0] || "").trim();
  const email = String(row[1] || "").trim();
  const role = String(row[2] || "").trim();
  const active = String(row[3] ?? "").toUpperCase() !== "FALSE";
  const phone = String(row[4] || "").trim();
  if (!name && !email) return null;
  return {
    name,
    email,
    role,
    active,
    phone: phone || undefined,
    rowNumber
  };
}

export async function getEmployeeDirectory(
  accessToken: string,
  options?: { includeInactive?: boolean }
): Promise<EmployeeRecord[]> {
  const range = toA1Range(SHEETS.employees, "A2:E");
  const rows = await getSheetValues(accessToken, range);
  const list: EmployeeRecord[] = [];

  rows.forEach((row, index) => {
    const employee = rowToEmployee(row, index + 2);
    if (!employee?.name) return;
    if (!options?.includeInactive && !employee.active) return;
    list.push(employee);
  });

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getActiveEmployeeNames(accessToken: string): Promise<string[]> {
  const directory = await getEmployeeDirectory(accessToken);
  return directory.map((e) => e.name);
}

/** Create or update a row on the Employees sheet (Space Staff desk). */
export async function upsertEmployee(
  accessToken: string,
  payload: EmployeeUpsertPayload
): Promise<{ employee: EmployeeRecord; created: boolean }> {
  const name = payload.name.trim();
  const email = payload.email.trim();
  if (!name) throw new Error("Staff name is required.");
  if (!email) throw new Error("Staff email is required.");

  const role = (payload.role || "").trim();
  const phone = (payload.phone || "").trim();
  const active = payload.active !== false;
  const values = [name, email, role, active ? "TRUE" : "FALSE", phone];

  const all = await getEmployeeDirectory(accessToken, { includeInactive: true });
  const byRow =
    payload.rowNumber && payload.rowNumber >= 2
      ? all.find((row) => row.rowNumber === payload.rowNumber)
      : undefined;
  const byEmail = all.find((row) => normalizeEmail(row.email) === normalizeEmail(email));
  const target = byRow || byEmail;

  if (target?.rowNumber) {
    await updateSheetValues(
      accessToken,
      toA1Range(SHEETS.employees, `A${target.rowNumber}:E${target.rowNumber}`),
      [values]
    );
    return {
      created: false,
      employee: {
        name,
        email,
        role,
        active,
        phone: phone || undefined,
        rowNumber: target.rowNumber
      }
    };
  }

  const result = await appendSheetValues(accessToken, toA1Range(SHEETS.employees, "A:E"), [values]);
  const match = result.updatedRange?.match(/!A(\d+)/i);
  const rowNumber = match ? Number(match[1]) : undefined;
  return {
    created: true,
    employee: {
      name,
      email,
      role,
      active,
      phone: phone || undefined,
      rowNumber
    }
  };
}
