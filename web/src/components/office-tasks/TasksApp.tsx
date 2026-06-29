"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { EmployeeTrackerView } from "@/components/office-tasks/EmployeeTrackerView";
import { MyWorkTodayFeed } from "@/components/office-tasks/MyWorkTodayFeed";
import { TodayWorkStatGrid } from "@/components/office-tasks/TodayWorkStatGrid";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import type { ItemStatusOptions, ItemStatusUpdate } from "@/lib/office-tasks/status";
import { resolveStatusLabel } from "@/lib/office-tasks/status";
import { MonthlyCalendarView } from "@/components/office-tasks/MonthlyCalendarView";
import { SearchView } from "@/components/office-tasks/SearchView";
import { MyWorkBillingStrip } from "@/components/MyWorkBillingStrip";
import { FirmWorkspaceShell } from "@/components/FirmWorkspaceShell";
import { ToolsPanel } from "@/components/office-tasks/ToolsPanel";
import { WeeklyPlannerView } from "@/components/office-tasks/WeeklyPlannerView";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import { computeTodayCounts, filterTodayLists } from "@/lib/office-tasks/today-lists";
import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import type { EmployeeStat } from "@/lib/office-tasks/schedule";
import { getWeekDates } from "@/lib/office-tasks/schedule";
import { AddEventForm, AddTaskForm, type EntryFormOptions, type SavedEventInfo } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { CorrespondenceDraftPanel } from "@/components/CorrespondenceDraftPanel";
import { CalendarSyncStatus } from "@/components/CalendarSyncStatus";
import { FirmPrintLetterhead } from "@/components/FirmPrintLetterhead";
import { NavTabsScroll } from "@/components/NavTabsScroll";
import { UndoBar } from "@/components/UndoBar";
import { useUndoBar } from "@/hooks/useUndoBar";
import { EmptyState, ViewHero } from "@/components/office-tasks/PremiumUI";
import { SmartLoadEmptyState } from "@/components/SmartLoadEmptyState";
import { PageTransition } from "@/components/PageTransition";
import { TasksWorkSkeleton, CalendarViewSkeleton, AllItemsSkeleton } from "@/components/Skeleton";
import { SheetsAccessErrorPanel } from "@/components/SheetsAccessErrorPanel";
import { TaskEventChooser } from "@/components/office-tasks/TaskEventChooser";
import { formatSheetsAccessHint, type SheetsAccessHint } from "@/lib/sheets-access-help";
import { bindWorkspaceTabShortcuts, buildTabShortcutHelp } from "@/lib/workspace-tab-shortcuts";
import { fetchJson } from "@/lib/fetch-json";
import { formatDisplayDate, officeItemKey, todayYmd } from "@/lib/office-tasks/schedule";
import { openPrintPreview } from "@/lib/print-preview";
import { formatMyWorkListText } from "@/lib/my-work-share-list";
import { sharePlainText } from "@/lib/share-plain-text";
import { TaskHistoryView } from "@/components/office-tasks/TaskHistoryView";
import { StaffRemindersPanel } from "@/components/office-tasks/StaffRemindersPanel";
import type { TaskActivityEntry } from "@/lib/office-tasks/sheets/activity-log";
import { ClientMatterProvider } from "@/components/office-tasks/ClientMatterPanel";
import { setLastWorkspace } from "@/lib/office-hub/storage";
import { getSavedTasksTab, saveTasksTab, type SavedTasksTab } from "@/lib/staff-prefs";
import { TASKS_TAB_LABELS, isAllowedTasksTab, resolveNavUserProfile, tasksNavTabsForUser } from "@/lib/workspace-labels";
import { useFirmStatusReport } from "@/hooks/useFirmStatusReport";
import { formatSuccessReport } from "@/lib/firm-status-report";
import { BillingTabGuide, BillingTabGuideText, TabPageHeader } from "@/components/BillingTabGuide";
import { TabPageBody, TabPickerCard } from "@/components/TabPageLayout";
import type { EventFormInput } from "@/lib/office-tasks/sheets/tasks";
import { buildEventFormInputFromFormData, validateEventFormInput, type EventAddKind, EVENT_ADD_KIND_LABELS } from "@/lib/office-tasks/event-form-utils";
import { EventSegmentedControl } from "@/components/office-tasks/EventSegmentedControl";
import {
  fetchEventsDiagnostics,
  formatEventsDiagnosticsSummary
} from "@/lib/office-tasks/events-diagnostics";
import { mergeTaskWorkDetails, resolveTaskType, validateTaskFormInput } from "@/lib/office-tasks/task-form-utils";
import { FilingFollowUpAlertBar } from "@/components/office-tasks/FilingFollowUpAlertBar";
import { listFilingDeadlineAlerts } from "@/lib/office-tasks/filing-confirmation";
import {
  prepChecklistCreateUrl,
  prepChecklistInitializeUrl
} from "@/lib/office-tasks/prep-checklist-actions";
import { SameWindowLink } from "@/components/SameWindowLink";
import { MyWorkScopeToggle } from "@/components/office-tasks/MyWorkScopeToggle";
import { LiaisonConfidentialPanel } from "@/components/office-tasks/LiaisonConfidentialPanel";
import { excludeLiaisonConfidentialItems } from "@/lib/office-tasks/liaison-confidential";
import { canViewLiaisonTab } from "@/lib/app-access";
import { filterItemsForMyWork } from "@/lib/office-tasks/my-work-filter";
import { applyEventJoinLinkPatch, type EventScheduleEmailSentPatch } from "@/lib/office-tasks/event-join-link";
import { getSavedMyWorkScope, saveMyWorkScope, type MyWorkScope } from "@/lib/my-work-scope";
import type { ClientSummary, WalkInClient } from "@/lib/gl-config";
import { resolveSessionStaffName } from "@/lib/staff-session";
import { resolvePrepRoleFromSession } from "@/lib/office-tasks/prep-workload-view";
import { DuplicateEntryWarningDialog } from "@/components/office-tasks/DuplicateEntryWarningDialog";
import {
  findDuplicateEvent,
  findDuplicateTask,
  type DuplicateEntryMatch
} from "@/lib/office-tasks/duplicate-entry-check";
import { WorkspaceIntroDialog } from "@/components/WorkspaceIntroDialog";
import { getTasksIntroContent } from "@/lib/workspace-intro-content";
import { clearWorkspaceIntroSeen, hasSeenWorkspaceIntro, markWorkspaceIntroSeen } from "@/lib/workspace-intro-storage";

const LETTER_WALKIN_PREFIX = "walkin:";

type Props = Record<string, never>;

type Counts = {
  tasksDueToday: number;
  eventsToday: number;
  deadlinesToday: number;
  overdueOpen: number;
  dueThisWeek: number;
  waitingAndStarted: number;
  completedToday: number;
};

type HomeData = {
  counts: Counts;
  lists: {
    overdue: OfficeItem[];
    eventsToday: OfficeItem[];
    deadlinesToday: OfficeItem[];
    tasksDueToday: OfficeItem[];
    dueThisWeek: OfficeItem[];
    waitingAndStarted: OfficeItem[];
    doneToday: OfficeItem[];
  };
  employees: string[];
  employeeDirectory: EmployeeRecord[];
  options: EntryFormOptions;
  searchResults: OfficeItem[];
  items: OfficeItem[];
  today: string;
  weekStart: string;
  employeeStats: EmployeeStat[];
  spreadsheetId?: string;
  tasksAppsScriptConfigured?: boolean;
  tasksSpreadsheetFallback?: boolean;
  isAdmin?: boolean;
  canViewLiaisonConfidential?: boolean;
};

type Tab =
  | "today"
  | "calendar"
  | "week"
  | "team"
  | "history"
  | "add-task"
  | "add-event"
  | "all-items"
  | "correspondence"
  | "tools"
  | "liaison";

type PendingDuplicateEntry = {
  kind: "task" | "event";
  form: HTMLFormElement;
  clientCase: string;
};

type IntroState = "pending" | "open" | "closed";

