import type { LedgerEntryPayload } from "@/lib/gl-config";
import { formatClientCaseLabel } from "@/lib/gl-config";
import {
  clientCaseMatchesBillingClient,
  matterClientContextFromDetail,
  type MatterClientContext
} from "@/lib/office-tasks/client-matter";
import { getClientDetail } from "@/lib/sheets/master";
import { getEmployeeDirectory } from "@/lib/office-tasks/sheets/employees";
import { collectAllItems } from "@/lib/office-tasks/sheets/items";
import { appendTask } from "@/lib/office-tasks/sheets/tasks";
import { isItemOpen, todayYmd } from "@/lib/office-tasks/schedule";
import { invalidateTasksDataCache } from "@/lib/office-tasks/tasks-cache";
import { defaultAndreaOperationsAssignee } from "@/lib/office-tasks/task-assignees";

const TRIGGER_PREFIX = "BILLING_TRIGGER";

export type BillingTriggerKind = "charge" | "payment" | "soa" | "ar";

function normalizeClientCode(clientCode: string): string {
  return clientCode.trim().toUpperCase();
}

function triggerMarker(kind: BillingTriggerKind, clientCode: string, key: string): string {
  return `${TRIGGER_PREFIX}:${kind}:${normalizeClientCode(clientCode)}:${key}`;
}

function billingTriggerMarkerPrefix(kind: BillingTriggerKind, clientCode: string): string {
  return `${TRIGGER_PREFIX}:${kind}:${normalizeClientCode(clientCode)}:`;
}

/** SOA/AR: one open follow-up per client. Charge/payment: dedupe exact same-day entry only. */
async function hasOpenBillingTriggerTask(
  accessToken: string,
  clientCode: string,
  kind: BillingTriggerKind,
  description: string,
  clientCase: string,
  markerKey: string,
  clientContext: MatterClientContext | null
): Promise<boolean> {
  const markerPrefix = billingTriggerMarkerPrefix(kind, clientCode);
  const exactMarker = triggerMarker(kind, clientCode, markerKey).toUpperCase();
  const oneOpenPerClient = kind === "soa" || kind === "ar";
  const caseKey = clientCase.trim().toLowerCase();
  const descKey = description.trim().toLowerCase();

  const items = await collectAllItems(accessToken);
  return items.some((item) => {
    if (item.source !== "Task" || !isItemOpen(item)) return false;

    const remarks = item.remarks.toUpperCase();
    if (oneOpenPerClient && remarks.includes(markerPrefix)) return true;
    if (!oneOpenPerClient && remarks.includes(exactMarker)) return true;

    if (!oneOpenPerClient) return false;

    // Older SOA/AR auto-tasks may lack a marker — match description for this billing client.
    if (item.details.trim().toLowerCase() !== descKey) return false;
    const itemCase = item.clientCase.trim().toLowerCase();
    if (itemCase === caseKey) return true;
    if (itemCase.includes(normalizeClientCode(clientCode).toLowerCase())) return true;
    if (clientContext && clientCaseMatchesBillingClient(item.clientCase, clientContext, item.id)) return true;
    return false;
  });
}

type BillingTaskFields = {
  clientCase?: string;
  assignedTo?: string;
  priority?: string;
  taskType?: string;
  description: string;
  nextAction?: string;
};

async function resolveBillingAssignee(accessToken: string, override?: string): Promise<string> {
  if (override?.trim()) return override.trim();
  const directory = await getEmployeeDirectory(accessToken);
  const roster = directory.map((employee) => employee.name).filter(Boolean);
  return defaultAndreaOperationsAssignee(roster, directory);
}

