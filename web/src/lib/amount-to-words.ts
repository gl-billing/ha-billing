/** Convert peso amount (whole number part) to words for receipts and SOA. */
export function amountToWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "Zero";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function under1000(num: number): string {
    const parts: string[] = [];
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    if (hundred) parts.push(`${ones[hundred]} Hundred`);
    if (rest) {
      if (rest < 20) parts.push(ones[rest]);
      else {
        const t = Math.floor(rest / 10);
        const o = rest % 10;
        parts.push(o ? `${tens[t]}-${ones[o]}` : tens[t]);
      }
    }
    return parts.join(" ");
  }

  const million = Math.floor(n / 1_000_000);
  const thousand = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const chunks: string[] = [];
  if (million) chunks.push(`${under1000(million)} Million`);
  if (thousand) chunks.push(`${under1000(thousand)} Thousand`);
  if (rest) chunks.push(under1000(rest));
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}
