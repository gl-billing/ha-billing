import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminEmail } from "@/lib/admin";
import { canAccessBilling } from "@/lib/app-access";
import { requireBillingAccessToken } from "@/lib/api-auth";
import {
  FIRM_AUTOMATION_ENV_KEYS,
  FIRM_AUTOMATION_SETTING_KEYS,
  getFirmAutomationSettings,
  readFirmAutomationSettings,
  writeFirmAutomationSettings,
  type FirmAutomationSettingsPatch
} from "@/lib/firm-automation-settings";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

/** Staff-visible firm automation toggles (no secrets). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!canAccessBilling(email)) {
      return NextResponse.json({ error: "Billing access required." }, { status: 403 });
    }

    const accessToken = await requireBillingAccessToken();
    const settings = await readFirmAutomationSettings(accessToken);

    return NextResponse.json({
      settings,
      envKeys: FIRM_AUTOMATION_ENV_KEYS,
      settingKeys: FIRM_AUTOMATION_SETTING_KEYS,
      editable: true
    });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    return NextResponse.json({
      settings: getFirmAutomationSettings(),
      envKeys: FIRM_AUTOMATION_ENV_KEYS,
      settingKeys: FIRM_AUTOMATION_SETTING_KEYS,
      editable: false
    });
  }
}

/** Firm admin — persist automation toggles to this workspace’s Settings sheet. */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!canAccessBilling(email)) {
      return NextResponse.json({ error: "Billing access required." }, { status: 403 });
    }
    requireAdminEmail(email);

    const accessToken = await requireBillingAccessToken();
    const body = (await request.json()) as FirmAutomationSettingsPatch;
    const settings = await writeFirmAutomationSettings(accessToken, body);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Could not save automation settings.";
    const status =
      message.includes("admin") || message.includes("Unauthorized")
        ? 403
        : message.includes("must be")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