async function createBillingTask(
  accessToken: string,
  clientCode: string,
  kind: BillingTriggerKind,
  form: BillingTaskFields,
  markerKey: string
): Promise<string | null> {
  try {
    const client = await getClientDetail(accessToken, clientCode);
    const clientContext = matterClientContextFromDetail(client);
    const clientCase =
      formatClientCaseLabel(client?.name || "", client?.caseTitle || "").trim() ||
      client?.name?.trim() ||
      clientCode;
    const marker = triggerMarker(kind, clientCode, markerKey);

    if (
      await hasOpenBillingTriggerTask(
        accessToken,
        clientCode,
        kind,
        form.description,
        clientCase,
        markerKey,
        clientContext
      )
    ) {
      return null;
    }

    const assignedTo = await resolveBillingAssignee(accessToken, form.assignedTo);
    const saved = await appendTask(accessToken, {
      clientCase,
      assignedTo,
      dueDate: todayYmd(),
      priority: form.priority || "Medium",
      taskType: form.taskType || "Task",
      description: form.description,
      nextAction: form.nextAction || form.description,
      remarks: marker,
      status: "In Progress",
      reminderDays: 1,
      calendarSync: false
    });
    invalidateTasksDataCache(accessToken);
    return saved.id;
  } catch (error) {
    console.error("[billing-task-triggers]", error);
    return null;
  }
}

export async function triggerTaskOnCharge(
  accessToken: string,
  payload: LedgerEntryPayload
): Promise<string | null> {
  if (payload.type?.toLowerCase() !== "charge") return null;
  const amount = Number(payload.charge) || 0;
  const desc = payload.description?.trim() || payload.category || "Charge";
  return createBillingTask(
    accessToken,
    payload.clientCode,
    "charge",
    {
      priority: amount >= 50000 ? "High" : "Medium",
      taskType: "Task",
      description: `Review new charge — ${desc}`,
      nextAction: "Confirm ledger entry and update client if needed."
    },
    `${todayYmd()}:${desc.slice(0, 40)}`
  );
}

export async function triggerTaskOnPayment(
  accessToken: string,
  payload: LedgerEntryPayload
): Promise<string | null> {
  if (payload.type?.toLowerCase() !== "payment") return null;
  return createBillingTask(
    accessToken,
    payload.clientCode,
    "payment",
    {
      priority: "Medium",
      taskType: "Task",
      description: `Payment recorded — confirm AR / receipt sent`,
      nextAction: "Generate AR if not sent; update retainer and follow up with client."
    },
    `${todayYmd()}:${payload.payment || 0}`
  );
}

export async function triggerTaskOnPortalPaymentProof(
  accessToken: string,
  clientCode: string,
  details: { note: string; amount?: string; method?: string }
): Promise<string | null> {
  const amount = details.amount?.trim();
  const method = details.method?.trim();
  const summary = amount ? `Payment proof — ${amount}` : "Payment proof from client portal";
  const nextAction = [
    "Verify payment posted to ledger and issue AR if needed.",
    method ? `Method: ${method}.` : "",
    details.note.trim() ? `Client note: ${details.note.trim()}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  return createBillingTask(
    accessToken,
    clientCode,
    "payment",
    {
      priority: "High",
      taskType: "Task",
      description: summary,
      nextAction
    },
    `portal:${todayYmd()}:${details.note.trim().slice(0, 32)}`
  );
}

export async function triggerTaskOnSoaSent(
  accessToken: string,
  clientCode: string
): Promise<string | null> {
  return createBillingTask(
    accessToken,
    clientCode,
    "soa",
    {
      priority: "High",
      taskType: "Task",
      description: "SOA sent — schedule collection follow-up",
      nextAction: "Follow up on payment within 7 days; log client response."
    },
    todayYmd()
  );
}

export async function triggerTaskOnArSent(
  accessToken: string,
  clientCode: string
): Promise<string | null> {
  return createBillingTask(
    accessToken,
    clientCode,
    "ar",
    {
      priority: "Low",
      taskType: "Task",
      description: "AR sent — confirm client received acknowledgment",
      nextAction: "File AR copy and update matter notes if needed."
    },
    todayYmd()
  );
}
