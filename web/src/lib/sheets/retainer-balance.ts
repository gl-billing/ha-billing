import "server-only";

import { getClientDetail, updateClient } from "@/lib/sheets/master";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { invalidateBillingReadCaches, invalidateCache } from "@/lib/sheets/cache";

export type RetainerDrawResult = {
  applied: number;
  previousBalance: number;
  remainingBalance: number;
};

/** Decrease Master List retainer balance when work is covered by retainer. */
export async function applyRetainerDraw(
  accessToken: string,
  clientCode: string,
  amountPhp: number,
  options?: { auditUser?: string; summary?: string }
): Promise<RetainerDrawResult> {
  const code = clientCode.trim().toUpperCase();
  const amount = Math.max(0, Number(amountPhp) || 0);
  if (amount <= 0.005) {
    const client = await getClientDetail(accessToken, code);
    const previousBalance = client?.retainerBalance ?? 0;
    return { applied: 0, previousBalance, remainingBalance: previousBalance };
  }

  const client = await getClientDetail(accessToken, code);
  if (!client) throw new Error(`Client ${code} not found.`);

  const previousBalance = client.retainerBalance || 0;
  const applied = Math.min(previousBalance, amount);
  const remainingBalance = Math.max(0, previousBalance - applied);

  if (applied > 0.005) {
    await updateClient(accessToken, code, { retainerBalance: remainingBalance });
    invalidateBillingReadCaches(accessToken);
    invalidateCache(accessToken, `profile:${code}`);
  }

  await appendAuditLog(accessToken, {
    user: options?.auditUser || "system",
    action: "retainer.draw",
    clientCode: code,
    summary: options?.summary || "Retainer balance draw",
    details: `Draw ₱${applied.toLocaleString("en-PH")} · balance ₱${previousBalance.toLocaleString("en-PH")} → ₱${remainingBalance.toLocaleString("en-PH")}`
  }).catch(() => undefined);

  return { applied, previousBalance, remainingBalance };
}
