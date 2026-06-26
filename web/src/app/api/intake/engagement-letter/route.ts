import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireBillingAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import {
  buildEngagementEmailPreview,
  buildEngagementLetterHtml,
  buildEngagementLetterPdf,
  engagementLetterFilename,
  type EngagementLetterInput
} from "@/lib/engagement-letter";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import {
  getGmailAccountEmail,
  sendHtmlEmailWithAttachmentsViaGmail,
  sentMailHint
} from "@/lib/office-tasks/gmail-send";

type Body = {
  action?: "preview" | "pdf" | "send" | "draft";
  letter?: EngagementLetterInput;
  recipientEmail?: string;
};

function validateLetter(letter: EngagementLetterInput | undefined): EngagementLetterInput {
  if (!letter?.clientName?.trim()) throw new Error("Client name is required.");
  if (!letter?.caseTitle?.trim()) throw new Error("Case title is required.");
  return {
    ...letter,
    clientName: letter.clientName.trim(),
    clientCode: letter.clientCode?.trim() || "",
    caseTitle: letter.caseTitle.trim(),
    clientAddress: letter.clientAddress?.trim() || "",
    handlingAttorney: letter.handlingAttorney?.trim() || "",
    scopeOfWork: letter.scopeOfWork?.trim() || "",
    feeAmount: letter.feeAmount?.trim() || "",
    appearanceFeeAmount: letter.appearanceFeeAmount?.trim() || "",
    successFeeEnabled: Boolean(letter.successFeeEnabled),
    successFeeAmount: letter.successFeeEnabled ? letter.successFeeAmount?.trim() || "" : "",
    feeNotes: letter.feeNotes?.trim() || "",
    preferredGreeting: letter.preferredGreeting?.trim() || "",
    effectiveDate: letter.effectiveDate || new Date().toISOString().slice(0, 10),
    documentType: letter.documentType === "contract" ? "contract" : "engagement",
    feeType:
      letter.feeType === "hourly" ||
      letter.feeType === "flat" ||
      letter.feeType === "acceptance"
        ? letter.feeType
        : "retainer"
  };
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();
    const session = await getServerSession(authOptions);
    const body = (await request.json()) as Body;
    const action = body.action || "preview";
    const letter = validateLetter(body.letter);

    if (action === "preview") {
      return NextResponse.json({
        html: buildEngagementLetterHtml(letter),
        email: buildEngagementEmailPreview(letter),
        filename: engagementLetterFilename(letter)
      });
    }

    const pdfBytes = await buildEngagementLetterPdf(letter);
    const filename = engagementLetterFilename(letter);

    if (action === "pdf") {
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      });
    }

    const recipient = (body.recipientEmail || letter.contactEmail || "").trim();
    if (!recipient) {
      return NextResponse.json({ error: "Client email is required to send the engagement letter." }, { status: 400 });
    }

    const email = buildEngagementEmailPreview(letter);
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
      action: action === "draft" ? "engagement-letter.draft" : "engagement-letter.send",
      clientCode: letter.clientCode || undefined,
      summary: action === "draft" ? "Engagement letter Gmail draft created" : "Engagement letter sent",
      details: `${filename} → ${recipient}`
    });

    const message =
      action === "draft"
        ? `Gmail draft saved with ${filename} attached. Open Gmail → Drafts to review before sending.`
        : sentMailHint(delivery.senderEmail, recipient, delivery.messageId, true);

    return NextResponse.json({ ok: true, message, filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Engagement letter action failed.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
