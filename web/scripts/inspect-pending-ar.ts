/**
 * Read-only: show where pending AR data is coming from in the connected billing workbook.
 * Run: npx tsx scripts/inspect-pending-ar.ts
 */
import fs from "fs";
import path from "path";
import { getCronGoogleAccessToken } from "../src/lib/cron-google-auth";
import { spreadsheetEditUrl } from "../src/lib/spreadsheet-setup/drive";
import { getSheetValues, getSheetsClient } from "../src/lib/sheets/client";
import { GL } from "../src/lib/gl-config";
import { BILLING_SYSTEM_TABS } from "../src/lib/spreadsheet-setup/scrub-workbook";

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

async function main() {
  const billingId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
  const tasksId = process.env.TASKS_GOOGLE_SPREADSHEET_ID?.trim();
  if (!billingId) throw new Error("GOOGLE_SPREADSHEET_ID missing from web/.env.local");

  const token = await getCronGoogleAccessToken();
  if (!token) throw new Error("CRON_GOOGLE_REFRESH_TOKEN missing");

  console.log("Billing workbook:", spreadsheetEditUrl(billingId));
  if (tasksId && tasksId !== billingId) {
    console.log("Tasks workbook:  ", spreadsheetEditUrl(tasksId));
  }

  const sheetsApi = getSheetsClient(token);
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId: billingId,
    fields: "sheets.properties(title)"
  });
  const allTitles = meta.data.sheets?.map((s) => s.properties?.title?.trim() || "") ?? [];
  const clientTabs = allTitles.filter((title) => title && !BILLING_SYSTEM_TABS.has(title.toLowerCase()));

  const master = await getSheetValues(token, `'${GL.sheets.master}'!A2:A5000`);
  const masterRows = master.filter((row) => String(row[0] ?? "").trim()).length;

  const pending = await getSheetValues(token, `'Pending AR'!A2:J5000`);
  const pendingRows = pending.filter((row) => String(row[0] ?? "").trim() && Number(row[3]) > 0);

  console.log("\nCounts:");
  console.log(`  Master List clients: ${masterRows}`);
  console.log(`  Pending AR tab rows: ${pendingRows.length}`);
  console.log(`  Client ledger tabs:  ${clientTabs.length}`);

  if (pendingRows.length) {
    console.log("\nFirst 5 Pending AR rows (client code, name, amount):");
    for (const row of pendingRows.slice(0, 5)) {
      console.log(`  ${row[0]} | ${row[1]} | ${row[3]}`);
    }
    console.log(
      "\nThe app reads Pending AR directly from this tab — it is not copied from GL at runtime."
    );
    console.log("Clear the Pending AR tab (rows 2+) in Google Sheets, or run:");
    console.log("  npx tsx scripts/scrub-live-workbooks.ts --yes");
  } else if (masterRows > 0) {
    console.log("\nPending AR tab is empty; app would scan Master List + client tabs for AR-flagged payments.");
  } else {
    console.log("\nWorkbook looks empty for AR. If the app still shows AR, check Vercel env GOOGLE_SPREADSHEET_ID or hard-refresh.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
