import { normalizeStaffPhoneE164 } from "@/lib/staff-messenger-reminder";
import { whatsAppShareUrl } from "@/lib/messenger-share";
import type { StaffMessageRecord } from "@/lib/office-tasks/staff-messages";
import { APP_SHORT_NAME, FIRM_COPYRIGHT_HOLDER } from "@/lib/firm-brand";

const DEFAULT_APP_ROOT =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://ha-billing.vercel.app";

const SHARE_BRAND = `${FIRM_COPYRIGHT_HOLDER} — ${APP_SHORT_NAME}`;

export function staffMessageWhatsAppText(message: Pick<StaffMessageRecord, "subject" | "body" | "fromName">): string {
  const lines = [
    SHARE_BRAND,
    "",
    `Message from ${message.fromName || "the office"}:`,
    "",
    message.subject.trim(),
    "",
    message.body.trim(),
    "",
    `Open app: ${DEFAULT_APP_ROOT}/app`
  ];
  return lines.join("\n");
}

export function staffMessageWhatsAppUrl(
  message: Pick<StaffMessageRecord, "subject" | "body" | "fromName">,
  phone: string
): string | null {
  const digits = normalizeStaffPhoneE164(phone);
  if (!digits) return null;
  return whatsAppShareUrl(staffMessageWhatsAppText(message), digits);
}

/** External counsel do not have app login — omit the in-app deep link. */
export function counselMessageWhatsAppText(
  message: Pick<StaffMessageRecord, "subject" | "body" | "fromName">
): string {
  return [
    SHARE_BRAND,
    "",
    `Message from ${message.fromName || "the office"}:`,
    "",
    message.subject.trim(),
    "",
    message.body.trim()
  ].join("\n");
}

export function staffMessageMailtoUrl(
  message: Pick<StaffMessageRecord, "subject" | "body">,
  toEmail: string
): string | null {
  const email = toEmail.trim();
  if (!email) return null;
  const params = new URLSearchParams({
    subject: message.subject.trim(),
    body: message.body.trim()
  });
  return `mailto:${email}?${params.toString()}`;
}
