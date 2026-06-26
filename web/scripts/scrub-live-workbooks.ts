/**
 * Wipe row data from the live HA billing + tasks workbooks in .env.local.
 * Removes client ledger tabs, clears Master List, Pending AR, tasks/events, etc.
 *
 * Run from web/:
 *   npx tsx scripts/scrub-live-workbooks.ts
 *   npx tsx scripts/scrub-live-workbooks.ts --yes
 *   npx tsx scripts/scrub-live-workbooks.ts --copy-first --yes
 *
 * Use --copy-first when the connected workbook is a GL-owned file you cannot edit in place.
 * Copies to HA-owned workbooks, scrubs the copies, and prints new env IDs.
 */
import fs from "fs";
import path from "path";
import { getCronGoogleAccessToken } from "../src/lib/cron-google-auth";
import { copyDriveFile, spreadsheetEditUrl } from "../src/lib/spreadsheet-setup/drive";
import {
  assertBillingWorkbookIsBlank,
  scrubBillingWorkbook,
  scrubTasksWorkbook
} from "../src/lib/spreadsheet-setup/scrub-workbook";

const FIRM_NAME = "Hernandez & Associates";

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
  const confirmed = process.argv.includes("--yes");
  const copyFirst = process.argv.includes("--copy-first");

  if (!billingId) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not set in web/.env.local");
  }

  if (!confirmed) {
    console.log("This will DELETE all client data in your connected workbooks:");
    console.log(`  Billing: ${spreadsheetEditUrl(billingId)}`);
    if (tasksId) console.log(`  Tasks:   ${spreadsheetEditUrl(tasksId)}`);
    if (copyFirst) {
      console.log("\n--copy-first: makes HA-owned copies first, then scrubs the copies.");
    }
    console.log("\nRe-run with --yes to proceed.");
    console.log("If scrub fails on a GL-owned file, use --copy-first --yes.");
    process.exit(0);
  }

  const accessToken = await getCronGoogleAccessToken();
  if (!accessToken) {
    throw new Error(
      "Set CRON_GOOGLE_REFRESH_TOKEN in web/.env.local (firm Google account with spreadsheets scope)."
    );
  }

  let billingTargetId = billingId;
  let tasksTargetId = tasksId;

  if (copyFirst) {
    console.log("\nCopying billing workbook to an HA-owned file…");
    billingTargetId = await copyDriveFile(
      accessToken,
      billingId,
      `${FIRM_NAME} — Billing (clean)`,
      { sourceLabel: "billing workbook" }
    );
    console.log(`  ${spreadsheetEditUrl(billingTargetId)}`);

    if (tasksId && tasksId !== billingId) {
      console.log("\nCopying tasks workbook to an HA-owned file…");
      tasksTargetId = await copyDriveFile(
        accessToken,
        tasksId,
        `${FIRM_NAME} — Tasks (clean)`,
        { sourceLabel: "tasks workbook" }
      );
      console.log(`  ${spreadsheetEditUrl(tasksTargetId)}`);
    }
  }

  console.log("\nScrubbing billing workbook…");
  const billing = await scrubBillingWorkbook(accessToken, billingTargetId);
  await assertBillingWorkbookIsBlank(accessToken, billingTargetId);
  console.log(
    `  removed ${billing.deletedClientTabs} client tab(s)` +
      (billing.failedClientTabs ? ` (${billing.failedClientTabs} could not be deleted)` : "") +
      `; cleared: ${billing.clearedTabs.join(", ") || "—"}; unprotected ${billing.removedProtection} range(s)`
  );

  if (tasksTargetId && tasksTargetId !== billingTargetId) {
    console.log("\nScrubbing tasks workbook…");
    const tasks = await scrubTasksWorkbook(accessToken, tasksTargetId);
    console.log(`  cleared: ${tasks.clearedTabs.join(", ") || "—"}; unprotected ${tasks.removedProtection} range(s)`);
  }

  console.log("\nDone. Master List, Pending AR, and client tabs are empty.");
  if (copyFirst) {
    console.log("\nUpdate web/.env.local (and Vercel env) with:\n");
    console.log(`GOOGLE_SPREADSHEET_ID=${billingTargetId}`);
    if (tasksTargetId) console.log(`TASKS_GOOGLE_SPREADSHEET_ID=${tasksTargetId}`);
  }
  console.log("\nRestart the dev server and hard-refresh the app.");
  if (!copyFirst) {
    console.log("Update the same spreadsheet IDs on Vercel if production still shows old data.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
