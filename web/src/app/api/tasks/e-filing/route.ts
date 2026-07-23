import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { canAccessTasks } from "@/lib/app-access";
import { authOptions } from "@/lib/auth";
import { FIRM_EMAIL } from "@/lib/billing-document-design";
import {
  buildCivilEFilingFilename,
  buildCivilEFilingHtmlBody,
  buildCivilEFilingPlainBody,
  buildCivilEFilingSubject,
  buildFilingPartyName,
  defaultCivilEFilingContactNumbers,
  isInitiatoryPleading,
  normalizeCivilEFilingManner,
  resolveCivilEFilingAnnexStyle,
  type CivilEFilingAttachmentSpec,
  type CivilEFilingInput
} from "@/lib/civil-e-filing";
import { resolveClientCode } from "@/lib/office-tasks/client-matter";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  getGmailAccountEmail,
  sendHtmlEmailWithAttachmentsViaGmail,
  sentMailHint,
  type GmailAttachment
} from "@/lib/office-tasks/gmail-send";
import { appendTaskActivity } from "@/lib/office-tasks/sheets/activity-log";
import {
  parseOfficeItemMutationInput,
  resolveOfficeItemForMutation
} from "@/lib/office-tasks/sheets/resolve-item-row";
import { getClientDetail } from "@/lib/sheets/master";
import { appendAuditLog } from "@/lib/sheets/audit-log";

export const runtime = "nodejs";
export const maxDuration = 60;

type PreviewBody = {
  action?: "preview";
  source?: string;
  rowNumber?: number;
  itemId?: string;
  id?: string;
  overrides?: Partial<{
    docketNumber: string;
    caseTitle: string;
    pleadingDesignation: string;
    courtPending: string;
    filingPartyName: string;
    contactNumbers: string;
    otherEmail: string;
    primaryManner: string;
    filingDate: string;
    courtEmail: string;
    opposingCounselEmail: string;
    attachmentTitles: string[];
    attachmentSpecs: CivilEFilingAttachmentSpec[];
  }>;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseAttachmentSpecs(
  specs: CivilEFilingAttachmentSpec[] | undefined,
  titles: string[] | undefined,
  pleading: string
): CivilEFilingAttachmentSpec[] {
  if (Array.isArray(specs) && specs.length) {
    return specs
      .map((spec) => ({
        title: String(spec.title || "").trim(),
        annex: spec.annex?.trim() || undefined,
        annexTitles: spec.annexTitles
      }))
      .filter((spec) => spec.title || spec.annex);
  }
  const cleaned = (titles || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!cleaned.length) {
    return pleading ? [{ title: pleading }] : [];
  }
  return cleaned.map((title) => {
    const annexMatch = title.match(/^annex\s+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)?)[\s.:-]*(.*)$/i);
    if (annexMatch) {
      return {
        title: annexMatch[2]?.trim() || title,
        annex: annexMatch[1]
      };
    }
    return { title };
  });
}

