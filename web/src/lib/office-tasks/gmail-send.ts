import { google } from "googleapis";
import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { EMAIL_SIGNATURE_BANNER_CID, ensureClientEmailHtml, ensureClientEmailPlain } from "@/lib/firm-email-signature";
import { inlineFirmLogoInEmailHtml } from "@/lib/firm-print-brand";
import { formatFirmOutboundFrom, resolveFirmSenderEmail } from "@/lib/firm-sender";
import { loadEmailSignatureBanner } from "@/lib/drive-email-signature-banner";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

export type GmailAttachment = {
  filename: string;
  mimeType: string;
  content: Uint8Array | Buffer;
};

export type GmailInlineImage = {
  contentId: string;
  filename: string;
  mimeType: string;
  content: Uint8Array | Buffer;
};

export type GmailSendResult = {
  messageId: string;
  threadId?: string;
  senderEmail: string;
};

export function normalizeEmailAddress(raw: string): string {
  const trimmed = String(raw || "").trim();
  const angle = trimmed.match(/<([^>]+)>/);
  const email = (angle ? angle[1] : trimmed).trim();
  return email.toLowerCase();
}

export function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function accessTokenHasGmailSend(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { scope?: string; error?: string };
    if (data.error) return false;
    const scopes = String(data.scope || "").split(/\s+/);
    return scopes.includes(GMAIL_SEND_SCOPE);
  } catch {
    return false;
  }
}

export function gmailPermissionHelp(): string {
  return "Gmail send permission is missing on your sign-in. Sign out completely, open the app in a private/incognito window, sign in again, and approve “Send email on your behalf”.";
}

function extractGmailError(error: unknown): string {
  if (error && typeof error === "object") {
    const gaxios = error as {
      message?: string;
      response?: { data?: { error?: { message?: string; errors?: Array<{ message?: string }> } } };
    };
    const apiMsg = gaxios.response?.data?.error?.message;
    if (apiMsg) return apiMsg;
    const nested = gaxios.response?.data?.error?.errors?.[0]?.message;
    if (nested) return nested;
    if (gaxios.message) return gaxios.message;
  }
  return error instanceof Error ? error.message : "Gmail send failed.";
}

function encodeSubject(subject: string): string {
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function gmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

async function getEmailFromGoogleUserInfo(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    const address = normalizeEmailAddress(data.email || "");
    return isValidEmailAddress(address) ? address : null;
  } catch {
    return null;
  }
}

/** Google account signed in to the app (used for BCC copies and Sent-folder checks). */
export async function getGmailAccountEmail(
  accessToken: string,
  fallbackEmail?: string
): Promise<string> {
  try {
    const gmail = gmailClient(accessToken);
    const profile = await gmail.users.getProfile({ userId: "me" });
    const address = normalizeEmailAddress(profile.data.emailAddress || "");
    if (isValidEmailAddress(address)) return address;
  } catch {
    // gmail.send alone cannot read profile — fall back to signed-in email.
  }

  const fallback = normalizeEmailAddress(fallbackEmail || "");
  if (isValidEmailAddress(fallback)) return fallback;

  const fromUserInfo = await getEmailFromGoogleUserInfo(accessToken);
  if (fromUserInfo) return fromUserInfo;

  throw new Error(
    "Could not read your Gmail account. Sign out, sign in again, and approve Gmail send permission."
  );
}

/** Firm outbound address shown to recipients (always legal@ / firm inbox). */
export async function getGmailSenderAddress(
  _accessToken: string,
  _fallbackEmail?: string
): Promise<string> {
  return resolveFirmSenderEmail();
}

function firmSendAsHelp(): string {
  const firm = resolveFirmSenderEmail();
  return (
    `Outbound mail must show as ${firm}. ` +
    `Set CRON_GOOGLE_REFRESH_TOKEN on the server for the legal@ Gmail mailbox (recommended), ` +
    `or sign in as ${firm}, or add ${firm} under Gmail → Settings → Accounts → Send mail as on the account you use in this app.`
  );
}

