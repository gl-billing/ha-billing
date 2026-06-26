/** Payment purpose on notarial acknowledgment receipts — matches client-matter AR template tags. */
export function notarizationReceiptPaymentFor(documentType: string): string {
  const doc = String(documentType || "").trim();
  return doc ? `Notarization of ${doc}` : "Notarization of the document specified";
}

export const NOTARIZATION_RETAINER_METHOD = "Retainer";

export function isNotarizationRetainer(entry: { amount: number; paymentMethod: string }): boolean {
  return entry.paymentMethod === NOTARIZATION_RETAINER_METHOD && entry.amount === 0;
}

export function formatNotarizationReceiptIssuedDate(value: string): string {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text.includes("T") ? text : `${text.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
