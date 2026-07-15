"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "next-auth";
import { ClientActivityTimeline } from "@/components/ClientActivityTimeline";
import { ClientPortalPanel } from "@/components/ClientPortalPanel";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { PaymentRequestPanel } from "@/components/PaymentRequestPanel";
import { SameWindowLink } from "@/components/SameWindowLink";
import { FirmPrintLetterhead } from "@/components/FirmPrintLetterhead";
import { FirmWorkspaceShell } from "@/components/FirmWorkspaceShell";
import { ClientMatterProvider, useClientMatter } from "@/components/office-tasks/ClientMatterPanel";
import { getFirmMatterByCode } from "@/lib/office-tasks/firm-matters";
import { ItemCard, type ItemSummary } from "@/components/office-tasks/ItemCard";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { DashboardSkeleton } from "@/components/Skeleton";
import { formatClientAssignedLawyers } from "@/lib/assigned-lawyers";
import type { ClientDetail, ActivityItem, LedgerEntry } from "@/lib/gl-config";
import { formatPeso, GL } from "@/lib/gl-config";
import {
  groupItemsByClientCode,
  matterItemAnchorId,
  matterClientContextFromDetail,
  resolveTaskGroupCode
} from "@/lib/office-tasks/client-matter";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { TaskActivityEntry } from "@/lib/office-tasks/sheets/activity-log";
import { isItemOpen, officeItemKey } from "@/lib/office-tasks/schedule";
import type { ItemStatusOptions, ItemStatusUpdate } from "@/lib/office-tasks/status";
import {
  prepChecklistCreateUrl,
  prepChecklistInitializeUrl
} from "@/lib/office-tasks/prep-checklist-actions";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import { mergeTaskTimelineItems } from "@/lib/task-matter-timeline";
import { matterHref, parseBillingSection, type BillingSection, type MatterQuery, type MatterTab } from "@/lib/matter-routes";
import { correspondenceHref } from "@/lib/tasks-routes";
import { resolvePrepRoleFromSession } from "@/lib/office-tasks/prep-workload-view";
import { MatterStaffActions } from "@/components/matter/MatterStaffActions";
import { MatterNextActionStrip } from "@/components/matter/MatterNextActionStrip";
import { MatterEconomicsCard } from "@/components/matter/MatterEconomicsCard";
import {
  MatterHearingLifecyclePanel,
  type MatterChargeDraft
} from "@/components/matter/MatterHearingLifecyclePanel";
import { MatterStickyBar } from "@/components/matter/MatterStickyBar";
import { MatterIntakeChecklist } from "@/components/matter/MatterIntakeChecklist";
import { MatterInlineLedger } from "@/components/matter/MatterInlineLedger";
import { MatterAdvancedSettings } from "@/components/matter/MatterClientAdmin";
import { MatterBackLink } from "@/components/matter/MatterBackLink";
import { MatterLedgerHistory } from "@/components/matter/MatterLedgerHistory";
import { openPrintPreview } from "@/lib/print-preview";
import { readMatterReturnFromSearchParams } from "@/lib/matter-return";
import { getOfflineMatterSnapshot, saveOfflineMatterSnapshot } from "@/lib/matter-prefs";
import { billingClientMatchesMatterCode } from "@/lib/sheets/task-code-client-match";
import { formatBirthdayDisplay, isBirthdayToday, birthdayGreetingSentYear } from "@/lib/birthday-greeting";
import {
  formatClientCaseTypeLabel,
  showPsychologistFields
} from "@/lib/client-case-type";
import {
  caseTitleRequiredForMatterType,
  CLIENT_MATTER_TYPE_LABELS,
  formatMatterCaseCaption,
  resolveClientMatterType
} from "@/lib/client-matter-type";
import { todayYmd } from "@/lib/office-tasks/schedule";
import { BirthdayGreetingDialog } from "@/components/matter/BirthdayGreetingDialog";
import { resolveSessionStaffName } from "@/lib/staff-session";
import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";

type Props = {
  matterCode: string;
    user?: Session["user"];
};

type BillingClient = {
  code: string;
  name: string;
  caseTitle: string;
  caseNumber: string;
  caseRole: string;
  courtPending: string;
  matterType: string;
  balance: number;
  accountStatus: string;
  status: string;
  email: string;
  phone: string;
  address: string;
  assignedAttorney: string;
  coAssignedAttorney: string;
  retainerBalance: number;
  lastBillingDate: string;
  nextFollowUp: string;
  lastActivity: string;
};

function displayValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number") return String(value);
  const trimmed = value.trim();
  return trimmed || "—";
}

function detailToBillingClient(detail: ClientDetail): BillingClient {
  return {
    code: detail.code,
    name: detail.name,
    caseTitle: detail.caseTitle,
    caseNumber: detail.caseNumber || "",
    caseRole: detail.caseRole || "",
    courtPending: detail.courtPending || "",
    matterType: resolveClientMatterType(detail),
    balance: detail.balance,
    accountStatus: detail.accountStatus,
    status: detail.status,
    email: detail.email,
    phone: detail.phone || "",
    address: detail.address || "",
    assignedAttorney: detail.assignedAttorney || "",
    coAssignedAttorney: detail.coAssignedAttorney || "",
    retainerBalance: detail.retainerBalance,
    lastBillingDate: detail.lastBillingDate,
    nextFollowUp: detail.nextFollowUp,
    lastActivity: detail.lastActivity
  };
}

function matterItemActionPayload(item: ItemSummary) {
  return {
    source: item.source,
    rowNumber: item.rowNumber,
    itemId: item.id,
    clientCase: item.clientCase
  };
}

function matterItemActionKey(item: ItemSummary) {
  return `${item.source}:${item.rowNumber}:${item.id}`;
}

type MatterItemActionProps = {
  allItems: OfficeItem[];
  togglingKey: string | null;
  onToggleDone: (item: ItemSummary, done: boolean) => void;
  onSetStatus: (item: ItemSummary, status: ItemStatusUpdate, options?: ItemStatusOptions) => void;
  onCourtConfirmed: (item: ItemSummary) => void;
  onMarkSubmitted: (item: ItemSummary) => void;
  onConfirmParentFiled: (item: ItemSummary, parentEvent: ItemSummary) => void;
  onTogglePrepChecklistItem: (item: ItemSummary, itemIndex: number, checked: boolean) => void;
  onMutatePrepChecklistItem: (item: ItemSummary, mutation: PrepChecklistMutation) => void | Promise<void>;
  onCreatePrepChecklist: (item: ItemSummary) => void;
  onInitializePrepChecklist: (item: ItemSummary) => void;
  prepChecklistCreatingKey: string | null;
  viewerStaffName?: string;
  viewerPrepRole?: ReturnType<typeof resolvePrepRoleFromSession>;
  roster?: string[];
};

function billingClientToDetail(client: BillingClient): ClientDetail {
  return {
    code: client.code,
    name: client.name,
    caseTitle: client.caseTitle,
    caseNumber: client.caseNumber,
    caseRole: client.caseRole || "",
    courtPending: client.courtPending || "",
    matterType: resolveClientMatterType(client),
    balance: client.balance,
    status: client.status,
    accountStatus: client.accountStatus,
    email: client.email,
    phone: client.phone,
    address: client.address,
    assignedAttorney: client.assignedAttorney,
    coAssignedAttorney: client.coAssignedAttorney,
    retainerBalance: client.retainerBalance,
    lastBillingDate: client.lastBillingDate,
    nextFollowUp: client.nextFollowUp,
    lastActivity: client.lastActivity,
    masterRow: 0,
    prevBalance: 0,
    newCharges: 0,
    paymentsTotal: 0,
    preferredGreeting: "",
    lastInvoiceNumber: "",
    lastInvoiceUrl: "",
    soaSent: "",
    arPending: "",
    closeReason: "",
    closedDate: ""
  };
}

