import { NextResponse } from "next/server";
import { triggerTaskOnArSent, triggerTaskOnSoaSent } from "@/lib/billing-task-triggers";
import { callAppsScriptWebApp } from "@/lib/apps-script";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { sanitizeSheetName, type BatchSoaPayload, type GenerateArPayload, type GenerateSoaPayload } from "@/lib/gl-config";
import { generateClientArReceiptNative } from "@/lib/sheets/client-ar-receipt";
import { generateClientSoaNative } from "@/lib/sheets/client-soa-receipt";
import { getClientDetail } from "@/lib/sheets/master";
import { checkSoaDuplicateWarning, handleSoaSentFollowUp } from "@/lib/soa-follow-up";

export async function POST(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();

    const body = await request.json();
    const action = String(body.action || "");
    const clientCode = sanitizeSheetName(String(body.clientCode || ""));

    if (!clientCode && action !== "refreshDashboard" && action !== "batchGenerateSOAHeadless" && action !== "setupAutoRefreshTrigger" && action !== "backupSpreadsheet") {
      return NextResponse.json({ error: "Client code is required." }, { status: 400 });
    }

    if (action === "generateSOAHeadless") {
      const payload = body as GenerateSoaPayload;
      const client = await getClientDetail(accessToken, clientCode);
      const priorCheck = await checkSoaDuplicateWarning(
        accessToken,
        clientCode,
        client?.balance ?? 0
      );

      const result = await generateClientSoaNative(accessToken, {
        ...payload,
        clientCode
      });

      const followUp = await handleSoaSentFollowUp(
        accessToken,
        clientCode,
        client?.balance ?? 0,
        priorCheck,
        () => triggerTaskOnSoaSent(accessToken, clientCode)
      ).catch(() => ({
        followUpsClosed: 0,
        followUpTaskCreated: false,
        note: null as string | null
      }));

      const baseMessage = String(result.message || "SOA completed.");
      const parts = [baseMessage];
      if (followUp.note) parts.push(followUp.note);
      if (followUp.followUpsClosed > 0) {
        parts.push(`Closed ${followUp.followUpsClosed} open SOA follow-up reminder(s).`);
      }

      return NextResponse.json({
        ...result,
        message: parts.join(" "),
        soaFollowUp: followUp
      });
    }

    if (action === "generateARHeadless") {
      const payload = body as GenerateArPayload;
      if (!payload.sheetRow) {
        return NextResponse.json({ error: "Payment row is required." }, { status: 400 });
      }
      const result = await generateClientArReceiptNative(accessToken, {
        ...payload,
        clientCode
      });
      if (result?.ok) await triggerTaskOnArSent(accessToken, clientCode).catch(() => null);
      return NextResponse.json(result);
    }

    if (action === "generateSOA") {
      const result = await callAppsScriptWebApp("generateSOA", { clientCode });
      return NextResponse.json(result);
    }

    if (action === "generateAR") {
      const result = await callAppsScriptWebApp("generateAR", { clientCode });
      return NextResponse.json(result);
    }

    if (action === "refreshDashboard") {
      const result = await callAppsScriptWebApp("refreshDashboard", {});
      return NextResponse.json(result);
    }

    if (action === "batchGenerateSOAHeadless") {
      const payload = body as BatchSoaPayload;
      if (!payload.clientCodes?.length) {
        return NextResponse.json({ error: "Select at least one client." }, { status: 400 });
      }
      const result = await callAppsScriptWebApp("batchGenerateSOAHeadless", {
        clientCodes: payload.clientCodes.map((c) => sanitizeSheetName(c)),
        deliveryAction: payload.deliveryAction || "Send Now"
      });
      return NextResponse.json(result);
    }

    if (action === "setupAutoRefreshTrigger") {
      const result = await callAppsScriptWebApp("setupAutoRefreshTrigger", {});
      return NextResponse.json(result);
    }

    if (action === "backupSpreadsheet") {
      const result = await callAppsScriptWebApp("backupSpreadsheet", {});
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document action failed.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
