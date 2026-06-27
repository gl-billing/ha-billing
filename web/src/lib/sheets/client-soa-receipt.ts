import type { GenerateSoaPayload } from "@/lib/gl-config";
import { GL } from "@/lib/gl-config";
import {
  buildSoaEmailHtml,
  buildSoaEmailPlain,
  soaEmailSubject
} from "@/lib/billing-email";
import { buildSoaPdf, soaPdfFilename, type SoaRemittance } from "@/lib/billing-document-pdf/soa-pdf";
import { sendHtmlEmailWithAttachmentsViaGmail } from "@/lib/office-tasks/gmail-send";
import { getPaymentInstructions } from "@/lib/payment-request";
import { getSheetValues, sheetExists, updateSheetValues } from "@/lib/sheets/client";
import { appendDocumentLogEntry, getDocumentLog } from "@/lib/sheets/document-log";
import { getOrCreateSoaFolderId } from "@/lib/sheets/drive-soa-folder";
import { buildHyperlinkFormula } from "@/lib/sheets/hyperlinks";
import { getClientLedger } from "@/lib/sheets/ledger-read";
import { updateSingleClientStatus } from "@/lib/sheets/ledger";
import { findMasterRow, getClientDetail } from "@/lib/sheets/master";
import { readSettingsMap } from "@/lib/sheets/settings";

async function driveFetch(accessToken: string, url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {})
    },
    cache: "no-store"
  });
}

async function uploadPdfToDrive(
  accessToken: string,
  folderId: string,
  filename: string,
  pdf: Buffer
): Promise<string> {
  const boundary = `ha-billing-${Date.now()}`;
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
    mimeType: "application/pdf"
  });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
    ),
    pdf,
    Buffer.from(`\r\n--${boundary}--`)
  ]);

  const uploadRes = await driveFetch(
    accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    }
  );

  if (!uploadRes.ok) {
    const detail = (await uploadRes.text()).slice(0, 200);
    if (/insufficient|scope|permission|403/i.test(detail)) {
      throw new Error(
        "Google Drive permission is required to save SOA PDFs. Sign out and sign in again to grant Drive access, then retry."
      );
    }
    throw new Error(`Could not save SOA PDF to Drive (${uploadRes.status}).`);
  }

  const file = (await uploadRes.json()) as { id?: string; webViewLink?: string };
  if (file.webViewLink) return file.webViewLink;
  if (file.id) return `https://drive.google.com/file/d/${file.id}/view`;
  throw new Error("SOA PDF was uploaded but no view link was returned.");
}

