import { NextResponse } from "next/server";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import { getClientActivity } from "@/lib/sheets/activity";
import { getClientDetail } from "@/lib/sheets/master";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const accessToken = await requireSessionAccessToken();
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const detail = await getClientDetail(accessToken, clientCode);

    if (!detail) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const activity = await getClientActivity(accessToken, clientCode, detail);
    return NextResponse.json({ activity });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load activity.";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
