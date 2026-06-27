/**
 * Generate sample SOA and AR PDFs for layout preview.
 * Run from web/: npx tsx scripts/generate-sample-billing-pdfs.ts
 */
import fs from "fs";
import path from "path";
import { arPdfFilename, buildArPdf } from "../src/lib/billing-document-pdf/ar-pdf";
import { buildSoaPdf, soaPdfFilename } from "../src/lib/billing-document-pdf/soa-pdf";

const OUT_DIR = path.join(process.cwd(), "sample-output");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const soaInput = {
    clientCode: "DIVINAGRACIA",
    clientName: "Maria Elena S. Divinagracia",
    clientAddress: "Blk 12 Lot 8, Green Meadows Subdivision, Matina, Davao City",
    clientPhone: "+63 917 555 0142",
    caseTitle: "Petition for Declaration of Nullity of Marriage",
    caseNumber: "ANN-2024-1187",
    invoiceNumber: "INV-DIVINAGRACIA-2026-014",
    invoiceDate: "2026-06-07",
    period: "January 15, 2026 – June 7, 2026",
    prevBalance: 12500,
    newCharges: 48500,
    payments: 20000,
    totalDue: 41000,
    ledger: [
      {
        date: "Jan 15, 2026",
        type: "Charge",
        description: "Acceptance Fee — initial consultation and case evaluation",
        charge: 15000,
        payment: 0,
        balance: 27500
      },
      {
        date: "Feb 3, 2026",
        type: "Charge",
        description: "Professional Fee — preparation of petition and supporting affidavits",
        charge: 25000,
        payment: 0,
        balance: 52500
      },
      {
        date: "Mar 18, 2026",
        type: "Charge",
        description: "Filing Fee — RTC submission and documentary stamps",
        charge: 3500,
        payment: 0,
        balance: 56000
      },
      {
        date: "Apr 2, 2026",
        type: "Payment",
        description: "Payment received — GCash",
        charge: 0,
        payment: 20000,
        balance: 36000
      },
      {
        date: "May 22, 2026",
        type: "Charge",
        description: "Appearance Fee — pre-trial conference attendance",
        charge: 5000,
        payment: 0,
        balance: 41000
      }
    ],
    remittance: {
      bankName: "PS Bank",
      accountName: "Robert Hernandez",
      accountNumber: "202330000706"
    }
  };

  const arInput = {
    receiptNumber: "AR-DIVINAGRACIA-2026-042",
    receiptDate: "2026-06-07",
    paymentDate: "2026-04-02",
    clientName: "Maria Elena S. Divinagracia",
    clientAddress: "Blk 12 Lot 8, Green Meadows Subdivision, Matina, Davao City",
    caseTitle: "Petition for Declaration of Nullity of Marriage",
    paymentFor: "Partial payment — professional fees and case expenses",
    amount: 20000,
    balanceAfter: 41000,
    paymentMethod: "GCash",
    paymentDetails: "Ref. 0429183756 · Received via firm GCash account",
    receivedBy: "HERNANDEZ & LUMANAG"
  };

  const [soaBytes, arBytes] = await Promise.all([buildSoaPdf(soaInput), buildArPdf(arInput)]);

  const soaPath = path.join(OUT_DIR, soaPdfFilename(soaInput));
  const arPath = path.join(OUT_DIR, arPdfFilename(arInput.receiptNumber));

  fs.writeFileSync(soaPath, soaBytes);
  fs.writeFileSync(arPath, arBytes);

  console.log("Sample PDFs generated:");
  console.log(`  SOA: ${soaPath}`);
  console.log(`  AR:  ${arPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
