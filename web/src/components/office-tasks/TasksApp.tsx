"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ClioRail } from "@/components/clio/ClioRail";
import { ClioSubTabs } from "@/components/clio/ClioSubTabs";
import { ToolsPanel } from "@/components/office-tasks/ToolsPanel";
import { TasksWeekTabView } from "@/components/office-tasks/tabs/TasksWeekTabView";
import type { TasksHomeData } from "@/lib/office-tasks/home-data";
import { useTasksHomeData } from "@/hooks/useTasksHomeData";
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
import {
  buildClioHref,
  defaultClioSectionForUser,
  findClioPrimary,
  findClioSection,
  HA_BILLING_PATH,
  isClioSectionAllowed,
  parseCalendarModeParam,
  parseClioNavParam,
  readSavedClioNav,
  resolveClioFromTasksTab,
  saveClioNav,
  type ClioVisibilityOptions
} from "@/lib/clio/workspace-nav";
import { firmAppHref, getTasksAppUrl } from "@/lib/firm-apps";
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
import { mergeTaskWorkDetails, resolveTaskType, validateTaskFormInput, LETTER_CORRESPONDENCE_FORM_TYPE } from "@/lib/office-tasks/task-form-utils";
import {
  validateLetterCorrespondenceInput,
  type LetterCorrespondenceInput
} from "@/lib/office-tasks/letter-task-utils";
import { FilingFollowUpAlertBar } from "@/components/office-tasks/FilingFollowUpAlertBar";
import { FilingWorkspace } from "@/components/office-tasks/FilingWorkspace";
import dynamic from "next/dynamic";
import {
  filterDeskChecklistItems,
  resolveDeskChecklistScope
} from "@/lib/office-tasks/desk-checklist";
import { listFilingDeadlineAlerts } from "@/lib/office-tasks/filing-confirmation";
import { DEFAULT_FIRM_ALERT_RULES } from "@/lib/firm-alert-rules";
import { NextQueueStrip } from "@/components/NextQueueStrip";
import { buildNextQueue } from "@/lib/next-queue";
import type { OfficeHubSummary } from "@/lib/office-hub/summary";
import {
  isOfflineQueued,
  mutateTaskComplete,
  mutateTaskNextAction,
  mutateTaskStatus
} from "@/lib/office-tasks/task-mutations";
import {
  prepChecklistCreateUrl,
  prepChecklistInitializeUrl
} from "@/lib/office-tasks/prep-checklist-actions";
import { SameWindowLink } from "@/components/SameWindowLink";
import { MyWorkScopeToggle } from "@/components/office-tasks/MyWorkScopeToggle";
import { LiaisonConfidentialPanel } from "@/components/office-tasks/LiaisonConfidentialPanel";
import { StaffPresencePanel } from "@/components/office-tasks/StaffPresencePanel";
import { excludeLiaisonConfidentialItems } from "@/lib/office-tasks/liaison-confidential";
import { canViewLiaisonTab } from "@/lib/app-access";
import { isFirmOwnerEmail } from "@/lib/firm-team-config";
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

const TasksDeskChecklistTab = dynamic(
  () => import("@/components/office-tasks/TasksDeskChecklistTab").then((m) => m.TasksDeskChecklistTab),
  { ssr: false }
);

type Props = Record<string, never>;

type HomeData = TasksHomeData;

type Tab =
  | "desk-checklist"
  | "today"
  | "calendar"
  | "week"
  | "team"
  | "history"
  | "add-task"
  | "add-event"
  | "all-items"
  | "correspondence"
  | "filing"
  | "tools"
  | "liaison"
  | "presence";

type PendingDuplicateEntry = {
  kind: "task" | "event";
  form: HTMLFormElement;
  clientCase: string;
};

type IntroState = "pending" | "open" | "closed";