export function TasksApp() {
  const { data: session } = useSession();
  const router = useRouter();
  const [introState, setIntroState] = useState<IntroState>("pending");
  const [tab, setTab] = useState<Tab>("today");
  const [data, setData] = useState<HomeData | null>(null);
  const [lastLoadStatus, setLastLoadStatus] = useState<number | undefined>(undefined);
  const [lastLoadError, setLastLoadError] = useState<string | null>(null);
  const {
    message: statusMsg,
    variant: statusVariant,
    reportProcessing,
    reportSuccess,
    reportError,
    reportWarn,
    clearUnlessProcessing,
    onStatus
  } = useFirmStatusReport();

  function showStatus(message: string, isError = false) {
    if (isError) reportError(message);
    else reportSuccess(message);
  }

  const [busy, setBusy] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [doneOpenPulse, setDoneOpenPulse] = useState(0);
  const [waitingOpenPulse, setWaitingOpenPulse] = useState(0);
  const [activity, setActivity] = useState<TaskActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [eventFormKey, setEventFormKey] = useState(0);
  const deleteUndo = useUndoBar<ItemSummary>();
  const [eventAddKind, setEventAddKind] = useState<EventAddKind>("appearances");
  const [taskFormKey, setTaskFormKey] = useState(0);
  const [diagBusy, setDiagBusy] = useState(false);
  const [myWorkScope, setMyWorkScope] = useState<MyWorkScope>("mine");
  const [letterClients, setLetterClients] = useState<ClientSummary[]>([]);
  const [letterWalkIns, setLetterWalkIns] = useState<WalkInClient[]>([]);
  const [letterClientCode, setLetterClientCode] = useState("");
  const [letterBusy, setLetterBusy] = useState(false);
  const [quickAddKind, setQuickAddKind] = useState<"task" | "event" | null>(null);
  const [sheetsAccessHint, setSheetsAccessHint] = useState<SheetsAccessHint | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    match: DuplicateEntryMatch;
    pending: PendingDuplicateEntry;
  } | null>(null);
  const addTabRef = useRef<Tab | null>(null);

  useEffect(() => {
    const saved = getSavedMyWorkScope();
    if (saved) setMyWorkScope(saved);
  }, []);

  const handleMyWorkScopeChange = useCallback((scope: MyWorkScope) => {
    setMyWorkScope(scope);
    saveMyWorkScope(scope);
  }, []);

  const billingAccess = session?.user?.billingAccess !== false;
  const navProfile = resolveNavUserProfile({
    email: session?.user?.email,
    billingAccess,
    secretaryNav: session?.user?.secretaryNav
  });
  const email = session?.user?.email?.trim() || "";
  const sessionDisplayName = session?.user?.displayName || session?.user?.name || "";
  const isAdminUser = session?.user?.isAdmin === true;
  const canViewLiaisonConfidentialEarly = canViewLiaisonTab({
    email,
    staffName: sessionDisplayName,
    isAdmin: isAdminUser
  });
  const introOpen = introState === "open";
  const introGate = introState !== "closed";

  useEffect(() => {
    if (hasSeenWorkspaceIntro("tasks", email)) {
      setIntroState("closed");
    } else {
      setIntroState("open");
    }
  }, [email]);

  const selectTab = useCallback(
    (next: Tab) => {
      const allowed = isAllowedTasksTab(next, billingAccess, navProfile, {
        canViewLiaisonTab: canViewLiaisonConfidentialEarly
      })
        ? next
        : "today";
      setTab(allowed);
      saveTasksTab(allowed);
    },
    [billingAccess, navProfile, canViewLiaisonConfidentialEarly]
  );

  async function runEventsSheetCheck() {
    setDiagBusy(true);
    reportProcessing("Checking Office Tasks spreadsheet…");
    try {
      const json = await fetchEventsDiagnostics();
      reportSuccess(formatEventsDiagnosticsSummary(json));
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Events sheet check failed.");
    } finally {
      setDiagBusy(false);
    }
  }

  function itemActionPayload(item: ItemSummary) {
    return {
      source: item.source,
      rowNumber: item.rowNumber,
      itemId: item.id,
      clientCase: item.clientCase
    };
  }

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const { ok, data: json } = await fetchJson<{ activity: TaskActivityEntry[]; error?: string }>(
        "/api/tasks/activity?limit=100",
        { timeoutMs: 60_000 }
      );
      if (!ok) throw new Error(json.error || "Could not load history.");
      setActivity(json.activity || []);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Could not load history.");
    } finally {
      setActivityLoading(false);
    }
  }, [reportError]);

  useEffect(() => {
    setLastWorkspace("tasks");
  }, []);

  useEffect(() => {
    if (!billingAccess) return;
    let cancelled = false;
    void Promise.all([
      fetch("/api/clients").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/walk-ins?status=active").then((res) => (res.ok ? res.json() : null))
    ])
      .then(([clientsJson, walkInsJson]) => {
        if (cancelled) return;
        if (clientsJson?.clients) setLetterClients(clientsJson.clients);
        if (walkInsJson?.walkIns) setLetterWalkIns(walkInsJson.walkIns);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [billingAccess]);

  const selectedLetterWalkIn = useMemo(() => {
    if (!letterClientCode.startsWith(LETTER_WALKIN_PREFIX)) return null;
    const walkInId = letterClientCode.slice(LETTER_WALKIN_PREFIX.length);
    return letterWalkIns.find((walkIn) => walkIn.walkInId === walkInId) || null;
  }, [letterClientCode, letterWalkIns]);

  const selectedLetterClient = useMemo(
    () =>
      letterClientCode.startsWith(LETTER_WALKIN_PREFIX)
        ? undefined
        : letterClients.find((client) => client.code === letterClientCode),
    [letterClientCode, letterClients]
  );

  useEffect(() => {
    if (tab === "history") loadActivity();
  }, [tab, loadActivity]);

  const scrollToTodaySection = useCallback((sectionId: string) => {
    if (sectionId === "today-done") setDoneOpenPulse((n) => n + 1);
    if (sectionId === "today-waiting") setWaitingOpenPulse((n) => n + 1);

    window.requestAnimationFrame(() => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("today-section--highlight");
      window.setTimeout(() => el.classList.remove("today-section--highlight"), 1400);
    });
  }, []);

  const load = useCallback(async (q?: string, fresh = false, options?: { keepStatus?: boolean }) => {
    setReloading(true);
    if (!options?.keepStatus) clearUnlessProcessing();
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (fresh) params.set("fresh", "1");
      const query = params.toString();
      const url = query ? `/api/tasks/home?${query}` : "/api/tasks/home";
      const { ok, status, data: json } = await fetchJson<HomeData & { error?: string }>(url, {
        timeoutMs: 90_000
      });
      if (!ok) {
        setLastLoadStatus(status);
        if (status === 401) {
          throw new Error("Session expired — sign out and sign in again at /login.");
        }
        if (status === 429) {
          const quotaMsg =
            json.error ||
            "Google Sheets read limit reached. Wait about 60 seconds, then use Reload once.";
          setSheetsAccessHint(formatSheetsAccessHint(quotaMsg, email));
          setLastLoadError(quotaMsg);
          reportWarn(quotaMsg);
          setLastLoadStatus(status);
          setData((prev) => prev ?? null);
          return { data: null, quotaBlocked: true };
        }
        throw new Error(json.error || `Load failed (${status}).`);
      }
      setData(json);
      setLastLoadStatus(undefined);
      setLastLoadError(null);
      setSheetsAccessHint(null);
      if (!options?.keepStatus) clearUnlessProcessing();
      return { data: json, quotaBlocked: false };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load data.";
      setSheetsAccessHint(formatSheetsAccessHint(message, email));
      setLastLoadError(message);
      setData(null);
      setLastLoadStatus(undefined);
      reportError(message);
      return { data: null, quotaBlocked: false };
    } finally {
      setReloading(false);
    }
  }, [clearUnlessProcessing, email, reportError, reportWarn]);

  useEffect(() => {
    if (tab !== "add-task" && tab !== "add-event") {
      setQuickAddKind(null);
      addTabRef.current = null;
      return;
    }
    if (addTabRef.current && addTabRef.current !== tab) {
      setQuickAddKind(null);
    }
    addTabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q")?.trim() || "";
    const clientParam = params.get("client")?.trim().toUpperCase();
    const eventKindParam = params.get("eventKind");

    if (clientParam) setLetterClientCode(clientParam);
    if (eventKindParam === "filings" || eventKindParam === "appearances") {
      setEventAddKind(eventKindParam);
    }
    if (q) setSearchQ(q);

    void load(q || undefined, false);

    if (introGate) return;

    const tabParam = params.get("tab");
    if (tabParam && isAllowedTasksTab(tabParam as Tab, billingAccess, navProfile, { canViewLiaisonTab: canViewLiaisonConfidentialEarly })) {
      selectTab(tabParam as Tab);
    } else {
      const saved = getSavedTasksTab();
      if (saved && isAllowedTasksTab(saved, billingAccess, navProfile, { canViewLiaisonTab: canViewLiaisonConfidentialEarly })) selectTab(saved);
      else selectTab("today");
    }
  }, [billingAccess, introGate, load, navProfile, selectTab, canViewLiaisonConfidentialEarly]);

  function itemActionKey(item: ItemSummary) {
    return officeItemKey(item);
  }

  async function toggleItemDone(item: ItemSummary, done: boolean) {
    setTogglingKey(itemActionKey(item));
    reportProcessing(done ? "Marking done…" : "Reopening…");
    try {
      const res = await fetch("/api/tasks/items/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...itemActionPayload(item), done })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      reportSuccess(formatSuccessReport(json.message || "Item updated."));
      await load(searchQ || undefined);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function updateItemStatus(item: ItemSummary, status: ItemStatusUpdate, options?: ItemStatusOptions) {
    setTogglingKey(itemActionKey(item));
    reportProcessing(status === "restore" ? "Restoring…" : `Setting ${status}…`);
    const shouldHighlightWaiting = status === "Waiting" || status === "Started";

    try {
      const res = await fetch("/api/tasks/items/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...itemActionPayload(item), status, note: options?.note })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");

      const savedStatus =
        typeof json.status === "string" ? json.status : resolveStatusLabel(item.source, status);
      const savedRemarks = typeof json.remarks === "string" ? json.remarks : item.remarks;

      setData((prev) => {
        if (!prev) return prev;
        const items = prev.items.map((row) =>
          row.source === item.source && row.rowNumber === item.rowNumber
            ? { ...row, status: savedStatus, done: false, remarks: savedRemarks }
            : row
        );
        return {
          ...prev,
          items,
          counts: computeTodayCounts(items),
          lists: filterTodayLists(items)
        };
      });

      reportSuccess(
        shouldHighlightWaiting
          ? formatSuccessReport(json.message || "Status updated.", "See “Don’t forget to follow up” below")
          : formatSuccessReport(json.message || "Status updated.")
      );

      if (shouldHighlightWaiting) {
        scrollToTodaySection("today-waiting");
      } else {
        await load(searchQ || undefined);
      }
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function updateItemNextAction(item: ItemSummary, nextAction: string) {
    setTogglingKey(itemActionKey(item));
    reportProcessing("Saving next action…");
    try {
      const res = await fetch("/api/tasks/items/next-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...itemActionPayload(item),
          nextAction
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      reportSuccess(formatSuccessReport(json.message || "Next action saved."));
      await load(searchQ || undefined);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function togglePrepChecklistItem(item: ItemSummary, itemIndex: number, checked: boolean) {
    setTogglingKey(itemActionKey(item));
    try {
      const res = await fetch("/api/tasks/items/prep-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...itemActionPayload(item),
          itemIndex,
          checked
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      await load(searchQ || undefined, false, { keepStatus: true });
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Could not update checklist.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function mutatePrepChecklistItem(item: ItemSummary, mutation: PrepChecklistMutation) {
    setTogglingKey(itemActionKey(item));
    try {
      const res = await fetch("/api/tasks/items/prep-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...itemActionPayload(item),
          ...mutation
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      await load(searchQ || undefined, false, { keepStatus: true });
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Could not update checklist.");
    } finally {
      setTogglingKey(null);
    }
  }

  const [prepChecklistCreatingKey, setPrepChecklistCreatingKey] = useState<string | null>(null);

  async function createEventPrepChecklist(item: ItemSummary) {
    const key = itemActionKey(item);
    setPrepChecklistCreatingKey(key);
    reportProcessing(item.category === "Hearing" ? "Enabling hearing prep checklist…" : "Creating filing prep checklist…");
    try {
      const res = await fetch(prepChecklistCreateUrl(item as OfficeItem), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemActionPayload(item))
      });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || "Create failed");
      reportSuccess(formatSuccessReport(json.message || "Filing prep checklist created."));
      await load(searchQ || undefined, true);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Could not create prep checklist.");
    } finally {
      setPrepChecklistCreatingKey(null);
    }
  }

  async function initializePrepChecklist(item: ItemSummary) {
    const key = itemActionKey(item);
    setPrepChecklistCreatingKey(key);
    reportProcessing("Enabling interactive checklist…");
    try {
      const res = await fetch(prepChecklistInitializeUrl(item as OfficeItem), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemActionPayload(item))
      });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || "Enable failed");
      reportSuccess(formatSuccessReport(json.message || "Interactive checklist enabled."));
      await load(searchQ || undefined, true);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Could not enable checklist.");
    } finally {
      setPrepChecklistCreatingKey(null);
    }
  }

  async function saveItemEdit(item: EditableItem, payload: Record<string, unknown>) {
    setTogglingKey(itemActionKey(item));
    reportProcessing("Saving changes…");
    try {
      const res = await fetch("/api/tasks/items/edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      reportSuccess(formatSuccessReport(json.message || "Changes saved."));
      await load(searchQ || undefined);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function markCourtConfirmed(item: ItemSummary) {
    setTogglingKey(itemActionKey(item));
    reportProcessing("Marking court confirmed…");
    try {
      const res = await fetch("/api/tasks/items/court-confirmed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemActionPayload(item))
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      reportSuccess(formatSuccessReport(json.message || "Court confirmed."));
      await load(searchQ || undefined);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function resetItemWithDate(item: ItemSummary, newDate: string) {
    setTogglingKey(itemActionKey(item));
    reportProcessing("Resetting with new date…");
    try {
      const res = await fetch("/api/tasks/items/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: item.source,
          rowNumber: item.rowNumber,
          status: "Reset",
          newDate,
          category: item.category,
          hasFilingDeadline: Boolean(item.filingDeadline?.trim())
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Reset failed");
      reportSuccess(formatSuccessReport(json.message || "Reset complete."));
      await load(searchQ || undefined);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function deleteItem(item: ItemSummary) {
    deleteUndo.schedule(
      {
        label: (
          <>
            <strong>{item.id}</strong> ({item.clientCase || "no client"}) will be deleted.
          </>
        ),
        payload: item
      },
      async (target) => {
        setTogglingKey(itemActionKey(target));
        reportProcessing("Deleting…");
        try {
          const res = await fetch("/api/tasks/items/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itemActionPayload(target))
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Delete failed");
          reportSuccess(formatSuccessReport(json.message || "Item deleted."));
          await load(searchQ || undefined);
        } catch (e) {
          reportError(e instanceof Error ? e.message : "Delete failed.");
        } finally {
          setTogglingKey(null);
        }
      }
    );
  }

  async function runMaintenance(action: string) {
    setBusy(true);
    reportProcessing("Working…");
    try {
      if (action === "pullCalendarFromGoogle") {
        const res = await fetch("/api/tasks/calendar/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pull" })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Calendar pull failed");
        reportSuccess(formatSuccessReport(json.message || "Calendar pull complete."));
        await load(searchQ || undefined);
        return;
      }

      const res = await fetch("/api/tasks/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      reportSuccess(formatSuccessReport(json.message || "Done."));
      await load(searchQ || undefined, action === "consolidateSheetRows");
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  function sheetOpenHint(spreadsheetId?: string): string | undefined {
    if (!spreadsheetId) return undefined;
    return `Open spreadsheet → search ${spreadsheetId.slice(0, 8)}…`;
  }

  function warnIfSavedItemMissing(
    savedId: string | undefined,
    refreshed: HomeData | null | undefined,
    spreadsheetId?: string
  ): void {
    if (!savedId || !refreshed) return;
    const found = refreshed.items.some((item) => item.id === savedId);
    if (found) return;
    reportWarn(
      `${savedId} was saved but did not appear after reload — wait 60s and tap Reload, or open the Office Tasks spreadsheet and search for that ID.${
        spreadsheetId ? ` Sheet: …${spreadsheetId.slice(-8)}` : ""
      }`
    );
  }

  async function submitTask(
    form: HTMLFormElement,
    resolvedClientCase: string,
    options?: { skipDuplicateCheck?: boolean }
  ) {
    const fd = new FormData(form);
    const clientCase = resolvedClientCase.trim() || String(fd.get("clientCase") || "").trim();
    if (!clientCase) {
      showStatus("Select or enter a client / case before saving.", true);
      return;
    }

    const createInteractiveChecklist = fd.get("createInteractiveChecklist") === "on";
    const checklistItems = fd
      .getAll("checklistItem")
      .map((value) => String(value).trim())
      .filter(Boolean);
    const interactiveChecklistItems =
      createInteractiveChecklist && checklistItems.length ? checklistItems : undefined;
    const payload = {
      clientCase,
      assignedTo: String(fd.get("assignedTo") || "").trim(),
      dueDate: String(fd.get("dueDate") || ""),
      dueTime: String(fd.get("dueTime") || ""),
      venue: String(fd.get("venue") || ""),
      priority: String(fd.get("priority") || "Medium"),
      taskType: resolveTaskType(String(fd.get("taskType") || "Task"), String(fd.get("taskTypeOther") || "")),
      description: mergeTaskWorkDetails(
        String(fd.get("description") || "").trim(),
        String(fd.get("workNotes") || "").trim(),
        []
      ),
      previousAction: String(fd.get("previousAction") || ""),
      nextAction: String(fd.get("nextAction") || ""),
      remarks: String(fd.get("remarks") || ""),
      status: String(fd.get("status") || "In Progress"),
      reminderDays: Number(fd.get("reminderDays") || 1),
      calendarSync: fd.get("calendarSync") === "on",
      interactiveChecklist: Boolean(interactiveChecklistItems?.length),
      interactiveChecklistItems
    };

    const validationError = validateTaskFormInput({
      ...payload,
      taskType: String(fd.get("taskType") || "Task"),
      taskTypeOther: String(fd.get("taskTypeOther") || "")
    });
    if (validationError) {
      showStatus(validationError, true);
      throw new Error(validationError);
    }

    if (!options?.skipDuplicateCheck) {
      const duplicate = findDuplicateTask(scheduleItems, {
        clientCase,
        taskType: payload.taskType,
        dueDate: payload.dueDate,
        dueTime: payload.dueTime
      });
      if (duplicate) {
        setDuplicateWarning({
          match: duplicate,
          pending: { kind: "task", form, clientCase }
        });
        return;
      }
    }

    reportProcessing("Saving task to spreadsheet…");
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || "Save failed");
      const createdStatus = String(fd.get("status") || "In Progress");
      const savedMessage = formatSuccessReport(
        json.message || "Task saved.",
        clientCase || sheetOpenHint(data?.spreadsheetId)
      );
      form.reset();
      setTaskFormKey((key) => key + 1);
      selectTab("today");
      const refreshed = await load(undefined, true, { keepStatus: true });
      reportSuccess(savedMessage);
      warnIfSavedItemMissing(
        typeof json.taskId === "string" ? json.taskId : undefined,
        refreshed?.data,
        refreshed?.data?.spreadsheetId || data?.spreadsheetId
      );
      if (createdStatus === "Waiting" || createdStatus === "Started") {
        scrollToTodaySection("today-waiting");
      }
    } catch (e) {
      showStatus(e instanceof Error ? e.message : "Save failed.", true);
    } finally {
      setBusy(false);
    }
  }

  async function submitLiaisonConfidentialTask(form: HTMLFormElement, resolvedClientCase: string) {
    const fd = new FormData(form);
    const clientCase = resolvedClientCase.trim() || String(fd.get("clientCase") || "").trim();
    if (!clientCase) {
      showStatus("Select or enter a client / case before saving.", true);
      return;
    }

    const payload = {
      clientCase,
      assignedTo: String(fd.get("assignedTo") || "").trim() || "Liaison",
      dueDate: String(fd.get("dueDate") || ""),
      dueTime: String(fd.get("dueTime") || ""),
      venue: String(fd.get("venue") || ""),
      priority: String(fd.get("priority") || "Medium"),
      taskType: resolveTaskType(String(fd.get("taskType") || "Task"), String(fd.get("taskTypeOther") || "")),
      description: mergeTaskWorkDetails(
        String(fd.get("description") || "").trim(),
        String(fd.get("workNotes") || "").trim(),
        []
      ),
      previousAction: String(fd.get("previousAction") || ""),
      nextAction: String(fd.get("nextAction") || ""),
      remarks: String(fd.get("remarks") || ""),
      status: String(fd.get("status") || "In Progress"),
      reminderDays: Number(fd.get("reminderDays") || 1),
      calendarSync: false,
      liaisonConfidential: true
    };

    const validationError = validateTaskFormInput({
      ...payload,
      taskType: String(fd.get("taskType") || "Task"),
      taskTypeOther: String(fd.get("taskTypeOther") || "")
    });
    if (validationError) {
      showStatus(validationError, true);
      throw new Error(validationError);
    }

    reportProcessing("Saving confidential liaison assignment…");
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await readApiResponse(res);
      if (!res.ok) throw new Error(json.error || "Save failed");
      const savedMessage = formatSuccessReport(
        json.message || "Confidential assignment saved.",
        clientCase || sheetOpenHint(data?.spreadsheetId)
      );
      form.reset();
      setTaskFormKey((key) => key + 1);
      selectTab("liaison");
      await load(undefined, true, { keepStatus: true });
      reportSuccess(savedMessage);
    } catch (e) {
      showStatus(e instanceof Error ? e.message : "Save failed.", true);
    } finally {
      setBusy(false);
    }
  }

  async function confirmParentFiled(task: ItemSummary, parentEvent: ItemSummary) {
    setTogglingKey(itemActionKey(task));
    reportProcessing("Confirming filing and closing follow-up…");
    try {
      const submitRes = await fetch("/api/tasks/items/submitted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemActionPayload(parentEvent))
      });
      const submitJson = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitJson.error || "Could not mark parent event filed.");

      const doneRes = await fetch("/api/tasks/items/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...itemActionPayload(task), done: true })
      });
      const doneJson = await doneRes.json();
      if (!doneRes.ok) throw new Error(doneJson.error || "Could not complete follow-up task.");

      reportSuccess(formatSuccessReport("Parent event marked filed; follow-up task done."));
      await load(searchQ || undefined);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function markEventSubmitted(item: ItemSummary) {
    setTogglingKey(itemActionKey(item));
    reportProcessing("Marking filed / submitted…");
    try {
      const res = await fetch("/api/tasks/items/submitted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemActionPayload(item))
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      reportSuccess(formatSuccessReport(json.message || "Marked submitted."));
      await load(searchQ || undefined);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function saveEventRecord(
    form: HTMLFormElement,
    resolvedClientCase: string,
    options?: { skipDuplicateCheck?: boolean }
  ): Promise<SavedEventInfo | null> {
    const payload: EventFormInput = buildEventFormInputFromFormData(new FormData(form));
    payload.clientCase = resolvedClientCase.trim() || payload.clientCase;

    const validationError = validateEventFormInput(payload);
    if (validationError) {
      showStatus(validationError, true);
      throw new Error(validationError);
    }

    const ptoRows = payload.fromPretrialOrder ? payload.succeedingHearingDates || [] : [];
    if (!options?.skipDuplicateCheck && ptoRows.length === 0) {
      const duplicate = findDuplicateEvent(data?.items || [], {
        clientCase: payload.clientCase,
        category: payload.category,
        eventDate: payload.eventDate,
        filingDeadline: payload.filingDeadline,
        startTime: payload.startTime
      });
      if (duplicate) {
        setDuplicateWarning({
          match: duplicate,
          pending: { kind: "event", form, clientCase: payload.clientCase }
        });
        return null;
      }
    }

    const res = await fetch("/api/tasks/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await readApiResponse(res);
    if (!res.ok) throw new Error(json.error || "Save failed");
    const eventId = typeof json.eventId === "string" ? json.eventId : "";
    const sheetRow = Number(json.sheetRow) || 0;
    if (!eventId || sheetRow < 2) {
      throw new Error("Event saved but could not confirm the new row — try again from the event list.");
    }
    return { eventId, sheetRow, message: json.message };
  }

  async function submitEvent(
    form: HTMLFormElement,
    resolvedClientCase: string,
    options?: { skipDuplicateCheck?: boolean }
  ) {
    reportProcessing("Saving event to spreadsheet…");
    setBusy(true);
    try {
      const payload: EventFormInput = buildEventFormInputFromFormData(new FormData(form));
      payload.clientCase = resolvedClientCase.trim() || payload.clientCase;
      const saved = await saveEventRecord(form, resolvedClientCase, options);
      if (!saved) return;

      const savedDate = payload.eventDate || payload.filingDeadline || "";
      const onToday = savedDate && savedDate === todayYmd();
      const savedMessage =
        savedDate && !onToday
          ? formatSuccessReport(
              saved.message || "Event saved.",
              `Scheduled for ${savedDate} — check Week or Calendar`
            )
          : formatSuccessReport(
              saved.message || "Event saved.",
              payload.clientCase || sheetOpenHint(data?.spreadsheetId)
            );
      form.reset();
      setEventFormKey((key) => key + 1);
      selectTab(savedDate && !onToday ? "week" : "today");
      const refreshed = await load(undefined, true, { keepStatus: true });
      reportSuccess(savedMessage);
      warnIfSavedItemMissing(saved.eventId, refreshed?.data, refreshed?.data?.spreadsheetId || data?.spreadsheetId);
    } catch (e) {
      showStatus(e instanceof Error ? e.message : "Save failed.", true);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDuplicateAddAnyway() {
    const pending = duplicateWarning?.pending;
    if (!pending) return;
    setDuplicateWarning(null);
    if (pending.kind === "task") {
      await submitTask(pending.form, pending.clientCase, { skipDuplicateCheck: true });
    } else {
      await submitEvent(pending.form, pending.clientCase, { skipDuplicateCheck: true });
    }
  }

  async function completeScheduleEmail(saved: SavedEventInfo) {
    setBusy(true);
    try {
      await load(undefined, true, { keepStatus: true });
      reportSuccess(formatSuccessReport("Schedule confirmation sent.", saved.eventId));
      setEventFormKey((key) => key + 1);
      selectTab("today");
    } finally {
      setBusy(false);
    }
  }

  const counts = data?.counts;
  const opts = data?.options;
  const items = data?.items || [];
  const scheduleItems = useMemo(() => excludeLiaisonConfidentialItems(items), [items]);
  const today = data?.today || todayYmd();
  const wide = true;
  const weekDates = data?.weekStart ? getWeekDates(data.weekStart) : [];
  const isAdmin = data?.isAdmin === true || session?.user?.isAdmin === true;
  const sessionStaffName = useMemo(() => {
    const directory = data?.employeeDirectory ?? [];
    return resolveSessionStaffName(session?.user, directory);
  }, [session?.user, data?.employeeDirectory]);
  const canViewLiaisonConfidential = useMemo(
    () =>
      data?.canViewLiaisonConfidential === true ||
      canViewLiaisonTab({
        email,
        staffName: sessionStaffName || sessionDisplayName,
        isAdmin
      }),
    [data?.canViewLiaisonConfidential, email, sessionStaffName, sessionDisplayName, isAdmin]
  );
  const navTabs = useMemo(
    () => tasksNavTabsForUser(billingAccess, navProfile, { canViewLiaisonTab: canViewLiaisonConfidential }),
    [billingAccess, navProfile, canViewLiaisonConfidential]
  );
  const introContent = useMemo(() => getTasksIntroContent(navTabs), [navTabs]);
  const tabShortcuts = useMemo(() => buildTabShortcutHelp(navTabs), [navTabs]);

  const handleIntroClose = useCallback(() => {
    markWorkspaceIntroSeen("tasks", email);
    setIntroState("closed");
    const params = new URLSearchParams(window.location.search);
    if (params.has("tab") || params.has("eventKind")) {
      params.delete("tab");
      params.delete("eventKind");
      const next = params.toString();
      router.replace(next ? `/app?${next}` : "/app", { scroll: false });
    }
  }, [email, router]);

  const handleIntroSelectTab = useCallback(
    (tabId: string) => {
      markWorkspaceIntroSeen("tasks", email);
      const allowed = navTabs.some((tab) => tab.id === tabId);
      selectTab(allowed ? (tabId as Tab) : "today");
      setIntroState("closed");
      const params = new URLSearchParams(window.location.search);
      if (params.has("tab") || params.has("eventKind")) {
        params.delete("tab");
        params.delete("eventKind");
        const next = params.toString();
        router.replace(next ? `/app?${next}` : "/app", { scroll: false });
      }
    },
    [email, navTabs, router, selectTab]
  );

  const replayWorkspaceGuide = useCallback(() => {
    clearWorkspaceIntroSeen("tasks", email);
    setIntroState("open");
  }, [email]);

  useEffect(() => {
    if (introOpen) return;
    return bindWorkspaceTabShortcuts(
      navTabs.map((entry) => entry.id),
      (next) => selectTab(next as Tab)
    );
  }, [introOpen, navTabs, selectTab]);

  const filingDeadlineAlerts = useMemo(() => listFilingDeadlineAlerts(scheduleItems, today), [scheduleItems, today]);

  const viewerPrepRole = useMemo(
    () => resolvePrepRoleFromSession(session?.user, data?.employeeDirectory ?? []),
    [session?.user, data?.employeeDirectory]
  );
  const effectiveMyWorkScope: MyWorkScope =
    isAdmin && sessionStaffName ? myWorkScope : sessionStaffName ? "mine" : "firm";
  const myWorkItems = useMemo(() => {
    if (effectiveMyWorkScope === "firm" || !sessionStaffName) return scheduleItems;
    return filterItemsForMyWork(scheduleItems, sessionStaffName, data?.employees ?? []);
  }, [scheduleItems, effectiveMyWorkScope, sessionStaffName, data?.employees]);
  const myWorkCounts = useMemo(() => computeTodayCounts(myWorkItems), [myWorkItems]);
  const myWorkLists = useMemo(() => filterTodayLists(myWorkItems), [myWorkItems]);
  const todayCounts = effectiveMyWorkScope === "mine" ? myWorkCounts : counts;
  const todayLists = effectiveMyWorkScope === "mine" ? myWorkLists : data?.lists;
  const calendarSyncItems = effectiveMyWorkScope === "mine" ? myWorkItems : scheduleItems;

  const handleShareMyWorkList = useCallback(async () => {
    if (!todayLists) return;
    const scopeLabel =
      effectiveMyWorkScope === "mine" && sessionStaffName
        ? `Assigned to ${sessionStaffName}`
        : "Whole firm";
    const text = formatMyWorkListText({ today, scopeLabel, lists: todayLists });
    const result = await sharePlainText({ title: `HA Office My work ${today}`, text });
    showStatus(result.message, !result.ok && !/cancel/i.test(result.message));
  }, [todayLists, effectiveMyWorkScope, sessionStaffName, today, showStatus]);

  const handleScheduleEmailSent = useCallback(
    (patch?: EventScheduleEmailSentPatch) => {
      if (patch) {
        setData((prev) => {
          if (!prev) return prev;
          const items = prev.items.map((row) =>
            row.source === patch.source && row.rowNumber === patch.rowNumber
              ? applyEventJoinLinkPatch(row, patch)
              : row
          );
          return {
            ...prev,
            items,
            counts: computeTodayCounts(items),
            lists: filterTodayLists(items)
          };
        });
      }
      void load(undefined, true, { keepStatus: true });
    },
    [load]
  );

  const sectionEmailProps = {
    onScheduleEmailSent: handleScheduleEmailSent,
    onItemStatus: showStatus
  };

  useEffect(() => {
    if (!isAllowedTasksTab(tab, billingAccess, navProfile, { canViewLiaisonTab: canViewLiaisonConfidential })) {
      setTab("today");
      saveTasksTab("today");
    }
  }, [billingAccess, navProfile, tab, canViewLiaisonConfidential]);

  return (
    <>
      <WorkspaceIntroDialog
        open={introOpen}
        content={introContent}
        onSelectTab={handleIntroSelectTab}
        onClose={handleIntroClose}
      />
      <DuplicateEntryWarningDialog
        match={duplicateWarning?.match || null}
        open={Boolean(duplicateWarning)}
        busy={busy}
        onClose={() => setDuplicateWarning(null)}
        onConfirmAddAnyway={() => void confirmDuplicateAddAnyway()}
      />
    <ClientMatterProvider
      items={scheduleItems}
      togglingKey={togglingKey}
      onToggleDone={toggleItemDone}
      onSetStatus={updateItemStatus}
      onResetWithDate={resetItemWithDate}
      onDeleteItem={deleteItem}
      onUpdateNextAction={updateItemNextAction}
      onTogglePrepChecklistItem={togglePrepChecklistItem}
      onMutatePrepChecklistItem={mutatePrepChecklistItem}
      onCreatePrepChecklist={createEventPrepChecklist}
      onInitializePrepChecklist={initializePrepChecklist}
      prepChecklistCreatingKey={prepChecklistCreatingKey}
      onSaveEdit={saveItemEdit}
      onCourtConfirmed={markCourtConfirmed}
      formOptions={opts}
      isAdmin={isAdmin}
      onNotice={(message, isError) => (isError ? reportError(message) : reportSuccess(message))}
    >
      <FirmWorkspaceShell
                signOutCallbackUrl={undefined}
        workspace="tasks"
        wide={wide}
        name={session?.user?.name}
        email={session?.user?.email}
        displayName={session?.user?.displayName}
        billingAccess={session?.user?.billingAccess !== false}
        searchValue={searchQ}
        searchBusy={reloading}
        onSearchChange={setSearchQ}
        onSearchSubmit={(q) => {
          setSearchQ(q);
          selectTab(billingAccess ? "all-items" : "today");
          void load(q || undefined);
        }}
        statusMessage={statusMsg || undefined}
        statusVariant={statusMsg ? statusVariant : "ok"}
        breadcrumbPage={TASKS_TAB_LABELS[tab as SavedTasksTab] ?? "Tasks"}
        chromeTopBanner={
          deleteUndo.pending ? (
            <UndoBar
              title={deleteUndo.pending.label}
              busy={Boolean(togglingKey)}
              onUndo={deleteUndo.undo}
            />
          ) : sheetsAccessHint ? (
            <SheetsAccessErrorPanel
              hint={sheetsAccessHint}
              reloadBusy={busy}
              onReload={() => void load(searchQ || undefined, true)}
            />
          ) : filingDeadlineAlerts.length > 0 ? (
            <FilingFollowUpAlertBar
              alerts={filingDeadlineAlerts}
              busyKey={togglingKey}
              collapseKey={tab}
              onMarkSubmitted={markEventSubmitted}
            />
          ) : null
        }
        navTabs={
          <NavTabsScroll
            tabs={navTabs}
            activeId={tab}
            onSelect={selectTab}
            disabled={busy}
            workspace="tasks"
            ariaLabel="Tasks navigation"
          />
        }
        tabShortcuts={tabShortcuts}
        tabShortcutsTitle="Tasks tabs"
        onReplayWorkspaceGuide={replayWorkspaceGuide}
      >

      {reloading && !data ? (
        tab === "calendar" ? (
          <CalendarViewSkeleton />
        ) : tab === "all-items" ? (
          <AllItemsSkeleton />
        ) : (
          <TasksWorkSkeleton />
        )
      ) : null}

      {data?.tasksSpreadsheetFallback  ? (
        <div className="card-elevated mb-4 border border-amber-300/80 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-extrabold text-ink">Tasks are writing to the billing spreadsheet</p>
          <p className="mt-1">
            <code className="text-ink">TASKS_GOOGLE_SPREADSHEET_ID</code> is not set on this server, so new tasks and
            events go to <strong>GOOGLE_SPREADSHEET_ID</strong> (billing), not your separate Office Tasks workbook. Set
            the tasks spreadsheet ID in Vercel env vars and redeploy, or check the{" "}
            <strong>Master Tasks</strong> / <strong>Hearings &amp; Events</strong> tabs on the billing file.
          </p>
        </div>
      ) : null}

      {!reloading && !data ? (
        <SmartLoadEmptyState
          errorMessage={
            lastLoadError ||
            statusMsg ||
            "Something went wrong reading tasks from Google Sheets."
          }
          context="tasks"
          status={lastLoadStatus}
                    onRetry={() => void load(searchQ || undefined, true)}
        />
      ) : null}

      <PageTransition pageKey={tab}>
      {tab === "today" && counts && data && (
        <div className="page-stagger">
        <div id="print-today" className="print-root">
          <FirmPrintLetterhead
            onlyPrint
            documentType="My work"
            documentTitle={formatDisplayDate(today)}
            documentSubtitle={
              effectiveMyWorkScope === "mine" && sessionStaffName
                ? `Assigned to ${sessionStaffName}`
                : "Whole firm"
            }
          />
          <TabPageHeader resetKey={tab}>
            <BillingTabGuide title="How to use My work">
              <BillingTabGuideText>
                Your assignment checklist. Open items are grouped as <strong>Overdue</strong>,{" "}
                <strong>Due now</strong>, and <strong>Due this week</strong>. Check a task when complete;
                finished items appear under <strong>Completed</strong>.
              </BillingTabGuideText>
              {isAdmin ? (
                <BillingTabGuideText>
                  As admin, use <strong>Whole firm</strong> to review all assignments, or{" "}
                  <strong>My items</strong> for your own list.
                </BillingTabGuideText>
              ) : (
                <BillingTabGuideText>
                  This list shows work assigned to you. Tap the client name to open the matter file.
                </BillingTabGuideText>
              )}
              {billingAccess ? (
                <BillingTabGuideText>
                  To record client fees or print SOAs, go to{" "}
                  <SameWindowLink
                    href={"/billing"}
                    className="font-bold text-gold-dark underline"
                  >
                    Accounts → Charges &amp; payments
                  </SameWindowLink>
                  .
                </BillingTabGuideText>
              ) : (
                <BillingTabGuideText>
                  Use <strong>Calendar</strong> for other dates. Tap <strong>Add task</strong> or <strong>Add event</strong>{" "}
                  to log new work — add remarks on the form or edit a card after saving.
                </BillingTabGuideText>
              )}
              {billingAccess ? (
                <BillingTabGuideText>
                  <strong>Add task</strong> — work with a due date (drafting, follow-ups, prep). Enter client, assignee,
                  due date, and what to do. <strong>Add event</strong> — fixed calendar items (hearings, meetings,
                  filing deadlines).
                </BillingTabGuideText>
              ) : (
                <BillingTabGuideText>
                  <strong>Add task</strong> — court trips, follow-ups, and field work. <strong>Add event</strong> — hearings,
                  consultations, and filing deadlines.
                </BillingTabGuideText>
              )}
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <ViewHero
            className="tab-view-hero"
            eyebrow="My work"
            title={formatDisplayDate(today)}
            subtitle={
              effectiveMyWorkScope === "mine" && sessionStaffName
                ? `Checklist for ${sessionStaffName}.`
                : "Firm-wide assignment checklist."
            }
            action={
              <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => load(undefined, true)}>
                  Reload
                </button>
                <button
                  type="button"
                  className="btn-secondary max-w-[140px]"
                  disabled={busy || !todayLists}
                  onClick={() => void handleShareMyWorkList()}
                >
                  Share list
                </button>
                <button type="button" className="btn-primary max-w-[140px]" onClick={() => openPrintPreview({ title: `HA Office My work ${today}`, sourceId: "print-today" })}>
                  Print
                </button>
              </div>
            }
          />

          <div className="my-work-panel my-work-panel--simple my-work-panel--elegant">
            <section className="card my-work-toolbar">
              {isAdmin && sessionStaffName ? (
                <div className="my-work-toolbar__block">
                  <p className="my-work-toolbar__label">View</p>
                  <MyWorkScopeToggle
                    scope={effectiveMyWorkScope}
                    staffName={sessionStaffName}
                    practiceMode={false}
                    onChange={handleMyWorkScopeChange}
                  />
                </div>
              ) : sessionStaffName ? (
                <div className="my-work-toolbar__block">
                  <p className="my-work-toolbar__label">Assignments</p>
                  <p className="my-work-toolbar__scope-note">{sessionStaffName}</p>
                </div>
              ) : null}
              {todayCounts ? (
                <div className="my-work-toolbar__block my-work-toolbar__block--stats">
                  <p className="my-work-toolbar__label">At a glance</p>
                  <TodayWorkStatGrid compact counts={todayCounts} onJump={scrollToTodaySection} />
                </div>
              ) : null}
              <div className="my-work-toolbar__block my-work-toolbar__block--calendar">
                <p className="my-work-toolbar__label">Calendar</p>
                <CalendarSyncStatus items={calendarSyncItems} compact />
              </div>
            </section>

            <section className="card my-work-feed">
              <header className="my-work-feed__head">
                <div>
                  <p className="my-work-feed__eyebrow">Today</p>
                  <h2 className="my-work-feed__title">Today&apos;s work</h2>
                  <p className="my-work-feed__lede">
                    Overdue, due now, due this week — then completed items below.
                  </p>
                </div>
              </header>

              {todayLists ? (
                <MyWorkTodayFeed
                  lists={{
                    overdue: todayLists.overdue ?? [],
                    eventsToday: todayLists.eventsToday ?? [],
                    deadlinesToday: todayLists.deadlinesToday ?? [],
                    tasksDueToday: todayLists.tasksDueToday ?? [],
                    dueThisWeek: todayLists.dueThisWeek ?? [],
                    doneToday: todayLists.doneToday ?? []
                  }}
                  allItems={scheduleItems}
                  onToggleDone={toggleItemDone}
                  onSetStatus={updateItemStatus}
                  onResetWithDate={resetItemWithDate}
                  onDeleteItem={deleteItem}
                  onUpdateNextAction={updateItemNextAction}
                  onTogglePrepChecklistItem={togglePrepChecklistItem}
                  onMutatePrepChecklistItem={mutatePrepChecklistItem}
                  onCreatePrepChecklist={createEventPrepChecklist}
                  onInitializePrepChecklist={initializePrepChecklist}
                  prepChecklistCreatingKey={prepChecklistCreatingKey}
                  onSaveEdit={saveItemEdit}
                  onCourtConfirmed={markCourtConfirmed}
                  onMarkSubmitted={markEventSubmitted}
                  onConfirmParentFiled={confirmParentFiled}
                  formOptions={opts}
                  togglingKey={togglingKey}
                  isAdmin={isAdmin}
                  viewerStaffName={sessionStaffName ?? undefined}
                  viewerPrepRole={viewerPrepRole}
                  roster={data.employees ?? []}
                  doneOpenPulse={doneOpenPulse}
                  {...sectionEmailProps}
                />
              ) : null}

              {billingAccess ? (
                <section
                  id="today-billing"
                  className="my-work-feed__group my-work-feed__group--billing today-jump-target scroll-mt-4"
                >
                  <div className="my-work-feed__group-head">
                    <span className="my-work-feed__tone my-work-feed__tone--billing" aria-hidden />
                    <div className="my-work-feed__group-copy">
                      <h3 className="my-work-feed__group-title">Billing to-do&apos;s</h3>
                      <p className="my-work-feed__group-hint">Collections, SOA, and receipts — after today&apos;s task queue</p>
                    </div>
                  </div>
                  <MyWorkBillingStrip embedded  />
                </section>
              ) : null}
            </section>

            {isAdmin ? (
              <section className="card my-work-sidecard">
                <header className="my-work-sidecard__head">
                  <h2 className="my-work-sidecard__title">Staff email reminders</h2>
                  <p className="my-work-sidecard__lede">Each person gets only their own due-today and overdue items.</p>
                </header>
                <StaffRemindersPanel
                  layout="strip"
                  embedded
                  items={scheduleItems}
                  today={today}
                  weekDates={weekDates}
                  directory={data.employeeDirectory}
                  isAdmin={isAdmin}
                  busy={busy}
                  onStatus={onStatus}
                />
              </section>
            ) : null}
          </div>

          {items.length === 0 && !busy ? (
            <EmptyState
              title="No tasks or events loaded"
              message="Events live in your Office Tasks spreadsheet (Hearings & Events tab), not Billing."
              action={
                <button
                  type="button"
                  className="btn-primary mx-auto max-w-[260px] text-sm"
                  disabled={diagBusy || busy}
                  onClick={() => void runEventsSheetCheck()}
                >
                  {diagBusy ? "Checking…" : "Check events sheet"}
                </button>
              }
            />
          ) : null}

          {items.length > 0 &&
            todayCounts &&
            todayCounts.overdueOpen +
              todayCounts.waitingAndStarted +
              todayCounts.tasksDueToday +
              todayCounts.eventsToday +
              todayCounts.deadlinesToday +
              todayCounts.completedToday ===
              0 && (
              <EmptyState
                title={
                  effectiveMyWorkScope === "mine" && sessionStaffName
                    ? "Nothing assigned to you today"
                    : "All caught up for today"
                }
                message={
                  effectiveMyWorkScope === "mine" && sessionStaffName && items.length > myWorkItems.length
                    ? "Other team members have items today — switch to Whole firm to see the full board."
                    : billingAccess
                      ? `No overdue or due-today items for ${formatDisplayDate(today)}. Check Week or All items for other dates.`
                      : `No overdue or due-today items for ${formatDisplayDate(today)}. Open Calendar or use + Task / + Event.`
                }
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    {effectiveMyWorkScope === "mine" && sessionStaffName && items.length > myWorkItems.length ? (
                      <button
                        type="button"
                        className="btn-gold text-sm"
                        onClick={() => handleMyWorkScopeChange("firm")}
                      >
                        Whole firm
                      </button>
                    ) : null}
                    {billingAccess ? (
                      <>
                        <button type="button" className="btn-secondary text-sm" onClick={() => selectTab("week")}>
                          Week planner
                        </button>
                        <button type="button" className="btn-secondary text-sm" onClick={() => selectTab("all-items")}>
                          All items
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn-secondary text-sm" onClick={() => selectTab("calendar")}>
                          Calendar
                        </button>
                        <button type="button" className="btn-secondary text-sm" onClick={() => selectTab("add-task")}>
                          + Task
                        </button>
                      </>
                    )}
                  </div>
                }
              />
            )}
          </TabPageBody>
        </div>
        </div>
      )}

      {tab === "calendar" && data && (
        <>
          <TabPageHeader resetKey={tab}>
            <BillingTabGuide title="How to use Calendar">
              <BillingTabGuideText>
                See the whole month — hearings, filing deadlines, and tasks on each date. Tap a date for details below
                (overdue items first). Philippine holidays are highlighted. Use <strong>Print</strong> for a wall calendar.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <MonthlyCalendarView
          items={scheduleItems}
          today={today}
          onToggleDone={toggleItemDone}
          onSetStatus={updateItemStatus}
          onResetWithDate={resetItemWithDate}
          onDeleteItem={deleteItem}
          onUpdateNextAction={updateItemNextAction}
          onSaveEdit={saveItemEdit}
        onCourtConfirmed={markCourtConfirmed}
      onMarkSubmitted={markEventSubmitted}
      onConfirmParentFiled={confirmParentFiled}
          formOptions={opts}
          togglingKey={togglingKey}
        />
          </TabPageBody>
        </>
      )}

      {tab === "week" && data && (
        <>
          <TabPageHeader resetKey={tab}>
            <BillingTabGuide title="How to use Week planner">
              <BillingTabGuideText>
                See the next seven days in a grid — overdue items at the top, then each day&apos;s work. Tap a day for
                details below. Best when planning ahead for the week.
              </BillingTabGuideText>
              <BillingTabGuideText>
                For today&apos;s priority list, use <strong>My work</strong>.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <WeeklyPlannerView
          items={scheduleItems}
          today={today}
          initialWeekStart={data.weekStart}
          onToggleDone={toggleItemDone}
          onSetStatus={updateItemStatus}
          onResetWithDate={resetItemWithDate}
          onDeleteItem={deleteItem}
          onUpdateNextAction={updateItemNextAction}
          onSaveEdit={saveItemEdit}
        onCourtConfirmed={markCourtConfirmed}
      onMarkSubmitted={markEventSubmitted}
      onConfirmParentFiled={confirmParentFiled}
          formOptions={opts}
          togglingKey={togglingKey}
        />
          </TabPageBody>
        </>
      )}

      {tab === "team" && data && (
        <>
          <TabPageHeader resetKey={tab}>
            <BillingTabGuide title="How to use Staff load">
              <BillingTabGuideText>
                Pick a team member to see their open, due-today, this-week, and overdue work. Card counts show how much
                each person has on their plate. Atty. Robert Hernandez is listed first.
              </BillingTabGuideText>
              <BillingTabGuideText>
                Staff reminder emails (admin) are set up in <strong>Admin tools</strong>.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <EmployeeTrackerView
          stats={data.employeeStats}
          items={scheduleItems}
          today={today}
          weekDates={weekDates}
          employeeDirectory={data.employeeDirectory}
          isAdmin={isAdmin}
          busy={busy}
          onToggleDone={toggleItemDone}
          onSetStatus={updateItemStatus}
          onResetWithDate={resetItemWithDate}
          onDeleteItem={deleteItem}
          onUpdateNextAction={updateItemNextAction}
          onTogglePrepChecklistItem={togglePrepChecklistItem}
          onMutatePrepChecklistItem={mutatePrepChecklistItem}
          onCreatePrepChecklist={createEventPrepChecklist}
      onInitializePrepChecklist={initializePrepChecklist}
          prepChecklistCreatingKey={prepChecklistCreatingKey}
          onSaveEdit={saveItemEdit}
        onCourtConfirmed={markCourtConfirmed}
      onMarkSubmitted={markEventSubmitted}
      onConfirmParentFiled={confirmParentFiled}
          formOptions={opts}
          togglingKey={togglingKey}
          onStatus={onStatus}
        />
          </TabPageBody>
        </>
      )}

      {tab === "history" && (
        <>
          <TabPageHeader resetKey={tab}>
            <BillingTabGuide title="About past tasks">
              <BillingTabGuideText>
                Look up finished or past tasks and events. Reload for the newest entries first.
              </BillingTabGuideText>
              <BillingTabGuideText>
                Client charges, payments, SOAs, and receipts are in{" "}
                <SameWindowLink href="/billing" className="font-bold text-gold-dark underline">
                  Accounts → All activity
                </SameWindowLink>
                .
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <ViewHero
            eyebrow="Staff actions"
            title="Task & event history"
            subtitle="Latest updates from the team — status changes, done, next action, and edits from the Tasks app."
            action={
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-xs"
                disabled={activityLoading}
                onClick={() => loadActivity()}
              >
                Reload
              </button>
            }
          />
          <TaskHistoryView items={activity} loading={activityLoading} />
          <p className="text-xs text-muted">
            Billing changes (charges, payments, SOA, receipts) are in the Billing app under{" "}
            <strong>History</strong>. Per-client detail is still on each client profile.
          </p>
          </TabPageBody>
        </>
      )}

      {tab === "tools" && (
        <>
          <TabPageHeader resetKey={tab}>
            <BillingTabGuide title="About tools">
              <BillingTabGuideText>
                Refresh sheet data, <strong>sync Google Calendar</strong>, and print today&apos;s list, the week planner,
                or calendar. Admins also get BIR tax deadlines and data health checks.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <ToolsPanel
          busy={busy}
          isAdmin={isAdmin}
                    spreadsheetId={data?.spreadsheetId}
          tasksAppsScriptConfigured={data?.tasksAppsScriptConfigured === true}
          employees={data?.employees || []}
          items={scheduleItems}
          today={today}
          weekDates={weekDates}
          employeeDirectory={data?.employeeDirectory || []}
          onAction={runMaintenance}
          onReload={() => load(searchQ || undefined, true)}
          onStatus={onStatus}
          onPrintToday={() => {
            selectTab("today");
            setTimeout(() => openPrintPreview({ title: `HA Office Today ${today}`, sourceId: "print-today" }), 300);
          }}
        />
          </TabPageBody>
        </>
      )}

      {tab === "liaison" && data && opts && canViewLiaisonConfidential ? (
        <LiaisonConfidentialPanel
          items={items}
          today={today}
          isAdmin={isAdmin}
          staffName={sessionStaffName ?? undefined}
          roster={data.employees ?? []}
          opts={opts}
          busy={busy}
          togglingKey={togglingKey}
          onToggleDone={toggleItemDone}
          onSetStatus={updateItemStatus}
          onResetWithDate={resetItemWithDate}
          onDeleteItem={deleteItem}
          onUpdateNextAction={updateItemNextAction}
          onSaveEdit={saveItemEdit}
          onCourtConfirmed={markCourtConfirmed}
          onMarkSubmitted={markEventSubmitted}
          onConfirmParentFiled={confirmParentFiled}
          onSubmitConfidentialTask={submitLiaisonConfidentialTask}
          onScheduleEmailSent={handleScheduleEmailSent}
          onStatus={showStatus}
        />
      ) : null}

      {(tab === "add-task" || tab === "add-event") && opts && !quickAddKind ? (
        <TabPageBody>
          <TaskEventChooser onSelect={setQuickAddKind} />
        </TabPageBody>
      ) : null}

      {tab === "add-task" && opts && quickAddKind === "task" ? (
        <TabPageBody>
          <button
            type="button"
            className="entry-form__back-link"
            onClick={() => setQuickAddKind(null)}
          >
            ← Task or event
          </button>
          <AddTaskForm
          key={taskFormKey}
          options={opts}
          busy={busy}
          billingAccess={session?.user?.billingAccess !== false}
          onStatus={onStatus}
          onSubmit={(form, clientCase) => submitTask(form, clientCase)}
        />
        </TabPageBody>
      ) : null}

      {tab === "add-event" && opts && quickAddKind === "event" ? (
        <>
          <TabPageHeader resetKey={`${tab}-${eventAddKind}`}>
            <BillingTabGuide title="How to add an event">
              <BillingTabGuideText>
                Choose <strong>Hearings &amp; meetings</strong> for court appearances, consultations, client calls, and
                internal meetings — or <strong>Court filings &amp; submissions</strong> for pleading deadlines and filing
                prep.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <button type="button" className="entry-form__back-link" onClick={() => setQuickAddKind(null)}>
            ← Choose task or event
          </button>
          <EventSegmentedControl
            mode="hero"
            options={[
              { value: "appearances", label: EVENT_ADD_KIND_LABELS.appearances },
              { value: "filings", label: EVENT_ADD_KIND_LABELS.filings }
            ]}
            value={eventAddKind}
            onChange={(kind) => setEventAddKind(kind as EventAddKind)}
            aria-label="Event type"
          />
          <AddEventForm
            key={`${eventFormKey}-${eventAddKind}`}
            options={opts}
            employees={data?.employees || []}
            busy={busy}
            billingAccess={session?.user?.billingAccess !== false}
            eventKind={eventAddKind}
            initialCategory={eventAddKind === "filings" ? "Court Filing" : "Hearing"}
            formTitle="Add event"
            formSubtitle={
              eventAddKind === "filings"
                ? "Pleading or submission deadline — responsive dates compute from date received when applicable."
                : "Hearing, consultation, meeting, or client call — set schedule, venue, and optional hearing prep."
            }
            onStatus={onStatus}
            onSubmit={(form, clientCase) => submitEvent(form, clientCase)}
            onSaveEventForSchedule={(form, clientCase) => saveEventRecord(form, clientCase)}
            onScheduleEmailComplete={(saved) => completeScheduleEmail(saved)}
          />
          </TabPageBody>
        </>
      ) : null}

      {tab === "all-items" && data && (
        <>
          <TabPageHeader resetKey={tab}>
            <BillingTabGuide title="How to search all items">
              <BillingTabGuideText>
                Find any open task, hearing, or event. Type in the search box or filter by type, status, and assignee.
                Tap a card to open details or update its status.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <SearchView
          items={scheduleItems}
          employees={data.employees}
          query={searchQ}
          busy={busy}
          togglingKey={togglingKey}
          onQueryChange={setSearchQ}
          onSearch={(q) => {
            setSearchQ(q);
            void load(q || undefined);
          }}
          onToggleDone={toggleItemDone}
          onSetStatus={updateItemStatus}
          onResetWithDate={resetItemWithDate}
          onDeleteItem={deleteItem}
          onUpdateNextAction={updateItemNextAction}
          onTogglePrepChecklistItem={togglePrepChecklistItem}
          onMutatePrepChecklistItem={mutatePrepChecklistItem}
          onCreatePrepChecklist={createEventPrepChecklist}
      onInitializePrepChecklist={initializePrepChecklist}
          prepChecklistCreatingKey={prepChecklistCreatingKey}
          onSaveEdit={saveItemEdit}
          onCourtConfirmed={markCourtConfirmed}
      onMarkSubmitted={markEventSubmitted}
      onConfirmParentFiled={confirmParentFiled}
          formOptions={opts}
        />
          </TabPageBody>
        </>
      )}

      {tab === "correspondence" && billingAccess && (
        <>
          <TabPageHeader resetKey={tab}>
            <BillingTabGuide title="How to write a letter">
              <BillingTabGuideText>
                Choose a letter type (demand letter, proposal, reply, request, or general letter). Pick a client to fill
                in their name and address automatically, then edit the body text.
              </BillingTabGuideText>
              <BillingTabGuideText>
                Preview the PDF on firm letterhead, then download or send via Gmail with the PDF attached.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <TabPickerCard label="Client (optional prefill)">
            <select
              className="field"
              value={letterClientCode}
              disabled={letterBusy}
              onChange={(e) => setLetterClientCode(e.target.value)}
            >
              <option value="">— No client selected —</option>
              {letterClients.length > 0 ? (
                <optgroup label="Matter clients">
                  {letterClients.map((client) => (
                    <option key={client.code} value={client.code}>
                      {client.code} — {client.name || "Unnamed"}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {letterWalkIns.length > 0 ? (
                <optgroup label="Walk-in clients">
                  {letterWalkIns.map((walkIn) => (
                    <option key={walkIn.walkInId} value={`${LETTER_WALKIN_PREFIX}${walkIn.walkInId}`}>
                      {walkIn.walkInId} — {walkIn.name || "Unnamed"}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </TabPickerCard>
          <CorrespondenceDraftPanel
            clientCode={selectedLetterWalkIn?.walkInId || selectedLetterClient?.code || ""}
            clientName={selectedLetterWalkIn?.name || selectedLetterClient?.name || ""}
            clientAddress={selectedLetterClient?.address || ""}
            clientEmail={selectedLetterWalkIn?.email || selectedLetterClient?.email || ""}
            caseTitle={selectedLetterWalkIn?.matter || selectedLetterClient?.caseTitle || ""}
            assignedAttorney={selectedLetterClient?.assignedAttorney || ""}
            balance={selectedLetterClient?.balance}
            lastSoaDate={selectedLetterClient?.soaSent}
            lastBillingDate={selectedLetterClient?.lastBillingDate}
            busy={letterBusy}
            onBusy={setLetterBusy}
            onStatus={showStatus}
          />
          </TabPageBody>
        </>
      )}

      </PageTransition>

      <datalist id="employees">
        {(data?.employees || []).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      </FirmWorkspaceShell>
    </ClientMatterProvider>
    </>
  );
}

async function readApiResponse(res: Response): Promise<{
  error?: string;
  message?: string;
  ok?: boolean;
  taskId?: string;
  eventId?: string;
  sheetRow?: number;
}> {
  const text = await res.text();
  try {
    return JSON.parse(text) as { error?: string; message?: string; ok?: boolean };
  } catch {
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        res.status === 404
          ? "Could not reach the server API. Refresh the page and try again."
          : `Server returned an error page (${res.status}). Try signing in again.`
      );
    }
    throw new Error("Unexpected server response.");
  }
}
