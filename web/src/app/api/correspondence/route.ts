import { NextResponse } from "next/server";
import { requireBillingAccessToken, sessionAuditEmail } from "@/lib/api-auth";
import {
  buildCorrespondenceEmailPreview,
  buildCorrespondenceLetterHtml,
  buildCorrespondenceLetterPdf,
  correspondenceLetterFilename,
  type CorrespondenceKind,
  type CorrespondenceLetterInput
} from "@/lib/firm-correspondence";
import { inlineLetterHtmlAssets } from "@/lib/html-letter-pdf";
import { appendAuditLog } from "@/lib/sheets/audit-log";
import {
  getGmailAccountEmail,
  sendHtmlEmailWithAttachmentsViaGmail,
  sentMailHint
} from "@/lib/office-tasks/gmail-send";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  action?: "preview" | "pdf" | "send" | "draft";
  letter?: CorrespondenceLetterInput;
  recipientEmail?: string;
};

const CORRESPONDENCE_KINDS: CorrespondenceKind[] = ["demand", "proposal", "reply", "request", "general", "other"];

function validateLetter(letter: CorrespondenceLetterInput | undefined): CorrespondenceLetterInput {
  if (!letter?.recipientName?.trim()) throw new Error("Recipient name is required.");
  if (!letter?.body?.trim()) throw new Error("Letter body is required.");
  if (!letter?.signatoryName?.trim()) throw new Error("Signatory name is required.");

  return {
    ...letter,
    kind: CORRESPONDENCE_KINDS.includes(letter.kind) ? letter.kind : "general",
    documentTitle: letter.documentTitle?.trim() || "",
    recipientName: letter.recipientName.trim(),
    recipientAddress: letter.recipientAddress?.trim() || "",
    recipientEmail: letter.recipientEmail?.trim() || "",
    subjectLine: letter.subjectLine?.trim() || "",
    salutation: letter.salutation?.trim() || "",
    body: letter.body.trim(),
    closing: letter.closing?.trim() || "",
    signatoryName: letter.signatoryName.trim(),
    signatoryTitle: letter.signatoryTitle?.trim() || "",
    matterReference: letter.matterReference?.trim() || "",
    clientCode: letter.clientCode?.trim() || "",
    letterDate: letter.letterDate || new Date().toISOString().slice(0, 10),
    pageSize: letter.pageSize === "letter" || letter.pageSize === "a4" ? letter.pageSize : "legal"
  };
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireBillingAccessToken();

    const body = (await request.json()) as Body;
    const action = body.action || "preview";
    const letter = validateLetter(body.letter);

    if (action === "preview") {
      return NextResponse.json({
        html: inlineLetterHtmlAssets(buildCorrespondenceLetterHtml(letter)),
        email: buildCorrespondenceEmailPreview(letter),
        filename: correspondenceLetterFilename(letter)
      });
    }

    const pdfBytes = await buildCorrespondenceLetterPdf(letter);
    const filename = correspondenceLetterFilename(letter);

    if (action === "pdf") {
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      });
    }

    const recipient = (body.recipientEmail || letter.recipientEmail || "").trim();
    if (!recipient) {
      return NextResponse.json({ error: "Recipient email is required to send the letter." }, { status: 400 });
    }

    const emailPreview = buildCorrespondenceEmailPreview(letter);
    const auditEmail = await sessionAuditEmail();
    const bccEmail = await getGmailAccountEmail(accessToken, auditEmail === "unknown" ? undefined : auditEmail);
    const delivery = await sendHtmlEmailWithAttachmentsViaGmail({
      accessToken,
      to: recipient,
      subject: emailPreview.subject,
      html: emailPreview.html,
      plain: emailPreview.body,
      bcc: bccEmail,
      attachments: [{ filename, mimeType: "application/pdf", content: pdfBytes }],
      mode: action === "draft" ? "draft" : "send"
    });

    await appendAuditLog(accessToken, {
      user: auditEmail,
      action: action === "draft" ? "correspondence.draft" : "correspondence.send",
      clientCode: letter.clientCode || undefined,
      summary: action === "draft" ? "Correspondence Gmail draft created" : "Correspondence letter sent",
      details: `${filename} → ${recipient}`
    });

    const message =
      action === "draft"
        ? `Gmail draft saved with ${filename} attached. Open Gmail → Drafts to review before sending.`
        : sentMailHint(delivery.senderEmail, recipient, delivery.messageId, true);

    return NextResponse.json({ ok: true, message, filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Correspondence action failed.";
    const status = message.startsWith("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