async function getNextInvoiceNumber(accessToken: string, clientCode: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${clientCode}-${year}-`;
  let maxSeq = 0;

  const scanNumber = (value: string) => {
    const match = value.match(new RegExp(`^INV-${clientCode}-${year}-(\\d+)$`, "i"));
    if (match) maxSeq = Math.max(maxSeq, Number.parseInt(match[1], 10));
  };

  const logs = await getDocumentLog(accessToken, { clientCode, limit: 500 });
  for (const entry of logs) {
    if (entry.documentType.toUpperCase() !== "SOA") continue;
    scanNumber(entry.documentNumber);
  }

  const found = await findMasterRow(accessToken, clientCode);
  if (found?.values[13]) scanNumber(String(found.values[13]));

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

function parseBankDetails(raw: string): Partial<SoaRemittance> {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return {};

  const result: Partial<SoaRemittance> = {};
  for (const line of lines) {
    const bankMatch = line.match(/^bank\s*name\s*[:.]?\s*(.+)$/i);
    const accountNameMatch = line.match(/^account\s*name\s*[:.]?\s*(.+)$/i);
    const accountNoMatch = line.match(/^account\s*(?:no|number)\s*[:.]?\s*(.+)$/i);
    if (bankMatch) result.bankName = bankMatch[1].trim();
    else if (accountNameMatch) result.accountName = accountNameMatch[1].trim();
    else if (accountNoMatch) result.accountNumber = accountNoMatch[1].trim();
  }

  if (!result.bankName && lines.length === 1) result.bankName = lines[0];
  return result;
}

function resolveSoaRemittance(settings: Map<string, string>): SoaRemittance | undefined {
  const fromSettings: SoaRemittance = {
    bankName:
      settings.get("Bank Name")?.trim() ||
      settings.get("SOA Bank Name")?.trim() ||
      process.env.SOA_BANK_NAME?.trim() ||
      "",
    accountName:
      settings.get("Account Name")?.trim() ||
      settings.get("SOA Account Name")?.trim() ||
      process.env.SOA_ACCOUNT_NAME?.trim() ||
      getPaymentInstructions().payee ||
      "",
    accountNumber:
      settings.get("Account Number")?.trim() ||
      settings.get("SOA Account Number")?.trim() ||
      process.env.SOA_ACCOUNT_NUMBER?.trim() ||
      ""
  };

  const parsed = parseBankDetails(getPaymentInstructions().bank);
  const remittance: SoaRemittance = {
    bankName: fromSettings.bankName || parsed.bankName || "",
    accountName: fromSettings.accountName || parsed.accountName || "",
    accountNumber: fromSettings.accountNumber || parsed.accountNumber || ""
  };

  if (!remittance.bankName && !remittance.accountName && !remittance.accountNumber) {
    return undefined;
  }
  return remittance;
}

function formatPeriod(startDate: string, endDate: Date): string {
  const start = new Date(`${startDate.slice(0, 10)}T12:00:00`);
  const end = endDate;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  if (Number.isNaN(start.getTime())) return fmt(end);
  return `${fmt(start)} – ${fmt(end)}`;
}

export async function generateClientSoaNative(
  accessToken: string,
  payload: GenerateSoaPayload
): Promise<{ ok: true; message: string; invoiceNumber: string }> {
  const clientCode = payload.clientCode.trim();
  if (!clientCode) throw new Error("Client code is required.");

  const client = await getClientDetail(accessToken, clientCode);
  if (!client) throw new Error("Client not found in Master List.");
  if (!(await sheetExists(accessToken, clientCode))) {
    throw new Error("Client tab not found.");
  }

  const email = client.email?.trim();
  if (!email) throw new Error("Client email is missing in Master List.");

  const { entries, summary } = await getClientLedger(accessToken, clientCode);
  if (!entries.length) throw new Error("No ledger entries found for this client.");

  const settings = await readSettingsMap(accessToken);
  const invoiceNumber = await getNextInvoiceNumber(accessToken, clientCode);
  const today = new Date();
  const deliveryAction = payload.deliveryAction || "Send Now";
  const dueDays = Number(settings.get("Default Due Days") || 7) || 7;
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + dueDays);

  const firstEntryDate = String(entries[0]?.date || today.toISOString().slice(0, 10));
  const period = formatPeriod(firstEntryDate, today);

  const pdfBytes = await buildSoaPdf({
    clientCode,
    clientName: client.name,
    clientAddress: client.address,
    clientPhone: client.phone,
    caseTitle: client.caseTitle,
    caseNumber: client.caseNumber,
    invoiceNumber,
    invoiceDate: today,
    period,
    prevBalance: client.prevBalance,
    newCharges: summary.charges,
    payments: summary.payments,
    depositBalance: client.retainerBalance,
    totalDue: summary.totalDue,
    remittance: resolveSoaRemittance(settings),
    ledger: entries.map((entry) => ({
      date: entry.date,
      type: entry.category || entry.type,
      description: entry.description || entry.category || entry.type,
      charge: entry.charge,
      payment: entry.payment,
      balance: entry.balance
    }))
  });

  const folderId = await getOrCreateSoaFolderId(accessToken);
  const filename = soaPdfFilename({ invoiceNumber, clientCode });
  const pdfUrl = await uploadPdfToDrive(accessToken, folderId, filename, Buffer.from(pdfBytes));

  const emailInput = {
    preferredGreeting: payload.preferredGreeting,
    clientName: client.name,
    clientCode,
    invoiceNumber,
    totalDue: summary.totalDue,
    statusReport: payload.statusReport ?? null,
    includeStatusReport: Boolean(payload.statusReport?.summary?.trim())
  };

  const subject = soaEmailSubject(invoiceNumber, clientCode);
  const html = buildSoaEmailHtml(emailInput);
  const plain = buildSoaEmailPlain(emailInput);
  const attachment = {
    filename,
    mimeType: "application/pdf",
    content: Buffer.from(pdfBytes)
  };

  if (deliveryAction === "Create Gmail Draft") {
    await sendHtmlEmailWithAttachmentsViaGmail({
      accessToken,
      to: email,
      subject,
      html,
      plain,
      attachments: [attachment],
      mode: "draft"
    });
  } else {
    await sendHtmlEmailWithAttachmentsViaGmail({
      accessToken,
      to: email,
      subject,
      html,
      plain,
      attachments: [attachment],
      mode: "send"
    });
  }

  const found = await findMasterRow(accessToken, clientCode);
  if (!found) throw new Error("Client not found in Master List.");

  const billingDate = today.toISOString().slice(0, 10);
  const soaSentValue = deliveryAction === "Send Now" ? billingDate : String(found.values[12] || "");

  await updateSheetValues(accessToken, `'${GL.sheets.master}'!H${found.row}:H${found.row}`, [[billingDate]]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!M${found.row}:O${found.row}`, [
    [soaSentValue, invoiceNumber, buildHyperlinkFormula(pdfUrl, "View SOA")]
  ]);
  await updateSheetValues(accessToken, `'${GL.sheets.master}'!S${found.row}:S${found.row}`, [
    [dueDate.toISOString().slice(0, 10)]
  ]);

  await appendDocumentLogEntry(accessToken, {
    clientCode,
    clientName: client.name,
    documentType: "SOA",
    documentNumber: invoiceNumber,
    amount: summary.totalDue,
    email,
    pdfUrl,
    status: deliveryAction === "Send Now" ? "Sent" : "Draft Created"
  });

  await updateSingleClientStatus(accessToken, clientCode);

  return {
    ok: true,
    message:
      deliveryAction === "Send Now"
        ? `SOA sent to ${email}.`
        : `SOA Gmail draft created for ${email}.`,
    invoiceNumber
  };
}
