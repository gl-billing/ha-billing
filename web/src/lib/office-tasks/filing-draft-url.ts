/**
 * Validate filing draft document URLs (Google Drive / Docs).
 * Never accept javascript: or data:.
 */

export type FilingDraftUrlErrorCode =
  | "empty"
  | "unsafe_scheme"
  | "invalid_url"
  | "unsupported_protocol"
  | "unsupported_host";

export type FilingDraftUrlValidation =
  | {
      ok: true;
      url: string;
      provider: "google";
    }
  | {
      ok: false;
      code: FilingDraftUrlErrorCode;
      message: string;
    };

function parseHttpsDocumentUrl(
  raw: string
): { ok: true; url: URL } | { ok: false; code: FilingDraftUrlErrorCode; message: string } {
  const value = String(raw || "").trim();
  if (!value) {
    return { ok: false, code: "empty", message: "Paste a Document URL before continuing." };
  }
  if (/^(javascript|data|file|vbscript):/i.test(value)) {
    return {
      ok: false,
      code: "unsafe_scheme",
      message: "Unsafe link rejected. Use an https:// Document URL only."
    };
  }
  if (!/^https:\/\//i.test(value)) {
    return {
      ok: false,
      code: "unsupported_protocol",
      message: "Document URL must use https:// (Google Drive or Google Docs)."
    };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      code: "invalid_url",
      message: "Document URL is not a valid absolute https link."
    };
  }
  if (url.protocol !== "https:") {
    return {
      ok: false,
      code: "unsupported_protocol",
      message: "Document URL must use https:// (Google Drive or Google Docs)."
    };
  }
  return { ok: true, url };
}

export function isSupportedFilingDraftUrl(raw: string): boolean {
  return validateFilingDraftUrl(raw).ok;
}

export function validateFilingDraftUrl(raw: string): FilingDraftUrlValidation {
  const parsed = parseHttpsDocumentUrl(raw);
  if (!parsed.ok) return parsed;
  const host = parsed.url.hostname.toLowerCase();
  if (
    host === "drive.google.com" ||
    host === "docs.google.com" ||
    host === "docs.googleusercontent.com" ||
    host.endsWith(".google.com")
  ) {
    return { ok: true, url: parsed.url.toString(), provider: "google" };
  }
  return {
    ok: false,
    code: "unsupported_host",
    message: "Unsupported document host. Use an https Google Drive or Google Docs link."
  };
}

export function normalizeFilingDraftUrl(raw: string): string | null {
  const result = validateFilingDraftUrl(raw);
  if (!result.ok) return null;
  return result.url;
}

export function filingDraftUrlValidationError(raw: string): string | null {
  const result = validateFilingDraftUrl(raw);
  return result.ok ? null : result.message;
}
