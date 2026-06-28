import { formatBillingDate, FIRM_NAME } from "@/lib/billing-document-design";
import { getFirmLetterheadContact } from "@/lib/firm-contact";
import { buildFirmLetterheadCss, buildFirmPageFooterHtml, getFirmLetterSheetLayout } from "@/lib/firm-letterhead-html";
import { getFirmPageSpec } from "@/lib/firm-page-sizes";
import type { SoaLedgerRow, SoaRemittance } from "@/lib/billing-document-pdf/soa-pdf";

export type SoaPreviewInput = {
  clientName?: string;
  clientCode?: string;
  invoiceNumber?: string;
  invoiceDate?: string | Date;
  prevBalance?: number;
  newCharges?: number;
  payments?: number;
  depositBalance?: number;
  totalDue?: number;
  ledger?: SoaLedgerRow[];
  remittance?: SoaRemittance;
  notes?: string;
};

const DEFAULT_NOTES =
  "Thank you for your business. Kindly note the due date indicated. If payment is made through any method other than cash, please send the proof of payment to our email address for immediate posting.";

const SAMPLE_LEDGER: SoaLedgerRow[] = [
  {
    date: "2026-03-07",
    type: "Charge",
    description: "Professional fees — case work",
    charge: 1_000_000,
    payment: 0,
    balance: 1_000_000
  },
  {
    date: "2026-03-25",
    type: "Payment",
    description: "Partial payment received",
    charge: 0,
    payment: 300_000,
    balance: 700_000
  }
];

const SAMPLE_REMITTANCE: SoaRemittance = {
  bankName: "PS Bank",
  accountName: "Robert Hernandez",
  accountNumber: "202330000706"
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function letterSpaceWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.split("").join(" "))
    .join("  ");
}