export function MatterPage({ matterCode, user }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingAccess = user?.billingAccess !== false;
  const email = user?.email?.trim() || "";

  const billingSection = parseBillingSection(searchParams.get("section"));
  const wantEditClient = searchParams.get("edit") === "1";
  const wantBirthdayGreeting = searchParams.get("birthdayGreeting") === "1";
  const caseHint = searchParams.get("case")?.trim() || undefined;
  const highlightTaskId = searchParams.get("highlightTask")?.trim() || undefined;
  const matterReturn = readMatterReturnFromSearchParams(searchParams) || undefined;
  const [birthdayDialogOpen, setBirthdayDialogOpen] = useState(false);
  const [items, setItems] = useState<OfficeItem[]>([]);
  const [employeeRoster, setEmployeeRoster] = useState<string[]>([]);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeRecord[]>([]);
  const [billingClient, setBillingClient] = useState<BillingClient | null>(null);
  const [profileDetail, setProfileDetail] = useState<ClientDetail | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [timeline, setTimeline] = useState<ActivityItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [chargeCategories, setChargeCategories] = useState<string[]>([...GL.chargeCategories]);
  const [intakeDismissed, setIntakeDismissed] = useState(false);
  const [chargeDraft, setChargeDraft] = useState<MatterChargeDraft | null>(null);
  const showIntakeChecklist = searchParams.get("intake") === "1" && !intakeDismissed;
  const walkInHighlight = searchParams.get("walkin")?.trim() || null;
  const [isOffline, setIsOffline] = useState(false);
  const [offlineLabel, setOfflineLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");
  const [prepChecklistCreatingKey, setPrepChecklistCreatingKey] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [billingMissing, setBillingMissing] = useState(false);
  const loadRequestRef = useRef(0);
  const highlightHandledRef = useRef<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [stickyBarVisible, setStickyBarVisible] = useState(false);

  const busy = loading || actionBusy;

  const viewerStaffName = useMemo(() => {
    if (!user) return undefined;
    return resolveSessionStaffName(user, employeeDirectory) ?? undefined;
  }, [user, employeeDirectory]);

  const viewerPrepRole = useMemo(
    () => resolvePrepRoleFromSession(user, employeeDirectory),
    [user, employeeDirectory]
  );

  const clientContext = useMemo(
    () => matterClientContextFromDetail(profileDetail ?? billingClient),
    [profileDetail, billingClient]
  );

  const taskGroupCode = useMemo(
    () => resolveTaskGroupCode(matterCode, profileDetail ?? billingClient),
    [matterCode, profileDetail, billingClient]
  );

  const { tasks, events, clientLabels } = useMemo(() => {
    if (billingAccess && !clientContext) {
      return { tasks: [], events: [], clientLabels: [] };
    }
    return groupItemsByClientCode(items, matterCode, taskGroupCode, clientContext);
  }, [billingAccess, clientContext, items, matterCode, taskGroupCode]);

  const primaryLabel = clientLabels[0] || "Client matter";
  const billingCode = billingClient?.code || profileDetail?.code || null;

  const matterLink = useCallback(
    (code: string, tab?: MatterTab, extra?: Omit<MatterQuery, "tab">) =>
      matterHref(code, tab, { ...extra, from: matterReturn, case: extra?.case ?? caseHint }),
    [matterReturn, caseHint]
  );

  const goToBillingSection = useCallback(
    (section: BillingSection, edit = false) => {
      router.replace(matterLink(matterCode, undefined, { section, edit: edit || undefined }), {
        scroll: false
      });
      window.setTimeout(() => {
        const targetId =
          section === "advanced" ? "matter-advanced-settings" : `matter-billing-${section}`;
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    },
    [matterCode, router, matterLink]
  );

  const handleDraftCharge = useCallback(
    (draft: MatterChargeDraft) => {
      setChargeDraft(draft);
      goToBillingSection("add");
    },
    [goToBillingSection]
  );

  const scrollToMatterItem = useCallback((anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (!el) return;
    const panel = el.closest("details.matter-items-column");
    if (panel instanceof HTMLDetailsElement) panel.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("matter-item-anchor--highlight");
    window.setTimeout(() => el.classList.remove("matter-item-anchor--highlight"), 1800);
  }, []);

  const handleMatterJump = useCallback(
    (anchorId: string) => {
      scrollToMatterItem(anchorId);
    },
    [scrollToMatterItem]
  );

  const scrollToTasks = useCallback(() => {
    document.getElementById("matter-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const clearMatterBillingState = useCallback(() => {
    setBillingClient(null);
    setProfileDetail(null);
    setLedgerEntries([]);
    setTimeline([]);
  }, []);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setTimelineLoading(true);
    setStatusMsg("");
    setBillingMissing(false);
    clearMatterBillingState();

    let walkInsRes: Response | null = null;
    try {
      walkInsRes = billingAccess ? await fetch(`/api/walk-ins?promoted=${encodeURIComponent(matterCode)}`) : null;
    } catch {
      walkInsRes = null;
    }

    async function mergeWalkInsIntoTimeline(base: ActivityItem[]): Promise<ActivityItem[]> {
      if (!walkInsRes?.ok) return base;
      const walkJson = await walkInsRes.json();
      const { walkInTimelineItems } = await import("@/lib/walk-in-timeline");
      const walkItems = walkInTimelineItems(walkJson.walkIns || [], matterCode);
      return [...base, ...walkItems].sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));
    }

    async function buildTasksOnlyTimeline(allItems: OfficeItem[], taskGroup: string, context: typeof clientContext) {
      setTimelineLoading(true);
      let taskActivity: TaskActivityEntry[] = [];
      try {
        const activityRes = await fetch(
          `/api/tasks/activity?clientCode=${encodeURIComponent(taskGroup)}&limit=40`
        );
        const activityJson = await activityRes.json();
        if (activityRes.ok && Array.isArray(activityJson.activity)) {
          taskActivity = activityJson.activity as TaskActivityEntry[];
        }
      } catch {
        /* optional */
      }
      const merged = mergeTaskTimelineItems(matterCode, [], {
        taskItems: allItems,
        taskActivity,
        taskGroupCode: taskGroup,
        clientContext: context
      });
      setTimeline(await mergeWalkInsIntoTimeline(merged));
      setTimelineLoading(false);
    }

    try {
      const itemsRes = await fetch("/api/tasks/items");
      const itemsJson = await itemsRes.json();
      if (requestId !== loadRequestRef.current) return;

      const allItems = itemsRes.ok && Array.isArray(itemsJson.items) ? (itemsJson.items as OfficeItem[]) : [];
      setItems(allItems);
      if (Array.isArray(itemsJson.employees)) {
        setEmployeeRoster(itemsJson.employees as string[]);
      }
      if (Array.isArray(itemsJson.employeeDirectory)) {
        setEmployeeDirectory(itemsJson.employeeDirectory as EmployeeRecord[]);
      }

      let taskGroup = resolveTaskGroupCode(matterCode, null);
      let loadContext: ReturnType<typeof matterClientContextFromDetail> = null;

      if (billingAccess) {
        const params = new URLSearchParams();
        if (caseHint) params.set("case", caseHint);

        const billingRes = await fetch(
          `/api/tasks/client-billing/${encodeURIComponent(matterCode)}?${params.toString()}`
        );
        const billingJson = await billingRes.json();
        if (requestId !== loadRequestRef.current) return;

        if (!billingRes.ok) {
          throw new Error(billingJson.error || "Could not load billing for this matter.");
        }

        if (billingJson.found && (billingJson.detail || billingJson.client)) {
          const detail = (billingJson.detail || billingClientToDetail(billingJson.client as BillingClient)) as ClientDetail;
          const billingMatches = billingClientMatchesMatterCode(matterCode, detail);
          taskGroup = resolveTaskGroupCode(matterCode, detail);
          loadContext = matterClientContextFromDetail(detail);

          if (!billingMatches) {
            setBillingMissing(true);
            setProfileDetail(detail);
            await buildTasksOnlyTimeline(allItems, taskGroup, loadContext);
          } else {
            const client = detailToBillingClient(detail);

            setProfileDetail(detail);
            setBillingClient(client);
            setLedgerEntries(
              Array.isArray(billingJson.ledger?.entries) ? (billingJson.ledger.entries as LedgerEntry[]) : []
            );

            if (Array.isArray(billingJson.activity)) {
              setTimeline(await mergeWalkInsIntoTimeline(billingJson.activity as ActivityItem[]));
            }

            const clientsRes = await fetch("/api/clients");
            if (requestId !== loadRequestRef.current) return;
            if (clientsRes.ok) {
              const clientsJson = await clientsRes.json();
              setChargeCategories(clientsJson.chargeCategories || []);
              setPaymentMethods(clientsJson.paymentMethods || []);
            }
          }
        } else {
          setBillingMissing(true);
          await buildTasksOnlyTimeline(allItems, taskGroup, loadContext);
        }
      } else {
        await buildTasksOnlyTimeline(allItems, taskGroup, loadContext);
      }
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setStatusMsg(error instanceof Error ? error.message : "Could not load matter.");
    } finally {
      if (requestId !== loadRequestRef.current) return;
      setLoading(false);
      setTimelineLoading(false);
    }
  }, [billingAccess, caseHint, clearMatterBillingState, matterCode]);

  const reloadTaskItems = useCallback(async () => {
    try {
      const itemsRes = await fetch("/api/tasks/items");
      const itemsJson = await itemsRes.json();
      if (itemsRes.ok && Array.isArray(itemsJson.items)) {
        setItems(itemsJson.items as OfficeItem[]);
      }
    } catch {
      /* optional refresh */
    }
  }, []);

  const togglePrepChecklistItem = useCallback(
    async (item: ItemSummary, itemIndex: number, checked: boolean) => {
      try {
        const res = await fetch("/api/tasks/items/prep-checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...matterItemActionPayload(item),
            itemIndex,
            checked
          })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Save failed");
        await reloadTaskItems();
      } catch (e) {
        setStatusMsg(`⚠ ${e instanceof Error ? e.message : "Could not update checklist."}`);
      }
    },
    [reloadTaskItems]
  );

  const mutatePrepChecklistItem = useCallback(
    async (item: ItemSummary, mutation: PrepChecklistMutation) => {
      try {
        const res = await fetch("/api/tasks/items/prep-checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...matterItemActionPayload(item),
            ...mutation
          })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Save failed");
        await reloadTaskItems();
      } catch (e) {
        setStatusMsg(`⚠ ${e instanceof Error ? e.message : "Could not update checklist."}`);
      }
    },
    [reloadTaskItems]
  );

  const createEventPrepChecklist = useCallback(
    async (item: ItemSummary) => {
      const key = matterItemActionKey(item);
      setPrepChecklistCreatingKey(key);
      try {
        const res = await fetch(prepChecklistCreateUrl(item as OfficeItem), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(matterItemActionPayload(item))
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Create failed");
        setStatusMsg(json.message || "Prep checklist created.");
        await reloadTaskItems();
      } catch (e) {
        setStatusMsg(`⚠ ${e instanceof Error ? e.message : "Could not create prep checklist."}`);
      } finally {
        setPrepChecklistCreatingKey(null);
      }
    },
    [reloadTaskItems]
  );

  const initializePrepChecklist = useCallback(
    async (item: ItemSummary) => {
      const key = matterItemActionKey(item);
      setPrepChecklistCreatingKey(key);
      try {
        const res = await fetch(prepChecklistInitializeUrl(item as OfficeItem), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(matterItemActionPayload(item))
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Enable failed");
        setStatusMsg(json.message || "Interactive checklist enabled.");
        await reloadTaskItems();
      } catch (e) {
        setStatusMsg(`⚠ ${e instanceof Error ? e.message : "Could not enable checklist."}`);
      } finally {
        setPrepChecklistCreatingKey(null);
      }
    },
    [reloadTaskItems]
  );

  const toggleItemDone = useCallback(
    async (item: ItemSummary, done: boolean) => {
      setTogglingKey(matterItemActionKey(item));
      try {
        const res = await fetch("/api/tasks/items/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...matterItemActionPayload(item), done })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Update failed");
        setStatusMsg(json.message || (done ? "Marked done." : "Reopened."));
        await reloadTaskItems();
      } catch (e) {
        setStatusMsg(`⚠ ${e instanceof Error ? e.message : "Update failed."}`);
      } finally {
        setTogglingKey(null);
      }
    },
    [reloadTaskItems]
  );

  const updateItemStatus = useCallback(
    async (item: ItemSummary, status: ItemStatusUpdate, options?: ItemStatusOptions) => {
      setTogglingKey(matterItemActionKey(item));
      try {
        const res = await fetch("/api/tasks/items/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...matterItemActionPayload(item), status, note: options?.note })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Update failed");
        setStatusMsg(json.message || "Status updated.");
        await reloadTaskItems();
      } catch (e) {
        setStatusMsg(`⚠ ${e instanceof Error ? e.message : "Update failed."}`);
      } finally {
        setTogglingKey(null);
      }
    },
    [reloadTaskItems]
  );

  const markCourtConfirmed = useCallback(
    async (item: ItemSummary) => {
      setTogglingKey(matterItemActionKey(item));
      try {
        const res = await fetch("/api/tasks/items/court-confirmed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(matterItemActionPayload(item))
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Update failed");
        setStatusMsg(json.message || "Court confirmed.");
        await reloadTaskItems();
      } catch (e) {
        setStatusMsg(`⚠ ${e instanceof Error ? e.message : "Update failed."}`);
      } finally {
        setTogglingKey(null);
      }
    },
    [reloadTaskItems]
  );

  const markEventSubmitted = useCallback(
    async (item: ItemSummary) => {
      setTogglingKey(matterItemActionKey(item));
      try {
        const res = await fetch("/api/tasks/items/submitted", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(matterItemActionPayload(item))
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Update failed");
        setStatusMsg(json.message || "Marked filed / submitted.");
        await reloadTaskItems();
      } catch (e) {
        setStatusMsg(`⚠ ${e instanceof Error ? e.message : "Update failed."}`);
      } finally {
        setTogglingKey(null);
      }
    },
    [reloadTaskItems]
  );

  const confirmParentFiled = useCallback(
    async (task: ItemSummary, parentEvent: ItemSummary) => {
      setTogglingKey(matterItemActionKey(task));
      try {
        const submitRes = await fetch("/api/tasks/items/submitted", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(matterItemActionPayload(parentEvent))
        });
        const submitJson = await submitRes.json();
        if (!submitRes.ok) throw new Error(submitJson.error || "Could not mark parent event filed.");

        const doneRes = await fetch("/api/tasks/items/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...matterItemActionPayload(task), done: true })
        });
        const doneJson = await doneRes.json();
        if (!doneRes.ok) throw new Error(doneJson.error || "Could not complete follow-up task.");

        setStatusMsg("Parent event marked filed; follow-up task done.");
        await reloadTaskItems();
      } catch (e) {
        setStatusMsg(`⚠ ${e instanceof Error ? e.message : "Update failed."}`);
      } finally {
        setTogglingKey(null);
      }
    },
    [reloadTaskItems]
  );

  const itemActionProps: MatterItemActionProps = useMemo(
    () => ({
      allItems: items,
      togglingKey,
      onToggleDone: toggleItemDone,
      onSetStatus: updateItemStatus,
      onCourtConfirmed: markCourtConfirmed,
      onMarkSubmitted: markEventSubmitted,
      onConfirmParentFiled: confirmParentFiled,
      onTogglePrepChecklistItem: togglePrepChecklistItem,
      onMutatePrepChecklistItem: mutatePrepChecklistItem,
      onCreatePrepChecklist: createEventPrepChecklist,
      onInitializePrepChecklist: initializePrepChecklist,
      prepChecklistCreatingKey,
      viewerStaffName,
      viewerPrepRole,
      roster: employeeRoster
    }),
    [
      items,
      togglingKey,
      toggleItemDone,
      updateItemStatus,
      markCourtConfirmed,
      markEventSubmitted,
      confirmParentFiled,
      togglePrepChecklistItem,
      mutatePrepChecklistItem,
      createEventPrepChecklist,
      initializePrepChecklist,
      prepChecklistCreatingKey,
      viewerStaffName,
      viewerPrepRole,
      employeeRoster
    ]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (billingAccess || !billingSection) return;
    router.replace(matterLink(matterCode), { scroll: false });
  }, [billingAccess, billingSection, matterCode, matterLink, router]);

  useEffect(() => {
    if (loading) return;
    const legacyTab = searchParams.get("tab")?.trim().toLowerCase();
    if (!legacyTab || legacyTab === "overview") return;

    if (!billingAccess) {
      router.replace(matterLink(matterCode), { scroll: false });
      if (legacyTab === "tasks") {
        window.setTimeout(() => {
          document.getElementById("matter-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
      return;
    }

    const section =
      billingSection ||
      (legacyTab === "documents" ? ("documents" as const) : legacyTab === "billing" ? ("add" as const) : null);

    router.replace(
      matterLink(matterCode, undefined, {
        section: section ?? undefined,
        edit: wantEditClient || undefined,
        intake: searchParams.get("intake") === "1" || undefined,
        walkin: walkInHighlight ?? undefined,
        highlightTask: highlightTaskId
      }),
      { scroll: false }
    );

    window.setTimeout(() => {
      if (legacyTab === "tasks") {
        document.getElementById("matter-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (legacyTab === "billing" || legacyTab === "documents") {
        const targetId =
          section === "advanced" ? "matter-advanced-settings" : `matter-billing-${section || "add"}`;
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  }, [loading, matterCode, matterLink, router, searchParams, billingSection, wantEditClient, walkInHighlight, billingAccess, highlightTaskId]);

  useEffect(() => {
    if (loading || !billingSection) return;
    const targetId =
      billingSection === "advanced" ? "matter-advanced-settings" : `matter-billing-${billingSection}`;
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, [loading, billingSection]);

  const firmMatter = getFirmMatterByCode(matterCode);
  const profileTitle =
    billingClient?.name ||
    profileDetail?.name ||
    firmMatter?.title ||
    (primaryLabel !== "Client matter" ? primaryLabel : null) ||
    matterCode;
  const caseLine = useMemo(() => {
    if (billingClient || profileDetail) {
      return formatMatterCaseCaption({
        matterType: profileDetail?.matterType ?? billingClient?.matterType,
        caseTitle: billingClient?.caseTitle ?? profileDetail?.caseTitle,
        retainerBalance: billingClient?.retainerBalance ?? profileDetail?.retainerBalance
      });
    }
    if (clientLabels.length > 1) return clientLabels.slice(1).join(" · ");
    return null;
  }, [billingClient, profileDetail, clientLabels]);
  const caseRole =
    billingClient?.caseRole?.trim() ||
    profileDetail?.caseRole?.trim() ||
    "";

  const openTasks = tasks.filter((t) => !t.done).length;
  const openEvents = events.filter((e) => !e.done).length;

  const pendingTasks = useMemo(
    () =>
      tasks
        .filter(isItemOpen)
        .sort(
          (a, b) =>
            (a.date || "9999").localeCompare(b.date || "9999") ||
            a.clientCase.localeCompare(b.clientCase)
        ),
    [tasks]
  );

  const pendingEvents = useMemo(
    () =>
      events
        .filter(isItemOpen)
        .sort(
          (a, b) =>
            (a.date || "9999").localeCompare(b.date || "9999") ||
            a.clientCase.localeCompare(b.clientCase)
        ),
    [events]
  );

  const pendingCount = pendingTasks.length;
  const shellWorkspace = billingClient && billingAccess ? "billing" : "tasks";
  const headerLabel = billingClient && billingAccess ? "Matter file" : "Matter";
  const clientDetail = useMemo(
    () => profileDetail ?? (billingClient ? billingClientToDetail(billingClient) : null),
    [profileDetail, billingClient]
  );

  const birthdayToday =
    Boolean(clientDetail?.birthday) && isBirthdayToday(clientDetail?.birthday);
  const birthdayGreetingSentThisYear =
    Boolean(clientDetail?.birthdayGreetingSent) &&
    birthdayGreetingSentYear(clientDetail?.birthdayGreetingSent) === new Date().getFullYear();

  useEffect(() => {
    highlightHandledRef.current = null;
  }, [matterCode, highlightTaskId]);

  useEffect(() => {
    if (loading || !highlightTaskId) return;
    if (highlightHandledRef.current === highlightTaskId) return;
    const match = [...tasks, ...events].find((item) => item.id === highlightTaskId);
    if (!match) return;
    highlightHandledRef.current = highlightTaskId;
    window.setTimeout(() => {
      scrollToTasks();
      scrollToMatterItem(matterItemAnchorId(match));
    }, 220);
  }, [loading, highlightTaskId, tasks, events, scrollToMatterItem, scrollToTasks]);

  useEffect(() => {
    if (loading) {
      setStickyBarVisible(false);
      return;
    }
    const el = headerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyBarVisible(!entry.isIntersecting),
      { root: null, threshold: 0, rootMargin: "-56px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, matterCode, profileTitle]);

  useEffect(() => {
    if (loading || !birthdayToday || !clientDetail?.code || !billingAccess) return;

    if (wantBirthdayGreeting) {
      setBirthdayDialogOpen(true);
      return;
    }

    if (birthdayGreetingSentThisYear) return;

    const key = `gl-birthday-popup-${clientDetail.code}-${todayYmd()}`;
    if (!sessionStorage.getItem(key)) {
      setBirthdayDialogOpen(true);
      sessionStorage.setItem(key, "1");
    }
  }, [
    loading,
    birthdayToday,
    birthdayGreetingSentThisYear,
    clientDetail?.code,
    wantBirthdayGreeting,
    billingAccess
  ]);

  useEffect(() => {
    if (loading || !profileTitle) return;
    saveOfflineMatterSnapshot({
      code: matterCode,
      label: profileTitle,
      caseTitle: caseLine || undefined,
      balance: billingClient?.balance ?? profileDetail?.balance,
      openTasks,
      openEvents,
      timelinePreview: timeline.slice(0, 8).map((item) => ({
        date: item.date,
        title: item.title,
        kind: item.kind
      })),
      savedAt: Date.now()
    });
  }, [loading, matterCode, profileTitle, caseLine, billingClient, profileDetail, openTasks, openEvents, timeline]);

  useEffect(() => {
    if (!isOffline) {
      setOfflineLabel(null);
      return;
    }
    const snap = getOfflineMatterSnapshot(matterCode);
    setOfflineLabel(snap?.label || matterCode);
  }, [isOffline, matterCode]);

  function dismissIntakeChecklist() {
    setIntakeDismissed(true);
    router.replace(matterLink(matterCode), { scroll: false });
  }

  function printMatterSummary() {
    openPrintPreview({
      title: `GL Matter Summary — ${billingCode || matterCode}`,
      sourceId: "matter-print-root"
    });
  }

  const refreshBillingData = useCallback(async () => {
    const code = billingCode || profileDetail?.code;
    if (!code) return;
    try {
      const [profileRes, ledgerRes] = await Promise.all([
        fetch(`/api/clients/${encodeURIComponent(code)}/profile?includeTasks=0`),
        fetch(`/api/clients/${encodeURIComponent(code)}/ledger`)
      ]);
      const profileJson = await profileRes.json();
      const ledgerJson = ledgerRes.ok ? await ledgerRes.json() : null;

      if (profileRes.ok && profileJson.client) {
        const detail = profileJson.client as ClientDetail;
        setProfileDetail(detail);
        setBillingClient(detailToBillingClient(detail));
      }

      if (ledgerJson && Array.isArray(ledgerJson.entries)) {
        setLedgerEntries(ledgerJson.entries as LedgerEntry[]);
      } else if (profileRes.ok && Array.isArray(profileJson.ledger?.entries)) {
        setLedgerEntries(profileJson.ledger.entries as LedgerEntry[]);
      }
    } catch {
      /* optional refresh */
    }
  }, [billingCode, profileDetail?.code]);

  function handleClientCodeRenamed(newCode: string) {
    setStatusMsg(`Client code renamed to ${newCode}.`);
    router.push(matterLink(newCode), { scroll: false });
  }

  function handleClientDeleted() {
    router.push("/billing");
  }

  return (
    <>
    <ClientMatterProvider
      items={items}
      togglingKey={togglingKey}
      onToggleDone={toggleItemDone}
      onSetStatus={updateItemStatus}
      onCourtConfirmed={markCourtConfirmed}
      onTogglePrepChecklistItem={togglePrepChecklistItem}
      onMutatePrepChecklistItem={mutatePrepChecklistItem}
      onCreatePrepChecklist={createEventPrepChecklist}
      onInitializePrepChecklist={initializePrepChecklist}
      prepChecklistCreatingKey={prepChecklistCreatingKey}
      onNotice={(message, isError) => setStatusMsg(isError ? `⚠ ${message}` : message)}
    >
      <MatterLabelSync
        code={matterCode}
        billingCode={billingCode}
        label={profileTitle}
        headerLabel={headerLabel}
      />
      <FirmWorkspaceShell
            signOutCallbackUrl={undefined}
      workspace={shellWorkspace}
      wide
      name={user?.name}
      email={user?.email}
      displayName={user?.displayName}
      billingAccess={billingAccess}
      breadcrumbPage={headerLabel}
      breadcrumbDetail={profileTitle}
      statusMessage={statusMsg || undefined}
      statusVariant={statusMsg.startsWith("⚠") ? "error" : "ok"}
      chromeTopBanner={undefined}
    >
      <div className="matter-page">
        <MatterStickyBar
          code={billingCode || matterCode}
          name={profileTitle}
          balance={billingClient?.balance}
          visible={stickyBarVisible}
        />
        <MatterBackLink
          fallbackHref={billingAccess ? "/billing" : "/app"}
        />

        {isOffline ? (
          <div className="matter-offline-banner no-print" role="status">
            Offline — showing last saved snapshot for {offlineLabel || matterCode}. Edits may not sync until you
            reconnect.
          </div>
        ) : null}

        {loading ? (
          <section className="card py-6">
            <DashboardSkeleton />
          </section>
        ) : (
          <>
            <header ref={headerRef} className="card matter-page__header client-matter-panel__header matter-letterhead">
              <p className="matter-page__header-label">{headerLabel}</p>

              <div className="matter-page__header-row">
                <div className="client-matter-panel__identity matter-letterhead__identity">
                  <h1 className="client-matter-panel__name matter-page__client-name">{profileTitle}</h1>
                  <p className="matter-letterhead__caption">
                    <span className="matter-letterhead__code">{billingCode || matterCode}</span>
                    {caseLine ? (
                      <>
                        <span className="matter-letterhead__dot" aria-hidden>
                          ·
                        </span>
                        <span className="matter-letterhead__matter">{caseLine}</span>
                      </>
                    ) : null}
                    {billingClient ? (
                      <>
                        <span className="matter-letterhead__dot" aria-hidden>
                          ·
                        </span>
                        <span className="matter-letterhead__counsel">
                          {displayValue(
                            formatClientAssignedLawyers(
                              billingClient.assignedAttorney,
                              billingClient.coAssignedAttorney
                            )
                          )}
                        </span>
                      </>
                    ) : null}
                  </p>
                  {caseRole ? <p className="matter-letterhead__role">{caseRole}</p> : null}
                </div>
                <button
                  type="button"
                  className="btn-secondary matter-page__print-btn no-print"
                  onClick={printMatterSummary}
                >
                  Print
                </button>
              </div>

              {firmMatter ? (
                <p className="client-matter-panel__status-line">{firmMatter.subtitle}</p>
              ) : billingMissing && billingAccess ? (
                <p className="client-matter-panel__status-line">
                  No billing file for this code — showing tasks and hearings only.
                </p>
              ) : null}

              {billingClient ? (
                <>
                  <div className="matter-page__balance-hero">
                    <span className="matter-page__balance-label">Current balance</span>
                    <span className="matter-page__balance-value amount-serif amount-serif--hero">
                      {formatPeso(billingClient.balance)}
                    </span>
                  </div>

                  {billingAccess ? (
                    <div className="client-matter-panel__stats client-matter-panel__stats--compact">
                      <div className="client-matter-panel__stat">
                        <span className="client-matter-panel__stat-label">Open tasks</span>
                        <span className="client-matter-panel__stat-value">{openTasks}</span>
                      </div>
                      <div className="client-matter-panel__stat">
                        <span className="client-matter-panel__stat-label">Open events</span>
                        <span className="client-matter-panel__stat-value">{openEvents}</span>
                      </div>
                      <div className="client-matter-panel__stat client-matter-panel__stat--wide">
                        <span className="client-matter-panel__stat-label">Lawyers</span>
                        <span className="client-matter-panel__stat-value">
                          {displayValue(
                            formatClientAssignedLawyers(
                              billingClient.assignedAttorney,
                              billingClient.coAssignedAttorney
                            )
                          )}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <details className="matter-page__contact-details no-print">
                    <summary className="matter-page__contact-details-summary">Contact & case details</summary>
                    <dl className="matter-page__contact-grid matter-page__contact-grid--details">
                    <div>
                      <dt>File type</dt>
                      <dd>{clientDetail ? CLIENT_MATTER_TYPE_LABELS[resolveClientMatterType(clientDetail)] : "—"}</dd>
                    </div>
                    {clientDetail && formatMatterCaseCaption(clientDetail) ? (
                      <div className="matter-page__contact-grid-span">
                        <dt>Case</dt>
                        <dd>{formatMatterCaseCaption(clientDetail)}</dd>
                      </div>
                    ) : null}
                    {clientDetail && formatClientCaseTypeLabel(clientDetail.caseType, clientDetail.caseTypeOther) ? (
                      <div>
                        <dt>Case type</dt>
                        <dd>{formatClientCaseTypeLabel(clientDetail.caseType, clientDetail.caseTypeOther)}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Role in case</dt>
                      <dd>{displayValue(caseRole)}</dd>
                    </div>
                    <div>
                      <dt>Case no.</dt>
                      <dd>{displayValue(billingClient.caseNumber)}</dd>
                    </div>
                    {clientDetail?.courtPending?.trim() ? (
                      <div className="matter-page__contact-grid-span">
                        <dt>Court</dt>
                        <dd>{displayValue(clientDetail.courtPending)}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Email</dt>
                      <dd>{displayValue(billingClient.email)}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{displayValue(billingClient.phone)}</dd>
                    </div>
                    <div>
                      <dt>Next follow-up</dt>
                      <dd>{displayValue(billingClient.nextFollowUp)}</dd>
                    </div>
                    {clientDetail?.birthday ? (
                      <div>
                        <dt>Birthday</dt>
                        <dd>{formatBirthdayDisplay(clientDetail.birthday)}</dd>
                      </div>
                    ) : null}
                    {clientDetail && showPsychologistFields(clientDetail) ? (
                      <>
                        <div>
                          <dt>Psychologist</dt>
                          <dd>{displayValue(clientDetail.psychologistName)}</dd>
                        </div>
                        <div>
                          <dt>Psychologist contact</dt>
                          <dd>{displayValue(clientDetail.psychologistPhone)}</dd>
                        </div>
                        <div>
                          <dt>Psychologist address</dt>
                          <dd>{displayValue(clientDetail.psychologistAddress)}</dd>
                        </div>
                      </>
                    ) : null}
                    </dl>
                  </details>
                </>
              ) : (
                <div className="client-matter-panel__stats">
                  <div className="client-matter-panel__stat">
                    <span className="client-matter-panel__stat-label">Open tasks</span>
                    <span className="client-matter-panel__stat-value">{openTasks}</span>
                  </div>
                  <div className="client-matter-panel__stat">
                    <span className="client-matter-panel__stat-label">Open events</span>
                    <span className="client-matter-panel__stat-value">{openEvents}</span>
                  </div>
                  <div className="client-matter-panel__stat client-matter-panel__stat--wide">
                    <span className="client-matter-panel__stat-label">Linked cases</span>
                    <span className="client-matter-panel__stat-value">
                      {clientLabels.length > 0 ? clientLabels.join(" · ") : "—"}
                    </span>
                  </div>
                </div>
              )}
            </header>

            <MatterPageSectionNav billingAccess={billingAccess} pendingCount={pendingCount} />

            {walkInHighlight ? (
              <section className="matter-walkin-success no-print" role="status">
                <div className="matter-walkin-success__icon" aria-hidden>
                  ✓
                </div>
                <div className="matter-walkin-success__body">
                  <p className="matter-walkin-success__eyebrow">Walk-in promoted</p>
                  <p className="matter-walkin-success__title">
                    {profileTitle} is now on the Master List
                  </p>
                  <p className="matter-walkin-success__text">
                    Walk-in {walkInHighlight} became matter {matterCode}. Consultation history is in the timeline
                    section
                    {billingAccess
                      ? " — finish intake, then work through case tasks and billing below."
                      : "."}
                  </p>
                </div>
              </section>
            ) : null}

            {showIntakeChecklist && billingAccess && clientDetail ? (
              <MatterIntakeChecklist
                matterCode={matterCode}
                profile={clientDetail}
                tasks={tasks}
                timeline={timeline}
                                onDismiss={dismissIntakeChecklist}
              />
            ) : null}

            <section id="matter-work" className="matter-page__flow scroll-mt-3">
              <div className="matter-page__flow-head">
                <h2 className="matter-page__flow-title">Case work</h2>
                <p className="matter-page__flow-lede">
                  Hearings, filing prep, and open tasks — start here for day-to-day work on this matter.
                </p>
              </div>

              {billingClient && billingAccess ? (
                <MatterNextActionStrip
                  billingClient={billingClient}
                  ledgerEntries={ledgerEntries}
                  pendingEvents={pendingEvents}
                  openTasks={openTasks}
                  onBillingSection={(section) => goToBillingSection(section)}
                  onScrollToTasks={scrollToTasks}
                  onJumpToItem={handleMatterJump}
                />
              ) : null}

              {billingAccess ? (
                <MatterHearingLifecyclePanel
                  events={events}
                  clientCode={billingCode || matterCode}
                  busy={busy || actionBusy}
                  onStatus={(msg, err) => setStatusMsg(err ? `⚠ ${msg}` : msg)}
                  onRefresh={load}
                  onDraftCharge={handleDraftCharge}
                />
              ) : null}

              <MatterPendingSection
                pendingTasks={pendingTasks}
                pendingCount={pendingCount}
                onViewAll={scrollToTasks}
                {...itemActionProps}
              />

              <div id="matter-tasks" className="client-matter-panel__columns matter-page__columns">
                <MatterItemsColumn
                  title="Tasks"
                  items={tasks}
                  openCount={openTasks}
                  primaryLabel={primaryLabel}
                  {...itemActionProps}
                />
                <MatterItemsColumn
                  title="Hearings & events"
                  items={events}
                  openCount={openEvents}
                  primaryLabel={primaryLabel}
                  emptyTitle="No events"
                  {...itemActionProps}
                />
              </div>
            </section>

            {billingClient && clientDetail && billingAccess ? (
              <section id="matter-billing" className="matter-page__flow scroll-mt-3">
                <div className="matter-page__flow-head">
                  <h2 className="matter-page__flow-title">Billing & documents</h2>
                  <p className="matter-page__flow-lede">
                    Post charges and payments, send SOA or acknowledgment receipts, draft correspondence on
                    letterhead, and share payment links.
                  </p>
                </div>

                <MatterStaffActions
                  activeSection={billingSection}
                  onSelect={(section) => goToBillingSection(section)}
                  correspondenceHref={correspondenceHref(clientDetail.code)}
                />

                <div className="matter-billing-workspace matter-billing-workspace--stagger space-y-4">
                <MatterInlineLedger
                  clientCode={clientDetail.code}
                  chargeCategories={chargeCategories}
                  paymentMethods={paymentMethods}
                  busy={busy}
                  initialMode="charge"
                  focused={billingSection === "add"}
                  chargeDraft={chargeDraft}
                  onChargeDraftApplied={() => setChargeDraft(null)}
                  onStatus={(msg, err) => setStatusMsg(err ? `⚠ ${msg}` : msg)}
                  onSaved={() => void refreshBillingData()}
                />

                <MatterLedgerHistory
                  clientCode={clientDetail.code}
                  entries={ledgerEntries}
                  busy={busy}
                  readOnly
                  onBusy={setActionBusy}
                  onStatus={(msg, err) => setStatusMsg(err ? `⚠ ${msg}` : msg)}
                  onSaved={() => void refreshBillingData()}
                />

                <section
                  id="matter-billing-documents"
                  className={`card matter-billing-section no-print scroll-mt-3 ${
                    billingSection === "documents" ? "matter-billing-section--focus" : ""
                  }`}
                >
                  <p className="matter-billing-section__step">Step 3</p>
                  <h2 className="matter-billing-section__title">Send SOA or acknowledgment receipt</h2>
                  <p className="matter-billing-section__help mb-3">
                    Email a statement of account (SOA) or issue an acknowledgment receipt (AR) for a payment.
                  </p>
                  <DocumentsPanel
                    clientCode={clientDetail.code}
                    clientName={clientDetail.name}
                    caseTitle={clientDetail.caseTitle}
                    clientEmail={clientDetail.email}
                    clientBalance={clientDetail.balance}
                    preferredGreeting={clientDetail.preferredGreeting}
                    paymentMethods={paymentMethods}
                    onBusy={() => undefined}
                    onStatus={(msg, err) => setStatusMsg(err ? `⚠ ${msg}` : msg)}
                  />
                </section>

                <section className="card matter-billing-section no-print scroll-mt-3">
                  <p className="matter-billing-section__step">Step 4</p>
                  <h2 className="matter-billing-section__title">Draft correspondence</h2>
                  <p className="matter-billing-section__help mb-3">
                    Demand letters, proposals, reply letters, letter requests, and other firm letters — prefilled with
                    this client&apos;s details on the approved letterhead.
                  </p>
                  <div className="matter-letter-drafter-cta">
                    <SameWindowLink
                      href={correspondenceHref(clientDetail.code)}
                      className="matter-letter-drafter-cta__btn"
                    >
                      <span className="matter-letter-drafter-cta__label">Open Letter Drafter</span>
                      <span className="matter-letter-drafter-cta__arrow" aria-hidden="true">
                        →
                      </span>
                    </SameWindowLink>
                  </div>
                </section>

                {billingClient.balance > 0.005 ? (
                  <PaymentRequestPanel
                    key={`payment-${clientDetail.code}`}
                    clientCode={clientDetail.code}
                    clientName={clientDetail.name}
                    balance={clientDetail.balance}
                    email={clientDetail.email}
                    busy={busy}
                    onStatus={(msg, err) => setStatusMsg(err ? `⚠ ${msg}` : msg)}
                  />
                ) : null}

                <ClientPortalPanel
                  key={`portal-${clientDetail.code}`}
                  clientCode={clientDetail.code}
                  clientName={clientDetail.name}
                  balance={clientDetail.balance}
                  email={clientDetail.email}
                  busy={busy}
                  onStatus={(msg, err) => setStatusMsg(err ? `⚠ ${msg}` : msg)}
                />
                </div>
              </section>
            ) : null}

            {billingClient && billingAccess ? (
              <MatterEconomicsCard
                clientCode={billingClient.code}
                balance={billingClient.balance}
                retainerBalance={billingClient.retainerBalance}
                ledgerEntries={ledgerEntries}
              />
            ) : null}

            <section id="matter-timeline" className="card matter-page__section matter-page__flow scroll-mt-3">
              <div className="client-matter-panel__section-head">
                <h2 className="matter-page__section-title">Matter timeline</h2>
                <span className="client-matter-panel__section-count">
                  {billingAccess ? "Billing, documents, tasks & hearings" : "Tasks & hearings"}
                </span>
              </div>
              <ClientActivityTimeline
                items={timeline}
                loading={timelineLoading}
                enableMatterJump
                onMatterJump={handleMatterJump}
                coloredDots
                showDotLegend
              />
            </section>

            {billingClient && clientDetail && billingAccess ? (
              <MatterAdvancedSettings
                detail={clientDetail}
                ledgerEntries={ledgerEntries}
                busy={busy}
                openOnMount={billingSection === "advanced"}
                autoEdit={wantEditClient && billingSection === "advanced"}
                onBusy={setActionBusy}
                onStatus={(msg, err) => setStatusMsg(err ? `⚠ ${msg}` : msg)}
                onSaved={() => void refreshBillingData()}
                onCodeRenamed={handleClientCodeRenamed}
                onDeleted={handleClientDeleted}
              />
            ) : null}

          </>
        )}

        {!loading ? (
          <section id="matter-print-root" className="matter-print-summary only-print" aria-hidden>
            <FirmPrintLetterhead
              documentType="Matter summary"
              documentTitle={profileTitle}
              documentSubtitle={[billingCode || matterCode, caseLine].filter(Boolean).join(" · ")}
            />
            <dl className="matter-print-summary__stats">
              {billingClient ? (
                <>
                  <div className="matter-print-summary__stat matter-print-summary__stat--balance">
                    <dt>Balance</dt>
                    <dd className="amount-serif">{formatPeso(billingClient.balance)}</dd>
                  </div>
                  <div>
                    <dt>Lawyers</dt>
                    <dd>
                      {displayValue(
                        formatClientAssignedLawyers(
                          billingClient.assignedAttorney,
                          billingClient.coAssignedAttorney
                        )
                      )}
                    </dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt>Open tasks</dt>
                <dd>{openTasks}</dd>
              </div>
              <div>
                <dt>Open events</dt>
                <dd>{openEvents}</dd>
              </div>
            </dl>
            {pendingCount > 0 ? (
              <div className="matter-print-summary__section">
                <h2 className="matter-print-summary__heading">Pending</h2>
                <ul className="matter-print-summary__list">
                  {[...pendingTasks, ...pendingEvents].slice(0, 12).map((item, index) => (
                    <li key={officeItemKey(item, index)}>
                      {item.date ? `${item.date} — ` : ""}
                      {item.clientCase}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {timeline.length > 0 ? (
              <div className="matter-print-summary__section">
                <h2 className="matter-print-summary__heading">Recent activity</h2>
                <ul className="matter-print-summary__list">
                  {timeline.slice(0, 15).map((item) => (
                    <li key={item.id}>
                      {item.date} — {item.title}
                      {item.subtitle ? ` (${item.subtitle})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="matter-print-summary__foot">
              Printed {new Date().toLocaleString()} · Hernandez &amp; Associates Law Office
            </p>
          </section>
        ) : null}
      </div>

      {clientDetail && billingAccess ? (
        <BirthdayGreetingDialog
          open={birthdayDialogOpen}
          onClose={() => setBirthdayDialogOpen(false)}
          clientCode={clientDetail.code}
          clientName={clientDetail.name || clientDetail.code}
          clientEmail={clientDetail.email}
          birthdayGreetingSent={clientDetail.birthdayGreetingSent}
          busy={actionBusy}
          onBusy={setActionBusy}
          onSent={() => void refreshBillingData()}
          onStatus={(msg, err) => setStatusMsg(err ? `⚠ ${msg}` : msg)}
        />
      ) : null}
    </FirmWorkspaceShell>
    </ClientMatterProvider>
    </>
  );
}

function MatterLabelSync({
  code,
  billingCode,
  label,
  headerLabel
}: {
  code: string;
  billingCode: string | null;
  label: string;
  headerLabel: string;
}) {
  const matter = useClientMatter();
  const setMatterLabel = matter?.setMatterLabel;
  const setMatterHeaderLabel = matter?.setMatterHeaderLabel;
  const activeCode = matter?.activeCode;
  const syncedRef = useRef<{ code: string; label: string; headerLabel: string } | null>(null);

  useEffect(() => {
    syncedRef.current = null;
  }, [code]);

  useEffect(() => {
    const trimmed = label.trim();
    const trimmedHeader = headerLabel.trim();
    if (!trimmed || !setMatterLabel || activeCode !== code) return;
    if (
      billingCode &&
      billingCode.trim().toUpperCase() !== code.trim().toUpperCase() &&
      !billingClientMatchesMatterCode(code, { code: billingCode, name: trimmed, caseTitle: "" })
    ) {
      return;
    }
    if (
      syncedRef.current?.code === code &&
      syncedRef.current.label === trimmed &&
      syncedRef.current.headerLabel === trimmedHeader
    ) {
      return;
    }
    syncedRef.current = { code, label: trimmed, headerLabel: trimmedHeader };
    setMatterLabel(trimmed);
    if (setMatterHeaderLabel && trimmedHeader) setMatterHeaderLabel(trimmedHeader);
  }, [code, billingCode, label, headerLabel, activeCode, setMatterLabel, setMatterHeaderLabel]);

  return null;
}

function MatterPageSectionNav({
  billingAccess,
  pendingCount
}: {
  billingAccess: boolean;
  pendingCount: number;
}) {
  return (
    <nav className="matter-page__nav no-print" aria-label="Matter sections">
      <a href="#matter-work" className="matter-page__nav-link">
        Case work
        {pendingCount > 0 ? <span className="matter-page__nav-badge">{pendingCount}</span> : null}
      </a>
      {billingAccess ? (
        <a href="#matter-billing" className="matter-page__nav-link">
          Billing
        </a>
      ) : null}
      <a href="#matter-timeline" className="matter-page__nav-link">
        Timeline
      </a>
      {billingAccess ? (
        <a href="#matter-advanced-settings" className="matter-page__nav-link">
          Settings
        </a>
      ) : null}
    </nav>
  );
}

function MatterPendingSection({
  pendingTasks,
  pendingCount,
  onViewAll,
  allItems,
  togglingKey,
  onToggleDone,
  onSetStatus,
  onCourtConfirmed,
  onMarkSubmitted,
  onConfirmParentFiled,
  onTogglePrepChecklistItem,
  onMutatePrepChecklistItem,
  onCreatePrepChecklist,
  onInitializePrepChecklist,
  prepChecklistCreatingKey,
  viewerStaffName,
  viewerPrepRole,
  roster = []
}: {
  pendingTasks: OfficeItem[];
  pendingCount: number;
  onViewAll: () => void;
} & MatterItemActionProps) {
  return (
    <section className="card matter-page__pending">
      <div className="client-matter-panel__section-head">
        <h3 className="matter-page__section-title">Needs attention</h3>
        <span className="client-matter-panel__section-count">
          {pendingCount > 0
            ? `${pendingCount} open task${pendingCount === 1 ? "" : "s"}`
            : "Nothing open right now"}
        </span>
      </div>

      {pendingCount === 0 ? (
        <EmptyState
          compact
          title="Nothing open"
          message="There are no pending tasks for this case. Hearings and events are listed below."
        />
      ) : (
        <div className="matter-page__pending-groups">
          <div className="matter-page__pending-group">
            <ul className="my-work-list my-work-panel--elegant client-matter-panel__items">
              {pendingTasks.map((item, index) => {
                const key = officeItemKey(item, index);
                return (
                  <ItemCard
                    key={key}
                    id={matterItemAnchorId(item)}
                    className="matter-item-anchor scroll-mt-6"
                    item={item}
                    allItems={allItems}
                    toggling={togglingKey === matterItemActionKey(item)}
                    onToggleDone={onToggleDone}
                    onSetStatus={onSetStatus}
                    onCourtConfirmed={onCourtConfirmed}
                    onMarkSubmitted={onMarkSubmitted}
                    onConfirmParentFiled={onConfirmParentFiled}
                    onTogglePrepChecklistItem={onTogglePrepChecklistItem}
                    onMutatePrepChecklistItem={onMutatePrepChecklistItem}
                    onCreatePrepChecklist={onCreatePrepChecklist}
                    onInitializePrepChecklist={onInitializePrepChecklist}
                    prepChecklistCreating={prepChecklistCreatingKey === matterItemActionKey(item)}
                    viewerStaffName={viewerStaffName}
                    viewerPrepRole={viewerPrepRole}
                    roster={roster}
                  />
                );
              })}
            </ul>
          </div>

          <div className="matter-page__pending-foot">
            <button type="button" className="cross-system-link" onClick={onViewAll}>
              View all tasks &amp; hearings →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MatterItemsColumn({
  title,
  items,
  openCount,
  primaryLabel,
  emptyTitle,
  allItems,
  togglingKey,
  onToggleDone,
  onSetStatus,
  onCourtConfirmed,
  onMarkSubmitted,
  onConfirmParentFiled,
  onTogglePrepChecklistItem,
  onMutatePrepChecklistItem,
  onCreatePrepChecklist,
  onInitializePrepChecklist,
  prepChecklistCreatingKey,
  viewerStaffName,
  viewerPrepRole,
  roster = []
}: {
  title: string;
  items: OfficeItem[];
  openCount: number;
  primaryLabel: string;
  emptyTitle?: string;
} & MatterItemActionProps) {
  return (
    <details className="matter-items-column card matter-page__section">
      <summary className="matter-items-column__summary">
        <span className="matter-items-column__summary-main">
          <span className="matter-items-column__title">{title}</span>
          <span className="matter-items-column__counts">
            {items.length} total · {openCount} open
          </span>
        </span>
      </summary>
      <div className="matter-items-column__body">
        {items.length === 0 ? (
          <EmptyState title={emptyTitle || `No ${title.toLowerCase()}`} message={`Nothing under ${primaryLabel} yet.`} />
        ) : (
          <ul className="my-work-list my-work-panel--elegant client-matter-panel__items">
            {items.map((item, index) => {
              const key = officeItemKey(item, index);
              return (
                <ItemCard
                  key={key}
                  id={matterItemAnchorId(item)}
                  className="matter-item-anchor scroll-mt-6"
                  item={item}
                  allItems={allItems}
                  toggling={togglingKey === matterItemActionKey(item)}
                  onToggleDone={onToggleDone}
                  onSetStatus={onSetStatus}
                  onCourtConfirmed={onCourtConfirmed}
                  onMarkSubmitted={onMarkSubmitted}
                  onConfirmParentFiled={onConfirmParentFiled}
                  onTogglePrepChecklistItem={onTogglePrepChecklistItem}
                  onMutatePrepChecklistItem={onMutatePrepChecklistItem}
                  onCreatePrepChecklist={onCreatePrepChecklist}
                  onInitializePrepChecklist={onInitializePrepChecklist}
                  prepChecklistCreating={prepChecklistCreatingKey === matterItemActionKey(item)}
                  viewerStaffName={viewerStaffName}
                  viewerPrepRole={viewerPrepRole}
                  roster={roster}
                />
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
