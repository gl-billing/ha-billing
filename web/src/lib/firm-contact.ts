import {
  FIRM_ADDRESS,
  FIRM_EMAIL,
  FIRM_LANDLINE,
  FIRM_MOBILE,
  FIRM_WEBSITE
} from "@/lib/billing-document-design";

/** Edge-safe contact helpers — keep free of fs/pdf-lib so middleware can import app-access → firm-sender. */

export type FirmLetterheadContact = {
  address: string;
  mobile: string;
  landline: string;
  email: string;
  website: string;
};

export function getFirmLetterheadContact(): FirmLetterheadContact {
  return {
    address: FIRM_ADDRESS,
    mobile: FIRM_MOBILE,
    landline: FIRM_LANDLINE,
    email: FIRM_EMAIL,
    website: FIRM_WEBSITE
  };
}

/** Primary phone for footers — landline first, then mobile. */
export function firmPrimaryPhone(contact: FirmLetterheadContact = getFirmLetterheadContact()): string {
  return contact.landline.trim() || contact.mobile.trim();
}

/** `tel:` href for Philippine numbers shown in the UI. */
export function firmPhoneTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `tel:+63${digits.slice(1)}`;
  if (digits.startsWith("63")) return `tel:+${digits}`;
  return `tel:+${digits}`;
}

/** Short location line for compact footers. */
export function firmFooterLocation(contact: FirmLetterheadContact = getFirmLetterheadContact()): string {
  const address = contact.address.trim();
  if (!address) return "Davao City";
  const firstPart = address.split(",")[0]?.trim();
  return firstPart || address;
}

export function formatFirmWebsiteLabel(website = FIRM_WEBSITE): string {
  return String(website || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

function normalizePhoneDigits(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

/** Phone line for letterhead — avoids duplicate Mobile/Tel when the number is the same. */
export function formatFirmPhoneLine(contact: FirmLetterheadContact = getFirmLetterheadContact()): string | null {
  const mobile = contact.mobile.trim();
  const landline = contact.landline.trim();
  if (!mobile && !landline) return null;

  if (mobile && landline && normalizePhoneDigits(mobile) === normalizePhoneDigits(landline)) {
    return `Mobile / Tel. ${mobile}`;
  }

  const parts: string[] = [];
  if (mobile) parts.push(`Mobile ${mobile}`);
  if (landline) parts.push(`Tel. ${landline}`);
  return parts.join("   ·   ");
}

export function formatFirmContactLine(contact: FirmLetterheadContact = getFirmLetterheadContact()): string {
  const parts: string[] = [];
  const phoneLine = formatFirmPhoneLine(contact);
  if (phoneLine) parts.push(phoneLine);
  if (contact.email) parts.push(contact.email);
  if (contact.website) parts.push(formatFirmWebsiteLabel(contact.website));
  return parts.join("   ·   ");
}

export function formatFirmContactLines(contact: FirmLetterheadContact = getFirmLetterheadContact()): string[] {
  const lines: string[] = [contact.address];
  const phoneLine = formatFirmPhoneLine(contact);
  if (phoneLine) lines.push(phoneLine);
  const digital = [contact.email, formatFirmWebsiteLabel(contact.website)].filter(Boolean).join("   ·   ");
  if (digital) lines.push(digital);
  return lines;
}

export function formatFirmContactFormalParts(
  contact: FirmLetterheadContact = getFirmLetterheadContact()
): {
  address: string;
  phones: { label: string; value: string }[];
  digital: { label: string; value: string }[];
} {
  const phones: { label: string; value: string }[] = [];
  const mobile = contact.mobile.trim();
  const landline = contact.landline.trim();
  if (mobile && landline && normalizePhoneDigits(mobile) === normalizePhoneDigits(landline)) {
    phones.push({ label: "Mobile / Tel.", value: mobile });
  } else {
    if (mobile) phones.push({ label: "Mobile", value: mobile });
    if (landline) phones.push({ label: "Tel.", value: landline });
  }

  const digital: { label: string; value: string }[] = [];
  if (contact.email) digital.push({ label: "Email", value: contact.email });
  if (contact.website) {
    digital.push({ label: "Web", value: formatFirmWebsiteLabel(contact.website) });
  }

  return { address: contact.address, phones, digital };
}

export function formatAddressLines(address: string): string[] {
  const trimmed = address.trim();
  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return [trimmed];
  return [parts.slice(0, -1).join(", "), parts[parts.length - 1]!];
}

/** Letterhead footer — address in normal capitalization. */
export function formatLetterheadFooterAddressLine(
  contact: FirmLetterheadContact = getFirmLetterheadContact()
): string {
  return formatAddressLines(contact.address.trim()).join("   ·   ");
}

/** Letterhead footer — email and website in lowercase. */
export function formatLetterheadFooterDigitalLine(
  contact: FirmLetterheadContact = getFirmLetterheadContact()
): string | null {
  const parts: string[] = [];
  const email = contact.email.trim();
  if (email) parts.push(email.toLowerCase());
  const website = formatFirmWebsiteLabel(contact.website);
  if (website) parts.push(website.toLowerCase());
  return parts.length ? parts.join("   ·   ") : null;
}

/** Letterhead footer — phone labels with standard capitalization. */
export function formatLetterheadFooterPhoneLine(
  contact: FirmLetterheadContact = getFirmLetterheadContact()
): string | null {
  const formal = formatFirmContactFormalParts(contact);
  const phoneText = formal.phones.map((part) => `${part.label} ${part.value}`).join("   ·   ");
  return phoneText || null;
}

export function formatFirmContactChannels(contact: FirmLetterheadContact = getFirmLetterheadContact()): {
  phones: string | null;
  digital: string | null;
} {
  const formal = formatFirmContactFormalParts(contact);
  const phones = formal.phones.map((part) => `${part.label} ${part.value}`).join("   ·   ") || null;
  const digital = formal.digital.map((part) => `${part.label} ${part.value}`).join("   ·   ") || null;
  return { phones, digital };
}
