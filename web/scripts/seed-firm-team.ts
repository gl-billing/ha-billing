/**
 * Seed Hernandez Law team rosters (payroll, associate lawyers, employees).
 *
 * Run from web/:
 *   npx tsx scripts/seed-firm-team.ts
 */
import fs from "fs";
import path from "path";
import { getCronGoogleAccessToken } from "../src/lib/cron-google-auth";
import {
  DEFAULT_FIRM_EMPLOYEE_ROWS,
  DEFAULT_FIRM_LAWYERS_ROSTER,
  DEFAULT_STAFF_PAYROLL_ROSTER
} from "../src/lib/firm-team-config";
import { activeFirmLawyersRoster } from "../src/lib/firm-lawyers-roster";
import { saveFirmLawyersRoster } from "../src/lib/sheets/firm-lawyers-roster";
import { saveStaffPayrollRoster } from "../src/lib/sheets/staff-payroll-roster";
import { getSheetsClient, getSpreadsheetId as getTasksSpreadsheetId } from "../src/lib/office-tasks/sheets/client";
import { SHEETS } from "../src/lib/tasks-config";
import { toA1Range } from "../src/lib/sheets/client";

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

async function writeEmployeeRows(accessToken: string, rows: string[][]): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  const spreadsheetId = getTasksSpreadsheetId();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: toA1Range(SHEETS.employees, "A2:D500")
  });
  if (!rows.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: toA1Range(SHEETS.employees, `A2:D${rows.length + 1}`),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });
}

async function main() {
  const accessToken = await getCronGoogleAccessToken();
  if (!accessToken) {
    throw new Error("Set CRON_GOOGLE_REFRESH_TOKEN in web/.env.local.");
  }

  console.log("Saving associate lawyers roster…");
  const lawyers = await saveFirmLawyersRoster(accessToken, DEFAULT_FIRM_LAWYERS_ROSTER);
  console.log(
    `  ${activeFirmLawyersRoster(lawyers)
      .map((entry) => `${entry.displayName} (${entry.feeSharePercent}% share)`)
      .join(", ")}`
  );

  console.log("Saving staff payroll roster…");
  const payroll = await saveStaffPayrollRoster(accessToken, DEFAULT_STAFF_PAYROLL_ROSTER);
  console.log(
    `  ${payroll
      .map((entry) => `${entry.displayName} → ${entry.associatedLawyerName}`)
      .join(", ")}`
  );

  const lawyerRows = activeFirmLawyersRoster(lawyers)
    .filter((entry) => entry.overseesTasks)
    .map((lawyer) => [lawyer.displayName, lawyer.email, "Lawyer", "TRUE"]);
  const employeeRows = [...DEFAULT_FIRM_EMPLOYEE_ROWS, ...lawyerRows];

  console.log("Writing Employees sheet…");
  await writeEmployeeRows(accessToken, employeeRows);
  for (const row of employeeRows) {
    console.log(`  ${row[0]} <${row[1]}> — ${row[2]}`);
  }

  console.log("\nDone. Team rosters are live in Settings and Office Tasks Employees.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
