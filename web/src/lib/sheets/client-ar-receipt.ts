import {
  GL,
  normalizePaymentMethod,
  type GenerateArPayload
} from "@/lib/gl-config";
import {
  arEmailSubject,
  buildArEmailHtml,
  buildArEmailPlain
} from "@/lib/billing-email";
import { formatBillingDate } from "@/lib/billing-document-design";
import { arPdfFilename, buildArPdf } from "@/lib/billing-document-pdf/ar-pdf";
import { sendHtmlEmailWithAttachmentsViaGmail } from "@/lib/office-tasks/gmail-send";
import { getSheetValues, sheetExists, updateSheetValues } from "@/lib/sheets/client";
import { appendDocumentLogEntry, getDocumentLog } from "@/lib/sheets/document-log";
import { uploadPdfToDriveFolder } from "@/lib/sheets/drive-outbound-pdf";
import { getOrCreateArFolderId } from "@/lib/sheets/drive-ar-folder";
import { buildHyperlinkFormula } from "@/lib/sheets/hyperlinks";
import { updateSingleClientStatus } from "@/lib/sheets/ledger";
import { getClientDetail } from "@/lib/sheets/master";
import { readSettingsMap } from "@/lib/sheets/settings";

async function getNextArReceiptNumber(accessToken: string, clientCode: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AR-${clientCode}-${year}-`;
  let maxSeq = 0;

  const scanNumber = (value: string) => {
    const match = value.match(new RegExp(`^AR-${clientCode}-${year}-(\\d+)$`, "i"));
    if (match) maxSeq = Math.max(maxSeq, Number.parseInt(match[1], 10));
  };

  const logs = await getDocumentLog(accessToken, { clientCode, limit: 500 });
  for (const entry of logs) {
    if (entry.documentType.toUpperCase() !== "AR") continue;
    scanNumber(entry.documentNumber);
  }

  if (await sheetExists(accessToken, clientCode)) {
    const ledger = await getSheetValues(
      accessToken,
      `'${clientCode}'!J${GL.ledgerStartRow}:J`
    );
    for (const row of ledger) {
      scanNumber(String(row[0] || ""));
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

async function readLedgerPaymentRow(
  accessToken: string,
  clientCode: string,
  sheetRow: number
): Promise<unknown[] | null> {
  if (sheetRow < GL.ledgerStartRow) return null;
  const values = await getSheetValues(accessToken, `'${clientCode}'!A${sheetRow}:L${sheetRow}`);
  return values[0] || null;
}

export async function generateClientArReceiptNative(
  accessToken: string,
  payload: GenerateArPayload
): Promise<{ ok: true; message: string; receiptNumber: string }> {
  const clientCode = payload.clientCode.trim();
  const sheetRow = Number(payload.sheetRow);
  const deliveryAction = payload.deliveryAction || "Send Now";

  if (!clientCode) throw new Error("Client code is required.");
  if (!sheetRow) throw new Error("Payment row is required.");

  const client = await getClientDetail(accessToken, clientCode);
  if (!client) throw new Error("Client not found in Master List.");
  if (!(await sheetExists(accessToken, clientCode))) {
    throw new Error("Client tab not found.");
  }

  const rowValues = await readLedgerPaymentRow(accessToken, clientCode, sheetRow);
  if (!rowValues || !rowValues[0]) throw new Error("Ledger entry not found.");

  const rowType = String(rowValues[1] || "").toLowerCase();
  if (rowType !== "payment") throw new Error("Selected row is not a valid payment.");

  const amount = Number(rowValues[5]) || 0;
  if (!amount || amount <= 0) throw new Error("Selected row is not a valid payment.");

  const method =
    normalizePaymentMethod(payload.method) ||
    normalizePaymentMethod(String(rowValues[7] || "")) ||
    payload.method ||
    String(rowValues[7] || "");
  const details = payload.details || String(rowValues[8] || "");
  const description =
    payload.description ||
    String(rowValues[3] || rowValues[2] || "Payment received");

  const existingReceipt = String(rowValues[9] || "").trim();
  const receiptNumber = existingReceipt || (await getNextArReceiptNumber(accessToken, clientCode));

  const settings = await readSettingsMap(accessToken);
  const receivedBy = settings.get("Firm Name")?.trim() || "Hernandez & Associates";

  await updateSheetValues(accessToken, `'${clientCode}'!D${sheetRow}:I${sheetRow}`, [
    [description, rowValues[4] || "", amount, rowValues[6] || "", method, details]
  ]);

  const pdfBytes = await buildArPdf({
    receiptNumber,
    receiptDate: new Date(),
    paymentDate: String(rowValues[0] || new Date().toISOString().slice(0, 10)),
    clientName: client.name,
    clientAddress: client.address,
    caseTitle: client.caseTitle,
    paymentFor: description,
    amount,
    balanceAfter: Number(rowValues[6]) || 0,
    paymentMethod: method,
    paymentDetails: details,
    receivedBy
  });

  const folderId = await getOrCreateArFolderId(accessToken);
  const filename = arPdfFilename(receiptNumber, clientCode);
  const pdfUrl = await uploadPdfToDriveFolder(
    accessToken,
    folderId,
    filename,
    Buffer.from(pdfBytes),
    "AR"
  );

  const paymentDateLabel = formatBillingDate(String(rowValues[0] || new Date()));
  const email = client.email?.trim();
  if (!email) throw new Error("Client email is missing in Master List.");

  const emailInput = {
    preferredGreeting: payload.preferredGreeting,
    clientName: client.name,
    clientCode,
    receiptNumber,
    paymentDate: paymentDateLabel,
    amount,
    method,
    details,
    paymentFor: description,
    balance: Number(rowValues[6]) || 0,
    extraNote: payload.extraNote
  };

  const subject = arEmailSubject(receiptNumber, clientCode);
  const html = buildArEmailHtml(emailInput);
  const plain = buildArEmailPlain(emailInput);
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

  const sentAt =
    deliveryAction === "Send Now"
      ? new Date().toISOString().slice(0, 10)
      : String(rowValues[10] || "");

  await updateSheetValues(accessToken, `'${clientCode}'!J${sheetRow}:L${sheetRow}`, [
    [receiptNumber, sentAt, buildHyperlinkFormula(pdfUrl, "View AR")]
  ]);

  await appendDocumentLogEntry(accessToken, {
    clientCode,
    clientName: client.name,
    documentType: "AR",
    documentNumber: receiptNumber,
    amount,
    email,
    pdfUrl,
    status: deliveryAction === "Send Now" ? "Sent" : "Draft Created"
  });

  await updateSingleClientStatus(accessToken, clientCode);

  return {
    ok: true,
    message:
      deliveryAction === "Send Now"
        ? `Acknowledgment Receipt ${receiptNumber} sent to ${email}.`
        : `AR Gmail draft created for ${email}.`,
    receiptNumber
  };
}
