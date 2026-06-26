import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { sanitizeSheetName } from "@/lib/gl-config";
import {
  birthdayGreetingSubject,
  buildBirthdayGreetingHtml,
  buildBirthdayGreetingPlain
} from "@/lib/birthday-greeting";
import { getClientDetail } from "@/lib/sheets/master";
import { sendBirthdayGreetingForClient } from "@/lib/sheets/birthday-greetings";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";

type RouteContext = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    const { code } = await context.params;
    const clientCode = sanitizeSheetName(decodeURIComponent(code));
    const body = (await request.json()) as { action?: "preview" | "send"; force?: boolean };
    const action = body.action || "preview";

    const client = await getClientDetail(accessToken, clientCode);
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const greetingInput = {
      clientName: client.name,
      preferredGreeting: client.preferredGreeting,
      caseTitle: client.caseTitle
    };

    if (action === "preview") {
      return NextResponse.json({
        subject: birthdayGreetingSubject(),
        html: buildBirthdayGreetingHtml(greetingInput),
        text: buildBirthdayGreetingPlain(greetingInput),
        recipient: client.email || ""
      });
    }

    const result = await sendBirthdayGreetingForClient(accessToken, {
      clientCode,
      fromEmail: session?.user?.email || undefined,
      actorEmail: session?.user?.email || "unknown",
      force: body.force === true
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Birthday greeting failed.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