function formatSoaDateShort(value: string | Date): string {
  const date =
    value instanceof Date
      ? value
      : new Date(`${String(value).trim().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value || "");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatPeso(value: number, options?: { parens?: boolean }): string {
  const n = Number(value) || 0;
  const body = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatted = `₱${body}`;
  return options?.parens && n > 0 ? `(${formatted})` : formatted;
}

function resolveSoaPreviewInput(partial?: SoaPreviewInput): Required<
  Omit<SoaPreviewInput, "remittance" | "ledger" | "notes">
> & {
  remittance: SoaRemittance;
  ledger: SoaLedgerRow[];
  notes: string;
} {
  const totalDue = partial?.totalDue ?? 700_000;
  return {
    clientName: partial?.clientName?.trim() || "Sample Client",
    clientCode: partial?.clientCode?.trim() || "SAMPLE",
    invoiceNumber: partial?.invoiceNumber?.trim() || "INV-SAMPLE-001",
    invoiceDate: partial?.invoiceDate || new Date().toISOString().slice(0, 10),
    prevBalance: partial?.prevBalance ?? 0,
    newCharges: partial?.newCharges ?? 1_000_000,
    payments: partial?.payments ?? 300_000,
    depositBalance: partial?.depositBalance ?? 0,
    totalDue,
    ledger: partial?.ledger?.length ? partial.ledger : SAMPLE_LEDGER,
    remittance: partial?.remittance || SAMPLE_REMITTANCE,
    notes: partial?.notes?.trim() || DEFAULT_NOTES
  };
}

function buildSoaContactHtml(): string {
  const contact = getFirmLetterheadContact();
  const phones: string[] = [];
  if (contact.landline.trim()) phones.push(contact.landline.trim());
  if (contact.mobile.trim() && contact.mobile.trim() !== contact.landline.trim()) {
    phones.push(contact.mobile.trim());
  }
  return (
    `<p class="soa-doc__firm-name">${escapeHtml(FIRM_NAME)}</p>` +
    `<p class="soa-doc__contact-line">${escapeHtml(contact.address)}</p>` +
    (phones.length ? `<p class="soa-doc__contact-line">T: ${escapeHtml(phones.join(" | "))}</p>` : "") +
    (contact.email.trim() ? `<p class="soa-doc__contact-line">E: ${escapeHtml(contact.email.trim())}</p>` : "")
  );
}

function buildSoaPreviewCss(): string {
  const layout = getFirmLetterSheetLayout("a4");
  return `
${buildFirmLetterheadCss()}
.soa-sheet { box-sizing: border-box; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm 17mm ${layout.paddingBottom}; background: #fff; color: #14110e; font-family: Georgia, "Times New Roman", serif; font-size: 9pt; line-height: 1.35; position: relative; }
.soa-doc__header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.35in; margin-bottom: 0.2in; }
.soa-doc__header-left { flex: 1 1 52%; min-width: 0; }
.soa-doc__header-right { flex: 0 0 2.55in; min-width: 0; text-align: right; }
.soa-doc__banner-wrap { margin: 0 0 0.1in; }
.soa-doc__banner { display: block; width: 100%; max-width: 100%; height: auto; margin: 0; padding: 0; border: 0; object-fit: contain; object-position: left top; }
.soa-doc__firm-name { margin: 0 0 0.06in; font-size: 8.5pt; font-weight: 700; color: #14110e; }
.soa-doc__contact-line { margin: 0 0 0.04in; font-size: 8.2pt; color: #6b6358; line-height: 1.45; }
.soa-doc__title { margin: 0; font-size: 19pt; letter-spacing: 0.04em; font-weight: 700; text-align: right; white-space: nowrap; line-height: 1; }
.soa-doc__meta { margin-top: 0.1in; width: 100%; border-top: 1px solid #ddd6c8; padding-top: 0.1in; }
.soa-doc__meta-row { display: flex; justify-content: space-between; gap: 0.15in; margin-top: 0.08in; }
.soa-doc__meta-label { font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.08em; color: #6b6358; text-transform: uppercase; }
.soa-doc__meta-value { font-size: 9pt; font-weight: 700; text-align: right; }
.soa-doc__section { margin-top: 0.14in; padding-top: 0.08in; border-top: 1px solid #ddd6c8; }
.soa-doc__section-title { margin: 0 0 0.1in; font-family: Arial, Helvetica, sans-serif; font-size: 9.8pt; font-weight: 700; letter-spacing: 0.12em; border-bottom: 1.5px solid #14110e; padding-bottom: 0.08in; }
.soa-doc__summary-row { display: flex; justify-content: space-between; gap: 0.2in; margin: 0.08in 0; font-size: 9.8pt; }
.soa-doc__summary-row--total { margin-top: 0.12in; padding-top: 0.1in; border-top: 1.5px solid #14110e; font-size: 12pt; font-weight: 700; }
.soa-doc__summary-foot { margin-top: 0.1in; border-top: 1.5px solid #14110e; height: 0; }
.soa-doc__table { width: 100%; border-collapse: collapse; margin-top: 0.08in; font-size: 9pt; }
.soa-doc__table th { font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; letter-spacing: 0.08em; text-transform: uppercase; color: #6b6358; text-align: left; padding: 0.06in 0.04in; border-bottom: 1px solid #ddd6c8; font-weight: 700; }
.soa-doc__table td { padding: 0.07in 0.04in; border-bottom: 1px solid #ece7dc; vertical-align: top; }
.soa-doc__amount { text-align: right; white-space: nowrap; }
.soa-doc__footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.28in; margin-top: 0.22in; align-items: start; }
.soa-doc__notes-title { margin: 0 0 0.08in; font-style: italic; font-weight: 700; font-size: 8.2pt; }
.soa-doc__notes { margin: 0; font-style: italic; font-size: 8.2pt; line-height: 1.55; color: #3d3830; }
.soa-doc__remit-box { border: 0.75px solid #14110e; padding: 0.12in 0.14in; }
.soa-doc__remit-title { margin: 0 0 0.07in; font-family: Arial, Helvetica, sans-serif; font-size: 8pt; font-weight: 700; letter-spacing: 0.08em; border-bottom: 1px solid #ddd6c8; padding-bottom: 0.05in; }
.soa-doc__remit-row { display: grid; grid-template-columns: 0.95in 1fr; gap: 0.08in; align-items: baseline; margin-top: 0.09in; }
.soa-doc__remit-label { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.06em; color: #6b6358; text-transform: uppercase; }
.soa-doc__remit-value { margin: 0; font-size: 9.2pt; font-weight: 700; color: #14110e; }
.soa-doc p { margin: 0; }
`;
}

function buildSoaBodyHtml(input: ReturnType<typeof resolveSoaPreviewInput>): string {
  const summaryRows = [
    { label: "Previous Balance", amount: input.prevBalance },
    { label: "New Charges", amount: input.newCharges },
    { label: "Payments Received", amount: input.payments, parens: true },
    { label: "Deposit Balance", amount: input.depositBalance }
  ];

  const ledgerRows = input.ledger
    .map(
      (row) =>
        `<tr>` +
        `<td>${escapeHtml(formatSoaDateShort(row.date))}</td>` +
        `<td>${escapeHtml(String(row.type || ""))}</td>` +
        `<td>${escapeHtml(row.description)}</td>` +
        `<td class="soa-doc__amount">${row.charge > 0 ? escapeHtml(formatPeso(row.charge)) : ""}</td>` +
        `<td class="soa-doc__amount">${row.payment > 0 ? escapeHtml(formatPeso(row.payment)) : ""}</td>` +
        `<td class="soa-doc__amount">${escapeHtml(formatPeso(row.balance))}</td>` +
        `</tr>`
    )
    .join("");

  const remitRow = (label: string, value: string) =>
    `<div class="soa-doc__remit-row">` +
    `<p class="soa-doc__remit-label">${escapeHtml(label)}</p>` +
    `<p class="soa-doc__remit-value">${escapeHtml(value)}</p>` +
    `</div>`;

  const remittanceHtml =
    input.remittance.bankName || input.remittance.accountName || input.remittance.accountNumber
      ? `<div class="soa-doc__remit-box">` +
        `<p class="soa-doc__remit-title">REMITTANCE INSTRUCTIONS</p>` +
        (input.remittance.bankName ? remitRow("Bank name", input.remittance.bankName) : "") +
        (input.remittance.accountName ? remitRow("Account name", input.remittance.accountName) : "") +
        (input.remittance.accountNumber ? remitRow("Account number", input.remittance.accountNumber) : "") +
        `</div>`
      : "";

  return (
    `<style>${buildSoaPreviewCss()}</style>` +
    `<div class="soa-sheet sheet sheet--a4">` +
    `<div class="soa-doc">` +
    `<div class="soa-doc__header">` +
    `<div class="soa-doc__header-left">` +
    `<div class="soa-doc__banner-wrap"><img class="soa-doc__banner" src="/brand/cover.png" alt="${escapeHtml(FIRM_NAME)}" /></div>` +
    buildSoaContactHtml() +
    `</div>` +
    `<div class="soa-doc__header-right">` +
    `<h1 class="soa-doc__title">STATEMENT</h1>` +
    `<div class="soa-doc__meta">` +
    `<div class="soa-doc__meta-row"><span class="soa-doc__meta-label">Prepared for</span><span class="soa-doc__meta-value">${escapeHtml(input.clientName)}</span></div>` +
    `<div class="soa-doc__meta-row"><span class="soa-doc__meta-label">Invoice no.</span><span class="soa-doc__meta-value">${escapeHtml(input.invoiceNumber)}</span></div>` +
    `<div class="soa-doc__meta-row"><span class="soa-doc__meta-label">Date issued</span><span class="soa-doc__meta-value">${escapeHtml(formatBillingDate(input.invoiceDate))}</span></div>` +
    `</div></div></div>` +
    `<section class="soa-doc__section">` +
    `<h2 class="soa-doc__section-title">${escapeHtml(letterSpaceWords("ACCOUNT SUMMARY"))}</h2>` +
    summaryRows
      .map(
        (row) =>
          `<div class="soa-doc__summary-row"><span>${escapeHtml(row.label)}</span><span>${escapeHtml(formatPeso(row.amount, { parens: row.parens }))}</span></div>`
      )
      .join("") +
    `<div class="soa-doc__summary-row soa-doc__summary-row--total"><span>TOTAL BALANCE DUE</span><span>${escapeHtml(formatPeso(input.totalDue))}</span></div>` +
    `<div class="soa-doc__summary-foot"></div>` +
    `</section>` +
    `<section class="soa-doc__section">` +
    `<h2 class="soa-doc__section-title">${escapeHtml(letterSpaceWords("DETAILED LEDGER"))}</h2>` +
    `<table class="soa-doc__table"><thead><tr>` +
    `<th>Date</th><th>Type</th><th>Description</th><th class="soa-doc__amount">Charge</th><th class="soa-doc__amount">Payment</th><th class="soa-doc__amount">Balance</th>` +
    `</tr></thead><tbody>${ledgerRows}</tbody></table>` +
    `</section>` +
    `<div class="soa-doc__footer-grid">` +
    `<div><p class="soa-doc__notes-title">Notes &amp; Remarks:</p><p class="soa-doc__notes">${escapeHtml(input.notes)}</p></div>` +
    remittanceHtml +
    `</div>` +
    `</div>` +
    buildFirmPageFooterHtml() +
    `</div>`
  );
}

/** HTML preview of the Statement of Account (A4, matches SOA PDF layout). */
export function buildSoaPreviewHtml(partial?: SoaPreviewInput): string {
  const input = resolveSoaPreviewInput(partial);
  const spec = getFirmPageSpec("a4");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(FIRM_NAME)} — Statement of Account</title>
  <style>@page { size: ${spec.pageCss}; margin: 0; } body { margin: 0; background: #ececec; }</style>
</head>
<body>${buildSoaBodyHtml(input)}</body>
</html>`;
}

export function buildSoaPreviewInputFromClient(context: {
  clientName?: string;
  clientCode?: string;
  balance?: number;
}): SoaPreviewInput {
  const totalDue = Number(context.balance) || 0;
  if (totalDue <= 0) {
    return {
      clientName: context.clientName,
      clientCode: context.clientCode,
      totalDue: 0,
      prevBalance: 0,
      newCharges: 0,
      payments: 0,
      depositBalance: 0
    };
  }

  return {
    clientName: context.clientName,
    clientCode: context.clientCode,
    totalDue,
    prevBalance: 0,
    newCharges: totalDue,
    payments: 0,
    depositBalance: 0,
    ledger: [
      {
        date: new Date().toISOString().slice(0, 10),
        type: "Charge",
        description: "Outstanding balance per ledger",
        charge: totalDue,
        payment: 0,
        balance: totalDue
      }
    ]
  };
}
