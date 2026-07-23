import "server-only";

import { triggerTaskOnSoaSent } from "@/lib/billing-task-triggers";
import { generateClientSoaNative } from "@/lib/sheets/client-soa-receipt";
import { getClientDetail } from "@/lib/sheets/master";
import { checkSoaDuplicateWarning, handleSoaSentFollowUp } from "@/lib/soa-follow-up";

export type IssueSoaHeadlessInput = {
  clientCode: string;
  preferredGreeting?: string;
  deliveryAction?: "Send Now" | "Create Gmail Draft";
  includePortalLink?: boolean;
  auditUser?: string;
  forceRetainer?: boolean;
};

export type IssueSoaHeadlessResult = {
  ok: boolean;
  message: string;
  invoiceNumber?: string;
  skipped?: boolean;
};

/**
 * Generate and email (or draft) an SOA via HA native PDF — usable from staff API and cron.
 * Portal links / OneDrive archive are not wired in HA; includePortalLink is ignored.
 */
export async function issueSoaHeadlessForClient(
  accessToken: string,
  input: IssueSoaHeadlessInput
): Promise<IssueSoaHeadlessResult> {
  const clientCode = String(input.clientCode || "").trim().toUpperCase();
  if (!clientCode) {
    return { ok: false, message: "Client code is required." };
  }

  const client = await getClientDetail(accessToken, clientCode);
  if (!client) {
    return { ok: false, message: `Client ${clientCode} not found.` };
  }

  const email = client.email?.trim();
  if (!email && (input.deliveryAction || "Send Now") === "Send Now") {
    return {
      ok: false,
      message: `No contact email on ${clientCode} — add email on the matter before auto-sending SOA.`
    };
  }

  const priorCheck = await checkSoaDuplicateWarning(accessToken, clientCode, client.balance ?? 0);

  try {
    const result = await generateClientSoaNative(accessToken, {
      clientCode,
      preferredGreeting: input.preferredGreeting || client.preferredGreeting || "",
      deliveryAction: input.deliveryAction || "Send Now"
    });

    await handleSoaSentFollowUp(
      accessToken,
      clientCode,
      client.balance ?? 0,
      priorCheck,
      () => triggerTaskOnSoaSent(accessToken, clientCode)
    ).catch(() => null);

    return {
      ok: true,
      message: result.message || `SOA ready for ${clientCode}.`,
      invoiceNumber: result.invoiceNumber || undefined
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "SOA generation failed."
    };
  }
}
