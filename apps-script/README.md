# Apps Script bridge

## WebAppApi.gs

Add this file to your existing Apps Script project (same project as `code.gs`).

1. Paste `WebAppApi.gs`.
2. Add **Settings → Web App Secret** (random string).
3. Deploy as **Web app** and set the URL in `web/.env.local` as `APPS_SCRIPT_WEB_APP_URL`.
4. Set the same secret in `APPS_SCRIPT_WEB_APP_SECRET`.

Supported actions: `ping`, `generateSOA`, `generateAR`, `generateSOAHeadless`, `generateARHeadless`, `refreshDashboard`, `batchGenerateSOAHeadless`, `setupAutoRefreshTrigger`, `backupSpreadsheet`.

## Triggers.gs

Paste alongside the other files. Provides:

- **Batch SOA** — `batchGenerateSOAHeadless_()` loops clients with 1.5s delay
- **Hourly dashboard sync** — `setupAutoRefreshTrigger_()` / `onHourlyDashboardRefresh_()`
- **Spreadsheet backup** — copies to `HA Billing Backups` folder in Drive

Run `installHourlyDashboardRefresh()` once from the Apps Script editor, or use **Reports → Enable hourly dashboard sync** in the web app.

## WebAppHeadless.gs

Add this file for SOA/AR from the web app (no Google pop-up prompts). Redeploy the Web App after adding.

SOA/AR still use your existing functions (`generateAndSendSheetSOA`, etc.), including Google UI prompts for payment selection and status reports.

## BillingEmailHtml.gs

Paste **after** `WebAppHeadless.gs`. Provides elegant HTML + plain-text SOA/AR email bodies and shared acknowledgment receipt tag filling (`{{TRANSFER_CHECK}}`, etc.) for the **Acknowledgment Receipt** sheet template.

Redeploy the Web App after adding or updating this file.

**Document PDFs:** SOA uses the **Invoice** tab template; AR and notarial receipts use the **Acknowledgment Receipt** tab template (your firm layout with logo and gold header).
