import { NextResponse } from "next/server";
import { requireAdminBillingAccessToken, requireBillingAccessToken } from "@/lib/api-auth";
import { DEFAULT_FIRM_ALERT_RULES } from "@/lib/firm-alert-rules";
import {
  getFirmAlertRules,
  readFirmAlertRulesFromSettings,
  saveFirmAlertRulesToSettings
} from "@/lib/firm-alert-rules-server";
import type { FirmAlertRules } from "@/lib/firm-alert-rules";

export async function GET() {
  try {
    const token = await requireBillingAccessToken();
    const rules = await readFirmAlertRulesFromSettings(token);
    return NextResponse.json({ rules, defaults: DEFAULT_FIRM_ALERT_RULES, env: getFirmAlertRules() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load alert rules.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const { token } = await requireAdminBillingAccessToken();
    const body = (await request.json()) as Partial<FirmAlertRules>;
    const rules = await saveFirmAlertRulesToSettings(token, body);
    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save alert rules.";
    const status = message === "Admin only." ? 403 : message.includes("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
