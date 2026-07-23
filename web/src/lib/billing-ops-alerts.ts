import { formatClientCaseLabel } from "@/lib/gl-config";
import type { AuditLogEntry } from "@/lib/gl-config";
import { getClientDetail } from "@/lib/sheets/master";
import { appendAuditLog, getAuditLog } from "@/lib/sheets/audit-log";
import { matterClientContextFromDetail } from "@/lib/office-tasks/client-matter";

const ALERT_PREFIX = "BILLING_OPS_ALERT";
const ALERT_DONE_PREFIX = "BILLING_OPS_ALERT_DONE";

export type BillingOpsAlertKind =
  | "charge"
  | "payment"
  | "soa"
  | "ar"
  | "payment_proof"
  | "portal_message"
  | "online_payment"
  | "retainer";

const ALERT_KIND_RE =
  "charge|payment|soa|ar|payment_proof|portal_message|online_payment|retainer";

export type BillingOpsAlert = {
  id: string;
  kind: BillingOpsAlertKind;
  clientCode: string;
  clientCase: string;
  title: string;
  subtitle: string;
  meta: string;
  priority: "urgent" | "normal";
  markerKey: string;
  createdAt: string;
};

function normalizeClientCode(clientCode: string): string {
  return clientCode.trim().toUpperCase();
}

function alertMarker(kind: BillingOpsAlertKind, clientCode: string, markerKey: string): string {
  return `${ALERT_PREFIX}:${kind}:${normalizeClientCode(clientCode)}:${markerKey}`;
}

function alertDoneMarker(kind: BillingOpsAlertKind, clientCode: string, markerKey: string): string {
  return `${ALERT_DONE_PREFIX}:${kind}:${normalizeClientCode(clientCode)}:${markerKey}`;
}

function parseAlertMarker(details: string): {
  kind: BillingOpsAlertKind;
  clientCode: string;
  markerKey: string;
} | null {
  const match = String(details || "").match(
    new RegExp(`^${ALERT_PREFIX}:(${ALERT_KIND_RE}):([A-Z0-9-]+):(.+)$`, "i")
  );
  if (!match) return null;
  return {
    kind: match[1].toLowerCase() as BillingOpsAlertKind,
    clientCode: match[2].toUpperCase(),
    markerKey: match[3]
  };
}

function parseAlertDoneMarker(details: string): {
  kind: BillingOpsAlertKind;
  clientCode: string;
  markerKey: string;
} | null {
  const match = String(details || "").match(
    new RegExp(`^${ALERT_DONE_PREFIX}:(${ALERT_KIND_RE}):([A-Z0-9-]+):(.+)$`, "i")
  );
  if (!match) return null;
  return {
    kind: match[1].toLowerCase() as BillingOpsAlertKind,
    clientCode: match[2].toUpperCase(),
    markerKey: match[3]
  };
}

function isOpenAlert(
  alert: { kind: BillingOpsAlertKind; clientCode: string; markerKey: string },
  entries: AuditLogEntry[]
): boolean {
  const done = entries.some((entry) => {
    const parsed = parseAlertDoneMarker(entry.details);
    return (
      parsed &&
      parsed.kind === alert.kind &&
      parsed.clientCode === alert.clientCode &&
      parsed.markerKey === alert.markerKey
    );
  });
  return !done;
}

export async function listOpenBillingOpsAlerts(
  accessToken: string,
  options?: { clientCode?: string; limit?: number }
): Promise<BillingOpsAlert[]> {
  const entries = await getAuditLog(accessToken, { clientCode: options?.clientCode, limit: 500 });
  const open: BillingOpsAlert[] = [];

  for (const entry of entries) {
    const parsed = parseAlertMarker(entry.details);
    if (!parsed) continue;
    if (!isOpenAlert(parsed, entries)) continue;

    const payload = entry.summary.split("|");
    const title = payload[0]?.trim() || "Billing follow-up";
    const clientCase = payload[1]?.trim() || parsed.clientCode;
    const meta = payload[2]?.trim() || entry.timestamp;

    open.push({
      id: `${parsed.kind}-${parsed.clientCode}-${parsed.markerKey}`,
      kind: parsed.kind,
      clientCode: parsed.clientCode,
      clientCase,
      title,
      subtitle: clientCase,
      meta,
      priority:
        parsed.kind === "payment_proof" ||
        parsed.kind === "portal_message" ||
        parsed.kind === "online_payment" ||
        parsed.kind === "soa" ||
        (parsed.kind === "retainer" && /fail|blocked/i.test(title))
          ? "urgent"
          : "normal",
      markerKey: parsed.markerKey,
      createdAt: entry.timestamp
    });
  }

  const seen = new Set<string>();
  const deduped = open.filter((row) => {
    const key = `${row.kind}:${row.clientCode}`;
    if (row.kind === "soa" || row.kind === "ar") {
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  });

  if (options?.limit) return deduped.slice(0, options.limit);
  return deduped;
}

async function hasOpenBillingOpsAlert(
  accessToken: string,
  clientCode: string,
  kind: BillingOpsAlertKind,
  markerKey: string
): Promise<boolean> {
  const entries = await getAuditLog(accessToken, { clientCode, limit: 200 });
  const alert = { kind, clientCode: normalizeClientCode(clientCode), markerKey };
  const exists = entries.some((entry) => {
    const parsed = parseAlertMarker(entry.details);
    return (
      parsed &&
      parsed.kind === alert.kind &&
      parsed.clientCode === alert.clientCode &&
      parsed.markerKey === alert.markerKey
    );
  });
  if (!exists) return false;
  return isOpenAlert(alert, entries);
}

export async function enqueueBillingOpsAlert(
  accessToken: string,
  input: {
    kind: BillingOpsAlertKind;
    clientCode: string;
    title: string;
    meta?: string;
    markerKey: string;
    user?: string;
  }
): Promise<string | null> {
  const clientCode = normalizeClientCode(input.clientCode);
  const oneOpenPerClient = input.kind === "soa" || input.kind === "ar";

  if (oneOpenPerClient) {
    const open = await listOpenBillingOpsAlerts(accessToken, { clientCode });
    if (open.some((row) => row.kind === input.kind)) return null;
  } else if (await hasOpenBillingOpsAlert(accessToken, clientCode, input.kind, input.markerKey)) {
    return null;
  }

  let clientCase = clientCode;
  try {
    const client = await getClientDetail(accessToken, clientCode);
    const context = matterClientContextFromDetail(client);
    clientCase =
      formatClientCaseLabel(client?.name || "", client?.caseTitle || "").trim() ||
      client?.name?.trim() ||
      clientCode;
    if (!context && client?.name) clientCase = client.name;
  } catch {
    // best-effort label
  }

  const marker = alertMarker(input.kind, clientCode, input.markerKey);
  const summary = [input.title, clientCase, input.meta || ""].join("|");

  await appendAuditLog(accessToken, {
    user: input.user || "system",
    action: "billing.ops.open",
    clientCode,
    summary,
    details: marker
  });

  return marker;
}

export async function acknowledgeBillingOpsAlert(
  accessToken: string,
  input: {
    kind: BillingOpsAlertKind;
    clientCode: string;
    markerKey: string;
    user?: string;
    note?: string;
  }
): Promise<void> {
  await appendAuditLog(accessToken, {
    user: input.user || "staff",
    action: "billing.ops.done",
    clientCode: normalizeClientCode(input.clientCode),
    summary: `Billing alert cleared — ${input.kind}`,
    details: `${alertDoneMarker(input.kind, input.clientCode, input.markerKey)}${input.note ? ` | ${input.note}` : ""}`
  });
}
