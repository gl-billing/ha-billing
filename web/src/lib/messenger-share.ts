/** Share links for client PDFs via WhatsApp or Viber (opens app or web with pre-filled text). */

export function whatsAppShareUrl(text: string, phoneE164?: string): string {
  const encoded = encodeURIComponent(text.trim());
  if (phoneE164) {
    const digits = phoneE164.replace(/\D/g, "");
    return `https://wa.me/${digits}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

export function viberShareUrl(text: string, phoneE164?: string): string {
  const encoded = encodeURIComponent(text.trim());
  if (phoneE164) {
    const digits = phoneE164.replace(/\D/g, "");
    return `viber://forward?text=${encoded}&number=%2B${digits}`;
  }
  return `viber://forward?text=${encoded}`;
}

export function soaShareMessage(options: {
  clientName: string;
  clientCode: string;
  balanceLabel: string;
  pdfUrl?: string;
}): string {
  const lines = [
    `Hernandez & Associates — Statement of Account`,
    ``,
    `Re: ${options.clientName} (${options.clientCode})`,
    `Balance: ${options.balanceLabel}`
  ];
  if (options.pdfUrl?.trim()) {
    lines.push(``, `PDF: ${options.pdfUrl.trim()}`);
  }
  lines.push(``, `For questions, reply to this message or contact our office.`);
  return lines.join("\n");
}
