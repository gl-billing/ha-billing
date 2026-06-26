import { SHEETS } from "@/lib/tasks-config";
import { getSheetValues, toA1Range } from "@/lib/office-tasks/sheets/client";

export type EmployeeRecord = {
  name: string;
  email: string;
  role: string;
  active: boolean;
};

export async function getEmployeeDirectory(accessToken: string): Promise<EmployeeRecord[]> {
  const range = toA1Range(SHEETS.employees, "A2:D");
  const rows = await getSheetValues(accessToken, range);
  const list: EmployeeRecord[] = [];

  rows.forEach((row) => {
    const name = String(row[0] || "").trim();
    const email = String(row[1] || "").trim();
    const role = String(row[2] || "").trim();
    const active = String(row[3] ?? "").toUpperCase() !== "FALSE";
    if (name && active) {
      list.push({ name, email, role, active });
    }
  });

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getActiveEmployeeNames(accessToken: string): Promise<string[]> {
  const directory = await getEmployeeDirectory(accessToken);
  return directory.map((e) => e.name);
}
