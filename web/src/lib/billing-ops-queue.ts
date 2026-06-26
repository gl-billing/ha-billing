import type { HomeDashboard, NotarizationEntry, WalkInClient } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { buildMyWorkBillingSummary } from "@/lib/my-work-billing";
import { isAndreaOperationsItem } from "@/lib/office-tasks/firm-task-groups";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import { isItemOpen } from "@/lib/office-tasks/schedule";

export type BillingOpsBucket =
  | "overdue"
  | "follow_up"
  | "pending_ar"
  | "billing_task"
  | "walk_in"
  | "notarization";

export type BillingOpsQueueItem = {
  id: string;
  bucket: BillingOpsBucket;
  priority: "urgent" | "normal";
  title: string;
  subtitle: string;
  meta: string;
  clientCode?: string;
  navigate: {
    page: "billing" | "clients" | "documents" | "walkIns" | "notarizations";
    clientCode?: string;
    docTab?: "soa" | "ar";
  };
};

export type BillingOpsQueue = {
  generatedAt: string;
  totalCount: number;
  urgentCount: number;
  items: BillingOpsQueueItem[];
  counts: Record<BillingOpsBucket, number>;
};

const BUCKET_ORDER: BillingOpsBucket[] = [
  "overdue",
  "pending_ar",
  "follow_up",
  "billing_task",
  "walk_in",
  "notarization"
];

function daysSince(isoDate: string): number | null {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildBillingOpsQueue(input: {
  dashboard: HomeDashboard;
  master: unknown[][];
  items: OfficeItem[];
  walkIns: WalkInClient[];
  notarizations: NotarizationEntry[];
  email: string | null | undefined;
  name: string | null | undefined;
  roster?: string[];
}): BillingOpsQueue {
  const summary = buildMyWorkBillingSummary(input.dashboard, input.master, {
    email: input.email,
    name: input.name,
    roster: input.roster
  });

  const items: BillingOpsQueueItem[] = [];

  for (const client of input.dashboard.overdueList) {
    if (summary.scope === "assigned" && !summary.overdue.some((row) => row.code === client.code)) continue;
    items.push({
      id: `overdue-${client.code}`,
      bucket: "overdue",
      priority: "urgent",
      title: `${client.code} · overdue balance`,
      subtitle: client.name || client.code,
      meta: `${formatPeso(client.totalDue)} · ${client.accountStatus || "Overdue"}`,
      clientCode: client.code,
      navigate: { page: "documents", clientCode: client.code, docTab: "soa" }
    });
  }

  for (const entry of input.dashboard.pendingAr) {
    if (summary.scope === "assigned" && !summary.pendingAr.some((row) => row.code === entry.clientCode)) {
      continue;
    }
    items.push({
      id: `ar-${entry.sheetRow}-${entry.clientCode}`,
      bucket: "pending_ar",
      priority: "urgent",
      title: `${entry.clientCode} · issue acknowledgment receipt`,
      subtitle: entry.clientName || entry.clientCode,
      meta: `${entry.date} · ${formatPeso(entry.amount)}`,
      clientCode: entry.clientCode,
      navigate: { page: "documents", clientCode: entry.clientCode, docTab: "ar" }
    });
  }

  for (const client of input.dashboard.followUpThisWeek) {
    if (summary.scope === "assigned" && !summary.followUp.some((row) => row.code === client.code)) continue;
    items.push({
      id: `follow-${client.code}-${client.nextFollowUp}`,
      bucket: "follow_up",
      priority: "normal",
      title: `${client.code} · collection follow-up`,
      subtitle: client.name || client.code,
      meta: `Due ${client.nextFollowUp} · ${formatPeso(client.balance)}`,
      clientCode: client.code,
      navigate: { page: "billing", clientCode: client.code }
    });
  }

  for (const item of input.items) {
    if (!isItemOpen(item) || !isAndreaOperationsItem(item)) continue;
    const code = item.clientCase.split(/[\s—–-]/)[0]?.trim().toUpperCase();
    items.push({
      id: `task-${item.source}-${item.rowNumber}`,
      bucket: "billing_task",
      priority: /overdue|urgent|confirm ar|soa sent/i.test(item.nextAction) ? "urgent" : "normal",
      title: item.details.trim() || item.nextAction.trim() || "Billing task",
      subtitle: item.clientCase.trim() || "Office",
      meta: item.date ? `${item.date} · ${item.status}` : item.status,
      clientCode: code && code.length <= 12 ? code : undefined,
      navigate: { page: "billing", clientCode: code && code.length <= 12 ? code : undefined }
    });
  }

  for (const walkIn of input.walkIns) {
    if (walkIn.status !== "Active") continue;
    const age = daysSince(walkIn.dateAdded);
    items.push({
      id: `walkin-${walkIn.walkInId}`,
      bucket: "walk_in",
      priority: age !== null && age >= 3 ? "urgent" : "normal",
      title: `${walkIn.name} · promote to matter`,
      subtitle: walkIn.matter || "Walk-in visit",
      meta: `${walkIn.dateAdded}${walkIn.chargeAmount ? ` · ${formatPeso(walkIn.chargeAmount)}` : ""}`,
      navigate: { page: "walkIns" }
    });
  }

  for (const entry of input.notarizations) {
    if (entry.status === "Deleted" || entry.receiptIssuedAt?.trim()) continue;
    items.push({
      id: `notar-${entry.receiptNo}`,
      bucket: "notarization",
      priority: "normal",
      title: `${entry.receiptNo} · issue acknowledgment receipt`,
      subtitle: entry.name || entry.documentType,
      meta: `${entry.date} · ${formatPeso(entry.amount)}`,
      navigate: { page: "notarizations" }
    });
  }

  const bucketRank = (bucket: BillingOpsBucket) => BUCKET_ORDER.indexOf(bucket);
  items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
    return bucketRank(a.bucket) - bucketRank(b.bucket);
  });

  const counts = BUCKET_ORDER.reduce(
    (acc, bucket) => {
      acc[bucket] = items.filter((item) => item.bucket === bucket).length;
      return acc;
    },
    {} as Record<BillingOpsBucket, number>
  );

  return {
    generatedAt: new Date().toISOString(),
    totalCount: items.length,
    urgentCount: items.filter((item) => item.priority === "urgent").length,
    items,
    counts
  };
}

export const BILLING_OPS_BUCKET_LABELS: Record<BillingOpsBucket, string> = {
  overdue: "Overdue SOA",
  follow_up: "Follow-ups",
  pending_ar: "Pending AR",
  billing_task: "Billing tasks",
  walk_in: "Walk-ins",
  notarization: "Notarizations"
};
