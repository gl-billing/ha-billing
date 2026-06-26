import { isGenericPaymentLabel } from "@/lib/payment-income";
import { GL } from "@/lib/gl-config";
import { getSheetsClient, getSpreadsheetId, sheetExists } from "@/lib/sheets/client";
import { getAllMasterRows } from "@/lib/sheets/master";
import { getSheetTitles } from "@/lib/sheets/sheet-meta";
import type { HealthCheck } from "@/lib/health-checks";

export async function runLedgerIncomeHealthChecks(accessToken: string): Promise<HealthCheck[]> {
  const masterRows = await getAllMasterRows(accessToken);
  const tabTitles = new Set(await getSheetTitles(accessToken));
  const clients = masterRows
    .filter((row) => row[0])
    .map((row) => String(row[0]).trim())
    .filter((code) => tabTitles.has(code));

  let genericPayments = 0;
  const chunkSize = 40;
  const sheets = getSheetsClient(accessToken);

  for (let i = 0; i < clients.length; i += chunkSize) {
    const chunk = clients.slice(i, i + chunkSize);
    const ranges = chunk.map((code) => `'${code.replace(/'/g, "''")}'!A${GL.ledgerStartRow}:F`);

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: getSpreadsheetId(),
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING"
    });

    const valueRanges = response.data.valueRanges || [];
    valueRanges.forEach((valueRange) => {
      const rows = (valueRange.values as string[][]) || [];
      rows.forEach((row) => {
        if (String(row[1] || "").toLowerCase() !== "payment") return;
        const amount = Number(row[5]) || 0;
        if (!row[0] || amount <= 0) return;
        if (isGenericPaymentLabel(String(row[2] || ""), String(row[3] || ""))) {
          genericPayments += 1;
        }
      });
    });
  }

  return [
    {
      id: "generic-ledger-payments",
      label: "Ledger payments missing income type",
      status: genericPayments ? "warn" : "ok",
      count: genericPayments,
      message: genericPayments
        ? `${genericPayments} payment(s) still use generic “Payment Received”. Open Firm finances → Needs review, or relabel when issuing receipts.`
        : "No generic ledger payment labels found."
    }
  ];
}