/**
 * Prefer the legal@ mailbox token so Sent + From are the office address (GL-style firm sender).
 * Falls back to the caller's token only when that mailbox is legal@ or has Send-as for legal@.
 */
export async function resolveFirmOutboundAccessToken(preferredToken: string): Promise<{
  accessToken: string;
  mailbox: string;
  via: "cron" | "session";
}> {
  const firm = normalizeEmailAddress(resolveFirmSenderEmail());

  const cronToken = await getCronGoogleAccessToken().catch(() => null);
  if (cronToken) {
    const cronMailbox = await getGmailAccountEmail(cronToken).catch(() => "");
    if (normalizeEmailAddress(cronMailbox) === firm) {
      return { accessToken: cronToken, mailbox: firm, via: "cron" };
    }
  }

  const sessionMailbox = await getGmailAccountEmail(preferredToken).catch(() => "");
  if (normalizeEmailAddress(sessionMailbox) === firm) {
    return { accessToken: preferredToken, mailbox: firm, via: "session" };
  }

  // Personal staff token: only OK if Gmail Send-as includes the firm inbox.
  const aliases = await listSendAsEmails(preferredToken);
  if (aliases.includes(firm)) {
    return {
      accessToken: preferredToken,
      mailbox: normalizeEmailAddress(sessionMailbox) || firm,
      via: "session"
    };
  }

  throw new Error(firmSendAsHelp());
}

async function listSendAsEmails(accessToken: string): Promise<string[]> {
  try {
    const gmail = gmailClient(accessToken);
    const res = await gmail.users.settings.sendAs.list({ userId: "me" });
    return (res.data.sendAs || [])
      .map((row) => normalizeEmailAddress(row.sendAsEmail || ""))
      .filter(isValidEmailAddress);
  } catch {
    return [];
  }
}