export function TasksApp() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingPath = HA_BILLING_PATH;
  const tasksPath = firmAppHref("/app", getTasksAppUrl()) || "/app";
  const [introState, setIntroState] = useState<IntroState>("pending");
  const [tab, setTab] = useState<Tab>("today");
  /** Clio Calendar Day/Week/Month — day mounts hourly DayScheduleView on the week tab. */
  const [calendarMode, setCalendarMode] = useState<"day" | "week" | "month">("week");
  const [filingQueue, setFilingQueue] = useState<"e-filing" | "physical">("e-filing");
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
  const {
    data,
    setData,
    reloading,
    lastLoadStatus,
    lastLoadError,
    sheetsAccessHint,
    load
  } = useTasksHomeData(email, clearUnlessProcessing, reportError, reportWarn);
  const sessionDisplayName = session?.user?.displayName || session?.user?.name || "";
  const isAdminUser = session?.user?.isAdmin === true;
  const canViewPresenceTab = isFirmOwnerEmail(email || session?.user?.email);
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
    (next: Tab, options?: { calendarMode?: "day" | "week" | "month"; syncUrl?: boolean }) => {
      const allowed = isAllowedTasksTab(next, billingAccess, navProfile, {
        canViewLiaisonTab: canViewLiaisonConfidentialEarly,
        canViewPresenceTab
      })
        ? next
        : "today";
      setTab(allowed);
      saveTasksTab(allowed);
      let nextMode: "day" | "week" | "month" = "week";
      // Prefer explicit Clio calendar mode (Day hourly) over week-tab default.
      if (options?.calendarMode) {
        nextMode = options.calendarMode;
        setCalendarMode(options.calendarMode);
      } else if (allowed === "week") {
        nextMode = "week";
        setCalendarMode("week");
      } else if (allowed === "calendar") {
        nextMode = "month";
        setCalendarMode("month");
      }
      if (options?.syncUrl) {
        const clio = resolveClioFromTasksTab(
          allowed as SavedTasksTab,
          allowed === "week" || allowed === "calendar" ? nextMode : null
        );
        saveClioNav(clio.nav, clio.section);
        const href = buildClioHref(clio.nav, clio.section, { billingPath, tasksPath });
        const nextParams = new URLSearchParams(href.split("?")[1] || "");
        const q = searchParams.get("q")?.trim();
        const client = searchParams.get("client")?.trim();
        const eventKind = searchParams.get("eventKind")?.trim();
        if (q) nextParams.set("q", q);
        if (client) nextParams.set("client", client);
        if (eventKind) nextParams.set("eventKind", eventKind);
        const nextSearch = nextParams.toString();
        if (searchParams.toString() !== nextSearch) {
          router.replace(nextSearch ? `${tasksPath}?${nextSearch}` : tasksPath, { scroll: false });
        }
      }
    },
    [
      billingAccess,
      billingPath,
      navProfile,
      canViewLiaisonConfidentialEarly,
      canViewPresenceTab,
      router,
      searchParams,
      tasksPath
    ]
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

  const searchQParam = searchParams.get("q")?.trim() || "";

  useEffect(() => {
    if (searchQParam) setSearchQ(searchQParam);
    void load(searchQParam || undefined, false);
  }, [load, searchQParam]);

  useEffect(() => {
    if (introGate) return;

    const params = new URLSearchParams(searchParams.toString());
    const modeFromUrl = parseCalendarModeParam(params);
    if (modeFromUrl) setCalendarMode(modeFromUrl);

    const clientParam = params.get("client")?.trim().toUpperCase();
    const eventKindParam = params.get("eventKind");
    const clioNav = parseClioNavParam(params.get("nav"));
    const clioSection = params.get("section")?.trim() || "";
    const calParam = params.get("cal")?.trim().toLowerCase() || "";
    const filingQueueParam = params.get("filingQueue")?.trim().toLowerCase() || "";

    if (filingQueueParam === "physical" || filingQueueParam === "e-filing") {
      setFilingQueue(filingQueueParam);
    } else if (clioNav === "filing" && clioSection === "physical") {
      setFilingQueue("physical");
    } else if (clioNav === "filing") {
      setFilingQueue("e-filing");
    }

    if (clientParam) setLetterClientCode(clientParam);
    if (eventKindParam === "filings" || eventKindParam === "appearances") {
      setEventAddKind(eventKindParam);
    }

    const tabOpts = {
      canViewLiaisonTab: canViewLiaisonConfidentialEarly,
      canViewPresenceTab
    };
    const visibility: ClioVisibilityOptions = {
      billingAccess,
      navProfile,
      isAdmin: isAdminUser,
      email,
      canViewLiaisonTab: canViewLiaisonConfidentialEarly,
      canViewPresenceTab
    };
    const tabParam = params.get("tab");

    if (clioNav) {
      const primary = findClioPrimary(clioNav);
      const requested = findClioSection(primary, clioSection);
      if (requested.billingPage) {
        router.replace(buildClioHref(clioNav, requested.id, { billingPath, tasksPath }), {
          scroll: false
        });
        return;
      }
      const section = isClioSectionAllowed(requested, visibility)
        ? requested
        : defaultClioSectionForUser(primary, visibility);
      if (section.tasksTab && isAllowedTasksTab(section.tasksTab as Tab, billingAccess, navProfile, tabOpts)) {
        if (section.calendarMode) setCalendarMode(section.calendarMode);
        selectTab(section.tasksTab as Tab, {
          calendarMode: section.calendarMode
        });
        saveClioNav(clioNav, section.id);
        if (section.id !== requested.id) {
          router.replace(buildClioHref(clioNav, section.id, { billingPath, tasksPath }), {
            scroll: false
          });
        }
        return;
      }
    }

    if (tabParam && isAllowedTasksTab(tabParam as Tab, billingAccess, navProfile, tabOpts)) {
      const calMode =
        modeFromUrl ||
        (calParam === "day" || calParam === "week" || calParam === "month" ? calParam : undefined);
      selectTab(tabParam as Tab, calMode ? { calendarMode: calMode } : undefined);
    } else if (!params.get("nav") && !params.get("tab")) {
      const saved = getSavedTasksTab();
      if (saved && isAllowedTasksTab(saved, billingAccess, navProfile, tabOpts)) {
        selectTab(saved, { syncUrl: true });
      } else {
        selectTab("today", { syncUrl: true });
      }
    }
  }, [
    billingAccess,
    billingPath,
    introGate,
    navProfile,
    selectTab,
    canViewLiaisonConfidentialEarly,
    canViewPresenceTab,
    router,
    searchParams,
    tasksPath
  ]);

  function itemActionKey(item: ItemSummary) {
    return officeItemKey(item);
  }

  async function toggleItemDone(item: ItemSummary, done: boolean) {
    setTogglingKey(itemActionKey(item));
    reportProcessing(done ? "Marking done…" : "Reopening…");
    setData((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((row) =>
        row.source === item.source && row.rowNumber === item.rowNumber
          ? { ...row, done, status: done ? "Done" : row.status }
          : row
      );
      return {
        ...prev,
        items,
        counts: computeTodayCounts(items),
        lists: filterTodayLists(items)
      };
    });
    try {
      const result = await mutateTaskComplete(item, done);
      if (isOfflineQueued(result)) {
        reportSuccess(result.message);
        return;
      }
      if (!result.ok) throw new Error(result.data.error || "Update failed");
      reportSuccess(formatSuccessReport(result.data.message || "Item updated."));
    } catch (e) {
      await load(searchQ || undefined);
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
      const result = await mutateTaskStatus(item, status, options?.note);
      if (isOfflineQueued(result)) {
        reportSuccess(result.message);
        return;
      }
      if (!result.ok) throw new Error(result.data.error || "Update failed");

      const json = result.data;
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
      const result = await mutateTaskNextAction(item, nextAction);
      if (isOfflineQueued(result)) {
        reportSuccess(result.message);
        return;
      }
      if (!result.ok) throw new Error(result.data.error || "Save failed");
      reportSuccess(formatSuccessReport(result.data.message || "Next action saved."));
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

  async function markPrepDone(item: ItemSummary) {
    setTogglingKey(itemActionKey(item));
    reportProcessing("Marking prep done…");
    try {
      const res = await fetch("/api/tasks/items/prep-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemActionPayload(item))
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      reportSuccess(formatSuccessReport(json.message || "Prep marked done."));
      await load(searchQ || undefined);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function markLetterDocDone(item: ItemSummary) {
    setTogglingKey(itemActionKey(item));
    reportProcessing("Marking document ready…");
    try {
      const res = await fetch("/api/tasks/items/letter-doc-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemActionPayload(item))
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      reportSuccess(formatSuccessReport(json.message || "Document marked ready."));
      if (json.whatsAppUrl && typeof window !== "undefined") {
        window.open(String(json.whatsAppUrl), "_blank", "noopener,noreferrer");
      }
      await load(searchQ || undefined);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setTogglingKey(null);
    }
  }

  async function logAppearanceOutcome(
    item: ItemSummary,
    payload: {
      action: "completed" | "rescheduled" | "postponed" | "cancelled";
      whatHappened: string;
      nextDate?: string;
      createNextDateFollowUp: boolean;
      courtFollowUpKind?: "none" | "next_hearing" | "submission" | "other";
      followUpDate?: string;
      followUpNote?: string;
    }
  ) {
    setTogglingKey(itemActionKey(item));
    reportProcessing("Saving what happened…");
    try {
      const res = await fetch("/api/tasks/items/log-hearing-outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...itemActionPayload(item),
          action: payload.action,
          whatHappened: payload.whatHappened,
          nextDate: payload.nextDate,
          createNextDateFollowUp: payload.createNextDateFollowUp,
          courtFollowUpKind: payload.courtFollowUpKind,
          followUpDate: payload.followUpDate,
          followUpNote: payload.followUpNote
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      reportSuccess(formatSuccessReport(json.message || "Outcome saved."));
      await load(searchQ || undefined);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Save failed.");
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
      `${savedId} was saved but did not appear after update — wait 60s and select Update, or open the Office Tasks spreadsheet and search for that ID.${
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
    const rawTaskType = String(fd.get("taskType") || "Task");
    const interactiveChecklistItems =
      createInteractiveChecklist && checklistItems.length ? checklistItems : undefined;
    const letterCorrespondence: LetterCorrespondenceInput | undefined =
      rawTaskType === LETTER_CORRESPONDENCE_FORM_TYPE
        ? {
            letterType: String(fd.get("letterType") || "Demand letter"),
            letterTypeOther: String(fd.get("letterTypeOther") || ""),
            recipient: String(fd.get("letterRecipient") || "").trim(),
            serveViaLiaison: fd.get("serveViaLiaison") === "on",
            serveByDate: String(fd.get("serveByDate") || ""),
            serveAddress: String(fd.get("serveAddress") || ""),
            serveLocation: String(fd.get("serveLocation") || "Davao City"),
            advanceGiven: Number(fd.get("letterAdvanceGiven") || 0),
            serviceFee: Number(fd.get("letterServiceFee") || 0),
            servicePaid: fd.get("letterServicePaid") === "on",
            billThis: fd.get("letterBillThis") === "on",
            billAmount: Number(fd.get("letterBillAmount") || 0),
            billTiming:
              String(fd.get("letterBillTiming") || "client_billing") === "pay_now"
                ? "pay_now"
                : "client_billing",
            billPaymentMethod: String(fd.get("letterBillPaymentMethod") || ""),
            billingConfirmed: fd.get("letterBillingConfirmed") === "on"
          }
        : undefined;
    const payload = {
      clientCase,
      assignedTo: String(fd.get("assignedTo") || "").trim(),
      dueDate: String(fd.get("dueDate") || ""),
      dueTime: String(fd.get("dueTime") || ""),
      venue: String(fd.get("venue") || ""),
      priority: String(fd.get("priority") || "Medium"),
      taskType: resolveTaskType(rawTaskType, String(fd.get("taskTypeOther") || "")),
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
      interactiveChecklistItems,
      letterCorrespondence
    };

    const validationError = validateTaskFormInput({
      ...payload,
      taskType: rawTaskType,
      taskTypeOther: String(fd.get("taskTypeOther") || "")
    });
    const letterValidationError = letterCorrespondence
      ? validateLetterCorrespondenceInput(letterCorrespondence)
      : null;
    if (validationError) {
      showStatus(validationError, true);
      throw new Error(validationError);
    }
    if (letterValidationError) {
      showStatus(letterValidationError, true);
      throw new Error(letterValidationError);
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
    () =>
      tasksNavTabsForUser(billingAccess, navProfile, {
        canViewLiaisonTab: canViewLiaisonConfidential,
        canViewPresenceTab
      }),
    [billingAccess, navProfile, canViewLiaisonConfidential, canViewPresenceTab]
  );
  const introContent = useMemo(() => getTasksIntroContent(navTabs), [navTabs]);
  const tabShortcuts = useMemo(() => buildTabShortcutHelp(navTabs), [navTabs]);

  const clioActive = useMemo(() => {
    function sectionMatchesView(section: ReturnType<typeof findClioSection>): boolean {
      if (section.tasksTab && section.tasksTab !== tab) return false;
      if (section.calendarMode && section.calendarMode !== calendarMode) return false;
      return true;
    }

    const fromUrl = parseClioNavParam(searchParams.get("nav"));
    const sectionFromUrl = searchParams.get("section")?.trim();
    if (fromUrl) {
      const primary = findClioPrimary(fromUrl);
      const section = findClioSection(primary, sectionFromUrl);
      if (sectionMatchesView(section)) {
        return { nav: fromUrl, section: section.id };
      }
    }
    const saved = readSavedClioNav();
    if (saved) {
      const primary = findClioPrimary(saved.nav);
      const section = findClioSection(primary, saved.section);
      if (sectionMatchesView(section)) {
        return { nav: saved.nav, section: section.id };
      }
    }
    return resolveClioFromTasksTab(tab as SavedTasksTab, calendarMode);
  }, [searchParams, tab, calendarMode]);

  useEffect(() => {
    saveClioNav(clioActive.nav, clioActive.section);
  }, [clioActive.nav, clioActive.section]);

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
      selectTab(allowed ? (tabId as Tab) : "today", { syncUrl: true });
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

  const [filingHorizonDays, setFilingHorizonDays] = useState(
    DEFAULT_FIRM_ALERT_RULES.filingAlertHorizonDays
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/firm/alert-rules")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.rules?.filingAlertHorizonDays) return;
        setFilingHorizonDays(Number(json.rules.filingAlertHorizonDays));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const filingDeadlineAlerts = useMemo(
    () => listFilingDeadlineAlerts(scheduleItems, today, { alertHorizonDays: filingHorizonDays }),
    [scheduleItems, today, filingHorizonDays]
  );

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
  const deskChecklistScope = useMemo(() => resolveDeskChecklistScope(), []);
  const deskChecklistItems = useMemo(
    () =>
      filterDeskChecklistItems(scheduleItems, {
        scope: deskChecklistScope,
        staffName: sessionStaffName || "",
        roster: data?.employees ?? []
      }),
    [scheduleItems, deskChecklistScope, sessionStaffName, data?.employees]
  );
  const myWorkCounts = useMemo(() => computeTodayCounts(myWorkItems), [myWorkItems]);
  const myWorkLists = useMemo(() => filterTodayLists(myWorkItems), [myWorkItems]);
  const todayCounts = effectiveMyWorkScope === "mine" ? myWorkCounts : counts;
  const todayLists = effectiveMyWorkScope === "mine" ? myWorkLists : data?.lists;
  const calendarSyncItems = effectiveMyWorkScope === "mine" ? myWorkItems : scheduleItems;

  const nextQueueSummary = useMemo((): OfficeHubSummary => {
    return {
      announcement: null,
      announcementDraft: { message: "", from: "", until: "" },
      isAdmin,
      tasks: todayCounts
        ? {
            tasksDueToday: todayCounts.tasksDueToday,
            eventsToday: todayCounts.eventsToday,
            overdueOpen: todayCounts.overdueOpen,
            nextHearing: null
          }
        : null,
      billingOverdueClients: null
    };
  }, [isAdmin, todayCounts]);

  const nextQueueItems = useMemo(
    () =>
      buildNextQueue({
        summary: nextQueueSummary,
        billingAccess,
        filingAlerts: filingDeadlineAlerts,
        limit: 6
      }),
    [nextQueueSummary, billingAccess, filingDeadlineAlerts]
  );

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
    if (!isAllowedTasksTab(tab, billingAccess, navProfile, { canViewLiaisonTab: canViewLiaisonConfidential, canViewPresenceTab })) {
      setTab("today");
      saveTasksTab("today");
    }
  }, [billingAccess, navProfile, tab, canViewLiaisonConfidential, canViewPresenceTab]);

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
        onOfflineStatus={showStatus}
        breadcrumbPage={tab === "week" && calendarMode === "day" ? "Day" : TASKS_TAB_LABELS[tab as SavedTasksTab] ?? "Tasks"}
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
          <ClioRail
            activeNav={clioActive.nav}
            activeSection={clioActive.section}
            billingPath={billingPath}
            tasksPath={tasksPath}
            isAdmin={isAdmin}
            billingAccess={billingAccess}
            navProfile={navProfile}
            email={email}
            canViewLiaisonTab={canViewLiaisonConfidential}
            canViewPresenceTab={canViewPresenceTab}
          />
        }
        clioSectionTabs={
          <ClioSubTabs
            activeNav={clioActive.nav}
            activeSection={clioActive.section}
            isAdmin={isAdmin}
            billingAccess={billingAccess}
            navProfile={navProfile}
            email={email}
            canViewLiaisonTab={canViewLiaisonConfidential}
            canViewPresenceTab={canViewPresenceTab}
            billingPath={billingPath}
            tasksPath={tasksPath}
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

      <PageTransition pageKey={tab === "week" ? `week-${calendarMode}` : tab}>
      {tab === "filing" ? (
        <FilingWorkspace
          queue={filingQueue}
          sessionStaffName={sessionStaffName || ""}
          todayHref={buildClioHref("checklist", "today", { billingPath, tasksPath })}
          onQueueChange={(next) => {
            setFilingQueue(next);
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", "filing");
            params.set("filingQueue", next);
            params.set("nav", "filing");
            params.set("section", next === "physical" ? "physical" : "e-filing");
            router.replace(`${tasksPath}?${params.toString()}`, { scroll: false });
          }}
          onStatus={(message, isError) => {
            if (isError) reportError(message);
            else reportSuccess(message);
          }}
        />
      ) : null}
      {tab === "desk-checklist" && data ? (
        <TasksDeskChecklistTab
          data={data}
          deskChecklistItems={deskChecklistItems}
          items={items}
          sessionStaffName={sessionStaffName || ""}
          togglingKey={togglingKey}
          toggleItemDone={toggleItemDone}
          markPrepDone={markPrepDone}
          markLetterDocDone={markLetterDocDone}
          updateItemStatus={updateItemStatus}
          resetItemWithDate={resetItemWithDate}
          deleteItem={deleteItem}
          updateItemNextAction={updateItemNextAction}
          logAppearanceOutcome={logAppearanceOutcome}
          togglePrepChecklistItem={togglePrepChecklistItem}
          mutatePrepChecklistItem={mutatePrepChecklistItem}
          createEventPrepChecklist={createEventPrepChecklist}
          initializePrepChecklist={initializePrepChecklist}
          prepChecklistCreatingKey={prepChecklistCreatingKey}
          saveItemEdit={saveItemEdit}
          billingAccess={billingAccess}
          markCourtConfirmed={markCourtConfirmed}
          markEventSubmitted={markEventSubmitted}
          confirmParentFiled={confirmParentFiled}
          opts={opts}
          viewerPrepRole={viewerPrepRole}
          navProfile={navProfile}
          deskChecklistScope={deskChecklistScope}
          isAdmin={isAdmin}
        />
      ) : null}
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
            <BillingTabGuide title="My work">
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
                  This list shows work assigned to you. Select the client name to open the matter file.
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
                  Use <strong>Calendar</strong> for other dates. Select <strong>New task</strong> or <strong>New hearing &amp; filing</strong>{" "}
                  to log new work — add remarks on the form or edit an entry after saving.
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
                  Update
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

          <NextQueueStrip items={nextQueueItems} className="card" />

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
                      <h3 className="my-work-feed__group-title">Billing tasks</h3>
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
                        <button
                          type="button"
                          className="btn-secondary text-sm"
                          onClick={() => selectTab("week", { calendarMode: "week", syncUrl: true })}
                        >
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
            <BillingTabGuide title="Calendar">
              <BillingTabGuideText>
                See the whole month — hearings, filing deadlines, and tasks on each date. Select a date for details below
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

      {tab === "week" && data ? (
        <TasksWeekTabView
          calendarMode={calendarMode}
          items={scheduleItems}
          today={today}
          weekStart={data.weekStart}
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
      ) : null}

      {tab === "team" && data && (
        <>
          <TabPageHeader resetKey={tab}>
            <BillingTabGuide title="Staff load">
              <BillingTabGuideText>
                Pick a team member to see their open, due-today, this-week, and overdue work. Card counts show how much
                each person has on their plate. Atty. Robert Hernandez is listed first.
              </BillingTabGuideText>
              <BillingTabGuideText>
                Staff reminder emails (administration) are set up in <strong>Administration</strong>.
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
            <BillingTabGuide title="past tasks">
              <BillingTabGuideText>
                Look up finished or past tasks and events. Update for the newest entries first.
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
                Update
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
            <BillingTabGuide title="tools">
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

      {tab === "presence" && canViewPresenceTab ? (
        <>
          <TabPageHeader resetKey={tab}>
            <BillingTabGuide title="Staff attendance">
              <BillingTabGuideText>
                Confidential register for firm management. Present means the account had activity in this
                system within the last three minutes. Names are shown without email addresses.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
            <StaffPresencePanel onStatus={showStatus} />
          </TabPageBody>
        </>
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
            <BillingTabGuide title="add an event">
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
            <BillingTabGuide title="search all items">
              <BillingTabGuideText>
                Find any open task, hearing, or event. Type in the search box or filter by type, status, and assignee.
                Select an entry to open details or update its status.
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
            <BillingTabGuide title="write a letter">
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
