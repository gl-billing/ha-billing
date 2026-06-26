/**
 * Copy blank billing + tasks templates into HA-owned workbooks (no GL client data).
 *
 * Prerequisites in web/.env.local:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   CRON_GOOGLE_REFRESH_TOKEN  (firm Google account — spreadsheets + drive.file scopes)
 *
 * Run from web/:
 *   npx tsx scripts/create-clean-workbooks.ts
 *   npx tsx scripts/create-clean-workbooks.ts --also-save-templates
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
import { assertSafeSpreadsheetTemplate } from "../src/lib/spreadsheet-setup/template-guard";

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

const DEFAULT_BILLING_TEMPLATE_ID = "1MFrcLDnLrmL7jmjcGU934-sd-udAZFzoKIYZ7NvKvf8";
const DEFAULT_TASKS_TEMPLATE_ID = "1EeezyqT0AeimXz21iJyskXgUtibXzZ7qwoboPCC1at0";
const FIRM_NAME = "Hernandez & Associates";

function getBillingTemplateId(): string {
  const id =
    process.env.GOOGLE_BILLING_TEMPLATE_SPREADSHEET_ID?.trim() || DEFAULT_BILLING_TEMPLATE_ID;
  assertSafeSpreadsheetTemplate(id, "GOOGLE_BILLING_TEMPLATE_SPREADSHEET_ID");
  return id;
}

function getTasksTemplateId(): string {
  const id = process.env.GOOGLE_TASKS_TEMPLATE_SPREADSHEET_ID?.trim() || DEFAULT_TASKS_TEMPLATE_ID;
  assertSafeSpreadsheetTemplate(id, "GOOGLE_TASKS_TEMPLATE_SPREADSHEET_ID");
  return id;
}

async function createWorkbook(
  accessToken: string,
  templateId: string,
  title: string,
  kind: "billing" | "tasks"
): Promise<string> {
  const spreadsheetId = await copyDriveFile(accessToken, templateId, title);
  if (kind === "billing") {
    const scrub = await scrubBillingWorkbook(accessToken, spreadsheetId);
    await assertBillingWorkbookIsBlank(accessToken, spreadsheetId);
    console.log(`  scrubbed billing (${scrub.deletedClientTabs} client tab(s) removed)`);
  } else {
    const scrub = await scrubTasksWorkbook(accessToken, spreadsheetId);
    console.log(`  scrubbed tasks (${scrub.clearedTabs.join(", ") || "no data tabs"})`);
  }
  return spreadsheetId;
}

async function main() {
  const alsoSaveTemplates = process.argv.includes("--also-save-templates");
  const accessToken = await getCronGoogleAccessToken();
  if (!accessToken) {
    throw new Error(
      "Set CRON_GOOGLE_REFRESH_TOKEN in web/.env.local (firm Google account with spreadsheets + drive scopes)."
    );
  }

  const billingTemplateId = getBillingTemplateId();
  const tasksTemplateId = getTasksTemplateId();

  let savedBillingTemplateId = billingTemplateId;
  let savedTasksTemplateId = tasksTemplateId;

  if (alsoSaveTemplates) {
    console.log("\nSaving HA-owned blank templates…");
    savedBillingTemplateId = await copyDriveFile(
      accessToken,
      billingTemplateId,
      "HA — Billing (template)"
    );
    await scrubBillingWorkbook(accessToken, savedBillingTemplateId);
    await assertBillingWorkbookIsBlank(accessToken, savedBillingTemplateId);

    savedTasksTemplateId = await copyDriveFile(accessToken, tasksTemplateId, "HA — Tasks (template)");
    await scrubTasksWorkbook(accessToken, savedTasksTemplateId);
  }

  console.log("\nCreating live HA workbooks…");
  const billingId = await createWorkbook(
    accessToken,
    billingTemplateId,
    `${FIRM_NAME} — Billing`,
    "billing"
  );
  const tasksId = await createWorkbook(
    accessToken,
    tasksTemplateId,
    `${FIRM_NAME} — Tasks`,
    "tasks"
  );

  console.log("\nDone. Add these to web/.env.local:\n");
  console.log(`GOOGLE_SPREADSHEET_ID=${billingId}`);
  console.log(`TASKS_GOOGLE_SPREADSHEET_ID=${tasksId}`);
  if (alsoSaveTemplates) {
    console.log(`GOOGLE_BILLING_TEMPLATE_SPREADSHEET_ID=${savedBillingTemplateId}`);
    console.log(`GOOGLE_TASKS_TEMPLATE_SPREADSHEET_ID=${savedTasksTemplateId}`);
  }

  console.log("\nOpen in Drive:");
  console.log(`  Billing: ${spreadsheetEditUrl(billingId)}`);
  console.log(`  Tasks:   ${spreadsheetEditUrl(tasksId)}`);
  if (alsoSaveTemplates) {
    console.log(`  Billing template: ${spreadsheetEditUrl(savedBillingTemplateId)}`);
    console.log(`  Tasks template:   ${spreadsheetEditUrl(savedTasksTemplateId)}`);
  }

  console.log("\nNext steps:");
  console.log("  1. Update Settings tab on the billing sheet (firm name, email, AR/NR folder IDs).");
  console.log("  2. Deploy Apps Script from apps-script/ onto the new billing workbook.");
  console.log("  3. Deploy office-tasks Apps Script onto the tasks workbook.");
  console.log("  4. Restart npm run dev and sign in again.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