function buildHtmlMimePart(html: string, inlineImages?: GmailInlineImage[]): string {
  if (!inlineImages?.length) {
    return ['Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: 7bit", "", html].join("\r\n");
  }

  const relatedBoundary = `gl_rel_${Date.now().toString(36)}`;
  const htmlPartId = "gl_html_part";
  const lines = [
    `Content-Type: multipart/related; boundary="${relatedBoundary}"; type="text/html"; start="<${htmlPartId}>"`,
    "",
    `--${relatedBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    `Content-ID: <${htmlPartId}>`,
    "",
    html
  ];

  for (const image of inlineImages) {
    const content = Buffer.from(image.content);
    lines.push(
      `--${relatedBoundary}`,
      `Content-Type: ${image.mimeType}`,
      "Content-Transfer-Encoding: base64",
      "Content-Disposition: inline",
      `Content-ID: <${image.contentId}>`,
      `X-Attachment-Id: ${image.contentId}`,
      "",
      content.toString("base64")
    );
  }

  lines.push(`--${relatedBoundary}--`);
  return lines.join("\r\n");
}

function buildAlternativeMimeBody(
  alternativeBoundary: string,
  input: {
    plain: string;
    html: string;
    inlineImages?: GmailInlineImage[];
  }
): string {
  return [
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    input.plain,
    `--${alternativeBoundary}`,
    buildHtmlMimePart(input.html, input.inlineImages),
    `--${alternativeBoundary}--`
  ].join("\r\n");
}

function buildRawMime(input: {
  from: string;
  to: string;
  subject: string;
  html: string;
  plain: string;
  bcc?: string;
  attachments?: GmailAttachment[];
  inlineImages?: GmailInlineImage[];
}): string {
  const alternativeBoundary = `gl_alt_${Date.now().toString(36)}`;
  const alternativeBody = buildAlternativeMimeBody(alternativeBoundary, {
    plain: input.plain,
    html: input.html,
    inlineImages: input.inlineImages
  });

  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    ...(input.bcc && input.bcc !== input.to ? [`Bcc: ${input.bcc}`] : []),
    `Subject: ${encodeSubject(input.subject)}`,
    "MIME-Version: 1.0"
  ];

  if (!input.attachments?.length) {
    return [...headers, `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`, "", alternativeBody].join(
      "\r\n"
    );
  }

  const boundary = `gl_${Date.now().toString(36)}`;
  const lines = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    alternativeBody
  ];

  for (const attachment of input.attachments) {
    const content = Buffer.from(attachment.content);
    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      content.toString("base64")
    );
  }

  lines.push(`--${boundary}--`);
  return lines.join("\r\n");
}

async function deliverMimeMessage(
  accessToken: string,
  mime: string,
  mode: "send" | "draft"
): Promise<GmailSendResult> {
  const raw = Buffer.from(mime, "utf8").toString("base64url");
  const gmail = gmailClient(accessToken);

  try {
    if (mode === "draft") {
      const response = await gmail.users.drafts.create({
        userId: "me",
        requestBody: { message: { raw } }
      });
      const messageId = response.data.message?.id;
      if (!messageId) {
        throw new Error("Gmail did not return a draft message ID.");
      }
      return {
        messageId,
        threadId: response.data.message?.threadId || undefined,
        senderEmail: ""
      };
    }

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw }
    });

    const messageId = response.data.id;
    if (!messageId) {
      throw new Error("Gmail did not return a message ID — the email may not have been queued.");
    }

    return {
      messageId,
      threadId: response.data.threadId || undefined,
      senderEmail: ""
    };
  } catch (error) {
    const msg = extractGmailError(error);
    if (/insufficient|permission|scope|403|unauthorized|invalid_grant/i.test(msg)) {
      throw new Error(
        mode === "draft"
          ? "Gmail draft permission is missing. Sign out, sign in again, and approve Gmail compose access."
          : gmailPermissionHelp()
      );
    }
    throw new Error(`Gmail could not ${mode === "draft" ? "save draft" : "send"}: ${msg}`);
  }
}

export async function sendHtmlEmailViaGmail(input: {
  accessToken: string;
  fromEmail?: string;
  to: string;
  subject: string;
  html: string;
  plain?: string;
  /** Sends a copy to this address (usually the admin). */
  bcc?: string;
  inlineImages?: GmailInlineImage[];
}): Promise<GmailSendResult> {
  const to = normalizeEmailAddress(input.to);
  if (!isValidEmailAddress(to)) {
    throw new Error(`Invalid recipient email: ${input.to}`);
  }

  const { accessToken, mailbox } = await resolveFirmOutboundAccessToken(input.accessToken);

  const hasScope = await accessTokenHasGmailSend(accessToken);
  if (!hasScope) {
    throw new Error(gmailPermissionHelp());
  }

  const senderEmail = resolveFirmSenderEmail();
  const fromAddress = formatFirmOutboundFrom();
  const bcc = input.bcc ? normalizeEmailAddress(input.bcc) : undefined;
  if (bcc && !isValidEmailAddress(bcc)) {
    throw new Error(`Invalid BCC email: ${input.bcc}`);
  }

  const html = input.html;
  const plain =
    input.plain?.trim() ||
    html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const mime = buildRawMime({
    from: fromAddress,
    to,
    subject: input.subject,
    html,
    plain,
    bcc,
    inlineImages: input.inlineImages
  });

  try {
    const delivery = await deliverMimeMessage(accessToken, mime, "send");
    return {
      ...delivery,
      // Always report the firm From — not the OAuth actor mailbox.
      senderEmail: senderEmail || mailbox
    };
  } catch (error) {
    const msg = extractGmailError(error);
    if (/invalid from|not authorized to send|send as|from address|invalid argument:\s*[^\s]+@/i.test(msg)) {
      throw new Error(firmSendAsHelp());
    }
    if (error instanceof Error && error.message.includes("Gmail could not send")) {
      throw new Error(`Gmail could not send to ${to}: ${error.message.replace(/^Gmail could not send: /, "")}`);
    }
    throw error;
  }
}

function mergeInlineEmailImages(...groups: Array<GmailInlineImage[] | undefined>): GmailInlineImage[] | undefined {
  const merged = groups.flatMap((group) => group || []);
  return merged.length ? merged : undefined;
}

/** Client-facing email — firm logo + signature banner embedded inline so they always display. */
export async function sendClientEmailViaGmail(input: {
  accessToken: string;
  fromEmail?: string;
  to: string;
  subject: string;
  html: string;
  plain: string;
  bcc?: string;
}): Promise<GmailSendResult> {
  const { accessToken } = await resolveFirmOutboundAccessToken(input.accessToken);
  const banner = await loadEmailSignatureBanner(accessToken);
  const bannerSrc = banner ? `cid:${EMAIL_SIGNATURE_BANNER_CID}` : null;
  const { html: htmlWithLogo, logoInline } = inlineFirmLogoInEmailHtml(input.html);

  return sendHtmlEmailViaGmail({
    ...input,
    accessToken,
    html: ensureClientEmailHtml(htmlWithLogo, { bannerSrc }),
    plain: ensureClientEmailPlain(input.plain, { reswapSignature: Boolean(banner) }),
    inlineImages: mergeInlineEmailImages(logoInline ? [logoInline] : undefined, banner ? [banner] : undefined)
  });
}

export async function sendHtmlEmailWithAttachmentsViaGmail(input: {
  accessToken: string;
  fromEmail?: string;
  to: string;
  subject: string;
  html: string;
  plain?: string;
  bcc?: string;
  attachments: GmailAttachment[];
  mode?: "send" | "draft";
}): Promise<GmailSendResult> {
  const to = normalizeEmailAddress(input.to);
  if (!isValidEmailAddress(to)) {
    throw new Error(`Invalid recipient email: ${input.to}`);
  }

  const mode = input.mode || "send";
  const accessToken =
    mode === "send"
      ? (await resolveFirmOutboundAccessToken(input.accessToken)).accessToken
      : input.accessToken;

  if (mode === "send") {
    const hasScope = await accessTokenHasGmailSend(accessToken);
    if (!hasScope) throw new Error(gmailPermissionHelp());
  }

  const senderEmail = resolveFirmSenderEmail();
  const fromAddress = formatFirmOutboundFrom();
  const bcc = input.bcc ? normalizeEmailAddress(input.bcc) : undefined;
  if (bcc && !isValidEmailAddress(bcc)) {
    throw new Error(`Invalid BCC email: ${input.bcc}`);
  }

  const banner = mode === "send" ? await loadEmailSignatureBanner(accessToken) : null;
  const bannerSrc = banner ? `cid:${EMAIL_SIGNATURE_BANNER_CID}` : null;
  const { html: htmlWithLogo, logoInline } =
    mode === "send" ? inlineFirmLogoInEmailHtml(input.html) : { html: input.html, logoInline: null };
  const html = ensureClientEmailHtml(htmlWithLogo, { bannerSrc });
  const mime = buildRawMime({
    from: fromAddress,
    to,
    subject: input.subject,
    html,
    plain: ensureClientEmailPlain(
      input.plain?.trim() ||
        html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      { reswapSignature: Boolean(banner) }
    ),
    bcc,
    attachments: input.attachments,
    inlineImages: mergeInlineEmailImages(logoInline ? [logoInline] : undefined, banner ? [banner] : undefined)
  });

  try {
    const delivery = await deliverMimeMessage(accessToken, mime, mode);
    return {
      ...delivery,
      senderEmail
    };
  } catch (error) {
    const msg = extractGmailError(error);
    if (/invalid from|not authorized to send|send as|from address|invalid argument:\s*[^\s]+@/i.test(msg)) {
      throw new Error(firmSendAsHelp());
    }
    if (error instanceof Error) throw error;
    throw new Error(mode === "draft" ? "Gmail draft failed." : "Gmail send failed.");
  }
}

export function sentMailHint(senderEmail: string, recipient: string, messageId: string, bcc?: boolean): string {
  const firm = resolveFirmSenderEmail();
  const parts = [
    `Sent from ${senderEmail || firm} to ${recipient}.`,
    `Gmail message id: ${messageId}.`,
    `Check Sent in ${firm}`,
    bcc ? "and your inbox (BCC copy)" : "",
    "and the recipient spam folder if needed."
  ];
  return parts.filter(Boolean).join(" ");
}
