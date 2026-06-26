import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import type { SpotBillingTransactionPayload } from "@/lib/gl-config";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import { isQuotaError, quotaErrorMessage } from "@/lib/sheets/cache";
import { getSpotBillingEntry } from "@/lib/sheets/spot-billing";
import {
  buildSpotBillingEmailPreview,
  buildSpotBillingLetterHtml,
  buildSpotBillingLetterPdf,
  spotBillingLetterFilename,
  spotBillingLetterKindForTransaction,
  type SpotBillingLetterInput,
  type SpotBillingLetterKind
} from "@/lib/spot-billing-letter";
import {
  getGmailAccountEmail,
  sendHtmlEmailWithAttachmentsViaGmail,
  sentMailHint
} from "@/lib/office-tasks/gmail-send";

type RouteContext = { params: Promise<{ id: string }> };

type Body = {
  action?: "preview" | "pdf" | "send" | "draft";
  kind?: SpotBillingLetterKind;
  transaction?: SpotBillingTransactionPayload;
  recipientEmail?: string;
  letterDate?: string;
};

function buildLetterInput(
  entry: Awaited<ReturnType<typeof getSpotBillingEntry>>,
  kind: SpotBillingLetterKind,
  transaction: SpotBillingTransactionPayload,
  letterDate?: string
): SpotBillingLetterInput {
  return {
    kind,
    entry,
    transaction,
    letterDate
  };
}

function resolveKind(body: Body, transaction: SpotBillingTransactionPayload): SpotBillingLetterKind {
  if (body.kind === "charge" || body.kind === "payment") return body.kind;
  const inferred = spotBillingLetterKindForTransaction(transaction);
  if (!inferred) throw new Error("Letter kind could not be determined from the transaction.");
  return inferred;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    const { id } = await context.params;
    const body = (await request.json()) as Body;
    const action = body.action || "preview";

    if (!body.transaction) {
      return NextResponse.json({ error: "Transaction details are required." }, { status: 400 });
    }

    const entry = await getSpotBillingEntry(accessToken, id);
    const kind = resolveKind(body, body.transaction);
    const letterInput = buildLetterInput(entry, kind, body.transaction, body.letterDate?.trim());

    if (action === "preview") {
      return NextResponse.json({
        html: buildSpotBillingLetterHtml(letterInput),
        email: buildSpotBillingEmailPreview(letterInput),
        filename: spotBillingLetterFilename(letterInput)
      });
    }

    const pdfBytes = await buildSpotBillingLetterPdf(letterInput);
    const filename = spotBillingLetterFilename(letterInput);

    if (action === "pdf") {
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      });
    }

    const recipient = (body.recipientEmail || entry.email || "").trim();
    if (!recipient) {
      return NextResponse.json({ error: "Payer email is required to send on letterhead." }, { status: 400 });
    }

    const email = buildSpotBillingEmailPreview(letterInput);
    const bccEmail = await getGmailAccountEmail(accessToken, session?.user?.email || undefined);
    const delivery = await sendHtmlEmailWithAttachmentsViaGmail({
      accessToken,
      to: recipient,
      subject: email.subject,
      html: email.html,
      plain: email.body,
      bcc: bccEmail,
      attachments: [{ filename, mimeType: "application/pdf", content: pdfBytes }],
      mode: action === "draft" ? "draft" : "send"
    });

    await appendAuditLog(accessToken, {
      user: session?.user?.email || "unknown",
      action: action === "draft" ? "spot-billing.letter.draft" : "spot-billing.letter.send",
      clientCode: entry.spotId,
      summary: kind === "charge" ? "Spot billing charge notice sent" : "Spot billing payment receipt sent",
      details: `${filename} → ${recipient}`
    }).catch(() => undefined);

    const message =
      action === "draft"
        ? `Gmail draft saved with ${filename} attached. Open Gmail → Drafts to review before sending.`
        : sentMailHint(delivery.senderEmail, recipient, delivery.messageId, true);

    return NextResponse.json({ ok: true, message, filename });
  } catch (error) {
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage() }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Spot billing letter action failed.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