async function resolveEFilingContext(
  token: string,
  body: PreviewBody
): Promise<{
  item: OfficeItem;
  input: CivilEFilingInput;
  courtEmail: string;
  opposingCounselEmail: string;
  initiatory: boolean;
  clientCode: string | null;
  caseRole: string;
}> {
  const parsed = parseOfficeItemMutationInput(body, { eventOnly: true });
  if ("error" in parsed) {
    throw new Error(parsed.error);
  }

  const target = await resolveOfficeItemForMutation(token, parsed.source, {
    itemId: parsed.itemId,
    rowNumber: parsed.rowNumber
  });
  if (!target?.item || target.item.source !== "Event") {
    throw new Error("Could not find this filing event.");
  }

  const item = target.item;
  const clientCode = resolveClientCode(item);
  const client = clientCode ? await getClientDetail(token, clientCode) : null;
  const o = body.overrides || {};

  const pleadingDesignation =
    o.pleadingDesignation?.trim() || item.category?.trim() || "Court submission";
  const docketNumber = o.docketNumber?.trim() || client?.caseNumber?.trim() || "";
  const caseTitle = o.caseTitle?.trim() || client?.caseTitle?.trim() || item.clientCase?.trim() || "";
  const courtPending = o.courtPending?.trim() || client?.courtPending?.trim() || item.venue?.trim() || "";
  const filingPartyName =
    o.filingPartyName?.trim() ||
    buildFilingPartyName({
      caseRole: client?.caseRole,
      clientName: client?.name
    });
  const initiatory = isInitiatoryPleading(item.pleadingType);
  const caseRole = String(client?.caseRole || "").trim();
  const attachments = parseAttachmentSpecs(o.attachmentSpecs, o.attachmentTitles, pleadingDesignation);

  const input: CivilEFilingInput = {
    docketNumber,
    caseTitle,
    pleadingDesignation,
    courtPending,
    filingPartyName,
    contactNumbers: o.contactNumbers?.trim() || defaultCivilEFilingContactNumbers(),
    otherEmail: o.otherEmail?.trim() || FIRM_EMAIL,
    primaryManner: normalizeCivilEFilingManner(o.primaryManner || item.filingMode),
    filingDate: o.filingDate?.trim() || item.filingDate || item.filingDeadline || todayYmd(),
    attachments
  };

  return {
    item,
    input,
    courtEmail: o.courtEmail?.trim() || "",
    opposingCounselEmail: o.opposingCounselEmail?.trim() || "",
    initiatory,
    clientCode,
    caseRole
  };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !canAccessTasks(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    if (!isMultipart) {
      const body = (await request.json()) as PreviewBody;
      const action = body.action || "preview";
      if (action !== "preview") {
        return NextResponse.json({ error: "Use multipart form data to send." }, { status: 400 });
      }

      const accessToken = await requireSessionAccessToken();
      const ctx = await resolveEFilingContext(accessToken, body);
      const subject = buildCivilEFilingSubject(ctx.input);
      const plain = buildCivilEFilingPlainBody(ctx.input);
      const html = buildCivilEFilingHtmlBody(ctx.input);
      const filenames = ctx.input.attachments.map((spec) =>
        buildCivilEFilingFilename(spec, ctx.input.docketNumber, ctx.input.pleadingDesignation)
      );

      return NextResponse.json({
        subject,
        plain,
        html,
        to: ctx.courtEmail,
        cc: ctx.initiatory ? "" : ctx.opposingCounselEmail,
        initiatory: ctx.initiatory,
        initiatoryHint: ctx.initiatory
          ? "Initiatory pleading: email the court within 24 hours after personal filing (court only — no OC CC)."
          : "Subsequent pleading: email the court and CC opposing counsel.",
        filingPartyName: ctx.input.filingPartyName,
        docketNumber: ctx.input.docketNumber,
        caseTitle: ctx.input.caseTitle,
        pleadingDesignation: ctx.input.pleadingDesignation,
        courtPending: ctx.input.courtPending,
        primaryManner: ctx.input.primaryManner,
        filingDate: ctx.input.filingDate,
        contactNumbers: ctx.input.contactNumbers,
        otherEmail: ctx.input.otherEmail,
        courtEmail: ctx.courtEmail,
        opposingCounselEmail: ctx.opposingCounselEmail,
        attachmentTitles: ctx.input.attachments.map((a) =>
          a.annex ? `Annex ${a.annex}${a.title ? ` - ${a.title}` : ""}` : a.title
        ),
        suggestedFilenames: filenames,
        caseRole: ctx.caseRole,
        annexStyle: resolveCivilEFilingAnnexStyle(ctx.caseRole),
        clientCode: ctx.clientCode,
        itemId: ctx.item.id,
        pleadingType: ctx.item.pleadingType,
        filingMode: ctx.item.filingMode
      });
    }

    const form = await request.formData();
    const action = String(form.get("action") || "send");
    if (action !== "send" && action !== "draft") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const accessToken = await requireSessionAccessToken();
    const metaRaw = String(form.get("meta") || "");
    let meta: PreviewBody & {
      subject?: string;
      plain?: string;
      to?: string;
      cc?: string;
    };
    try {
      meta = JSON.parse(metaRaw) as typeof meta;
    } catch {
      return NextResponse.json({ error: "Invalid e-filing metadata." }, { status: 400 });
    }

    const ctx = await resolveEFilingContext(accessToken, meta);
    const to = String(meta.to || ctx.courtEmail).trim();
    if (!to) {
      return NextResponse.json(
        { error: "Court email is required. Add it on the matter (Client details) or enter it here." },
        { status: 400 }
      );
    }

    const initiatory = ctx.initiatory;
    const cc = initiatory ? "" : String(meta.cc || ctx.opposingCounselEmail).trim();
    if (!initiatory && !cc) {
      return NextResponse.json(
        {
          error:
            "Opposing counsel email is required for subsequent pleadings. Add it on the matter or enter CC here."
        },
        { status: 400 }
      );
    }

    const subject = String(meta.subject || buildCivilEFilingSubject(ctx.input)).trim();
    const plain = String(meta.plain || buildCivilEFilingPlainBody(ctx.input));
    const html = buildCivilEFilingHtmlBody({
      ...ctx.input,
      // Prefer the edited plain body narrative; rebuild HTML from plain by wrapping
    });
    // If the user edited the plain body in the dialog, use that for both.
    const htmlBody = meta.plain?.trim()
      ? `<div style="font-family: Georgia, 'Times New Roman', serif; font-size: 14px; line-height: 1.55; color: #1a1a1a; white-space: pre-wrap;">${plain
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</div>`
      : html;

    const files = form.getAll("files").filter((f): f is File => typeof f !== "string" && Boolean(f));
    if (!files.length) {
      return NextResponse.json({ error: "Attach at least one PDF." }, { status: 400 });
    }

    const filenameHints = (() => {
      try {
        return JSON.parse(String(form.get("filenames") || "[]")) as string[];
      } catch {
        return [] as string[];
      }
    })();

    const attachments: GmailAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const bytes = new Uint8Array(await file.arrayBuffer());
      const spec = ctx.input.attachments[i] || { title: ctx.input.pleadingDesignation };
      const filename =
        filenameHints[i]?.trim() ||
        buildCivilEFilingFilename(spec, ctx.input.docketNumber, ctx.input.pleadingDesignation);
      attachments.push({
        filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
        mimeType: file.type || "application/pdf",
        content: bytes
      });
    }

    const result = await sendHtmlEmailWithAttachmentsViaGmail({
      accessToken,
      to,
      subject,
      html: htmlBody,
      plain,
      attachments,
      mode: action === "draft" ? "draft" : "send"
    });

    const gmailAccount = await getGmailAccountEmail(accessToken).catch(() => null);
    const hint = sentMailHint(
      result.senderEmail || gmailAccount || "Gmail",
      to,
      result.messageId,
      Boolean(cc)
    );

    await appendTaskActivity(accessToken, {
      user: session.user.email || session.user.name || "staff",
      action: action === "draft" ? "e-filing.draft" : "e-filing.sent",
      source: "Event",
      itemId: ctx.item.id,
      clientCase: ctx.item.clientCase,
      summary:
        action === "draft"
          ? `E-filing draft: ${subject}`
          : `E-filing sent to court${cc ? " (OC CC)" : ""}: ${subject}`
    });

    await appendAuditLog(accessToken, {
      user: session.user.email || "unknown",
      action: action === "draft" ? "e-filing.draft" : "e-filing.sent",
      clientCode: ctx.clientCode || "",
      summary: subject,
      details: `to=${to}${cc ? `; cc=${cc}` : ""}; files=${attachments.map((a) => a.filename).join(", ")}`
    });

    return NextResponse.json({
      ok: true,
      message:
        action === "draft"
          ? `Draft saved in Gmail. ${hint}`
          : `E-filing email sent. ${hint}`,
      messageId: result.messageId,
      filenames: attachments.map((a) => a.filename)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "E-filing failed.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("permission")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
