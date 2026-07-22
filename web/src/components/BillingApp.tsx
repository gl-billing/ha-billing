"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusOnMount } from "@/hooks/useFocusOnMount";
import type { ClientSummary, NewClientPayload } from "@/lib/gl-config";
import { GL, formatPeso } from "@/lib/gl-config";
import { FirmWorkspaceShell } from "@/components/FirmWorkspaceShell";
import { ClioRail } from "@/components/clio/ClioRail";
import { ClioSubTabs } from "@/components/clio/ClioSubTabs";
import { HomeDashboard, type HomeNavigate } from "@/components/HomeDashboard";
import { MatterIntakeWizard } from "@/components/MatterIntakeWizard";
import { ClientsDirectory } from "@/components/ClientsDirectory";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { NewClientForm } from "@/components/NewClientForm";
import { ReportsPanel } from "@/components/ReportsPanel";
import { FirmFinancesPanel } from "@/components/FirmFinancesPanel";
import { StaffSalaryPanel } from "@/components/StaffSalaryPanel";
import { WalkInClientsPanel } from "@/components/WalkInClientsPanel";
import { SpotBillingPanel } from "@/components/SpotBillingPanel";
import { NotarizationPanel } from "@/components/NotarizationPanel";
import { FieldDispatchPanel } from "@/components/FieldDispatchPanel";
import { BillingHistoryPanel } from "@/components/BillingHistoryPanel";
import { ClientMatterProvider } from "@/components/office-tasks/ClientMatterPanel";
import { SameWindowLink } from "@/components/SameWindowLink";
import { setLastWorkspace } from "@/lib/office-hub/storage";
import { firmAppHref, getTasksAppUrl } from "@/lib/firm-apps";
import { useMatterNavigation } from "@/hooks/useMatterNavigation";
import { getSavedBillingPage, saveBillingPage, type SavedBillingPage } from "@/lib/staff-prefs";
import { parseBillingDeepLink } from "@/lib/billing-routes";
import { correspondenceHref } from "@/lib/tasks-routes";
import {
  BILLING_PAGE_LABELS,
  billingNavTabsForUser,
  isAdminBillingPage,
  isAllowedBillingPage,
  resolveNavUserProfile
} from "@/lib/workspace-labels";
import {
  buildClioHref,
  defaultClioSectionForUser,
  findClioPrimary,
  findClioSection,
  HA_BILLING_PATH,
  isClioSectionAllowed,
  parseClioNavParam,
  readSavedClioNav,
  resolveClioFromBillingPage,
  saveClioNav,
  type ClioVisibilityOptions
} from "@/lib/clio/workspace-nav";
import { matterHref } from "@/lib/matter-routes";
import { BillingTabGuide, BillingTabGuideText, TabPageHeader } from "@/components/BillingTabGuide";
import { TabPageBody, TabPickerCard } from "@/components/TabPageLayout";
import { PageTransition } from "@/components/PageTransition";
import { useFirmStatusReport } from "@/hooks/useFirmStatusReport";
import { formatSuccessReport } from "@/lib/firm-status-report";
import { PaymentIncomeFields } from "@/components/PaymentIncomeFields";
import { OpenChargePicker } from "@/components/OpenChargePicker";
import { listOpenChargesFromLedger, type OpenChargeOption } from "@/lib/open-charges";
import {
  buildPaymentLedgerFields,
  inferPaymentIncomeTypeFromLedger,
  inferPaymentIncomeTypeFromPayment,
  isGenericPaymentLabel,
  type PaymentIncomeType
} from "@/lib/payment-income";
import { SmartLoadEmptyState } from "@/components/SmartLoadEmptyState";
import { postJsonWithOfflineQueue } from "@/lib/fetch-json";
import { WorkspaceIntroDialog } from "@/components/WorkspaceIntroDialog";
import { getBillingIntroContent } from "@/lib/workspace-intro-content";
import { clearWorkspaceIntroSeen, hasSeenWorkspaceIntro, markWorkspaceIntroSeen } from "@/lib/workspace-intro-storage";
import { SheetsAccessErrorPanel } from "@/components/SheetsAccessErrorPanel";
import { bindWorkspaceTabShortcuts, buildTabShortcutHelp } from "@/lib/workspace-tab-shortcuts";
import { canViewLiaisonTab } from "@/lib/app-access";
import { isFirmOwnerEmail } from "@/lib/firm-team-config";
import { useBillingClients } from "@/hooks/useBillingClients";

type Props = Record<string, never>;

type AppPage =
  | "home"
  | "billing"
  | "newClient"
  | "clients"
  | "walkIns"
  | "spotBilling"
  | "notarizations"
  | "fieldDispatch"
  | "documents"
  | "reports"
  | "firmFinances"
  | "staffSalary"
  | "history";

function todayLocal(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

type IntroState = "pending" | "open" | "closed";

export function BillingApp() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingPath = HA_BILLING_PATH;
  const tasksPath = firmAppHref("/app", getTasksAppUrl()) || "/app";
  const [introState, setIntroState] = useState<IntroState>("pending");
  const { goTo } = useMatterNavigation();
  const [page, setPage] = useState<AppPage>("home");
  const [ledgerSaving, setLedgerSaving] = useState(false);
  const [docTab, setDocTab] = useState<"soa" | "ar">("soa");
  const [tab, setTab] = useState<"charge" | "payment">("charge");
  const {
    message: status,
    variant: statusVariant,
    reportProcessing,
    reportSuccess,
    reportError,
    onStatus
  } = useFirmStatusReport();
  const chargeAmountRef = useRef<HTMLInputElement>(null);
  const paymentAmountRef = useRef<HTMLInputElement>(null);
  const clientCodeRef = useRef<HTMLSelectElement>(null);
  const [isAdmin, setIsAdmin] = useState(() => Boolean(session?.user?.isAdmin));
  const [canManageTeamRoster, setCanManageTeamRoster] = useState(() =>
    Boolean(session?.user?.canManageTeamRoster)
  );
  const [adminResolved, setAdminResolved] = useState(
    () => session?.user?.isAdmin === true || session?.user?.canManageTeamRoster === true
  );
  const canOpenPayroll = isAdmin || canManageTeamRoster;
  const billingAccess = session?.user?.billingAccess !== false;
  const navProfile = resolveNavUserProfile({
    email: session?.user?.email,
    billingAccess,
    secretaryNav: session?.user?.secretaryNav
  });
  const email = session?.user?.email?.trim() || "";
  const {
    clients,
    chargeCategories,
    paymentMethods,
    clientCode,
    setClientCode,
    loading,
    loadFailed,
    lastLoadStatus,
    lastLoadError,
    sheetsAccessHint,
    loadData
  } = useBillingClients(email, reportProcessing, reportSuccess, reportError);
  const [busy, setBusy] = useState(false);
  const canViewPresenceTab = isFirmOwnerEmail(email || session?.user?.email);
  const canViewLiaisonConfidential = canViewLiaisonTab({
    email,
    staffName: session?.user?.displayName || session?.user?.name,
    isAdmin
  });
  const clioVisibility: ClioVisibilityOptions = useMemo(
    () => ({
      billingAccess,
      navProfile,
      isAdmin,
      email,
      canManageTeamRoster,
      canViewLiaisonTab: canViewLiaisonConfidential,
      canViewPresenceTab
    }),
    [
      billingAccess,
      navProfile,
      isAdmin,
      email,
      canManageTeamRoster,
      canViewLiaisonConfidential,
      canViewPresenceTab
    ]
  );
  const introOpen = introState === "open";
  const introGate = introState !== "closed";

  useFocusOnMount(clientCodeRef, page === "billing" && !introGate);

  useEffect(() => {
    if (hasSeenWorkspaceIntro("billing", email)) {
      setIntroState("closed");
    } else {
      setIntroState("open");
    }
  }, [email]);

  const syncBillingClioUrl = useCallback(
    (next: AppPage, nav?: ReturnType<typeof resolveClioFromBillingPage>) => {
      const clio = nav || resolveClioFromBillingPage(next);
      saveClioNav(clio.nav, clio.section);
      const href = buildClioHref(clio.nav, clio.section, { billingPath, tasksPath });
      const nextParams = new URLSearchParams(href.split("?")[1] || "");
      if (clientCode) nextParams.set("client", clientCode);
      const nextSearch = nextParams.toString();
      const current = searchParams.toString();
      if (current === nextSearch) return;
      router.replace(nextSearch ? `${billingPath}?${nextSearch}` : billingPath, { scroll: false });
    },
    [billingPath, clientCode, router, searchParams, tasksPath]
  );

  const goToPage = useCallback(
    (next: AppPage) => {
      if (
        adminResolved &&
        isAdminBillingPage(next) &&
        !isAdmin &&
        !(next === "staffSalary" && canManageTeamRoster)
      ) {
        onStatus("Only firm admins can open that tab.", true);
        return;
      }
      if (
        adminResolved &&
        navProfile === "secretary" &&
        !isAllowedBillingPage(next, isAdmin, navProfile, email, canManageTeamRoster)
      ) {
        onStatus("That tab is not in your desk view.", true);
        return;
      }
      setPage(next);
      saveBillingPage(next);
      syncBillingClioUrl(next);
    },
    [
      adminResolved,
      canManageTeamRoster,
      email,
      isAdmin,
      navProfile,
      onStatus,
      syncBillingClioUrl
    ]
  );

  const billingNavTabs = useMemo(
    () =>
      adminResolved
        ? billingNavTabsForUser(isAdmin, navProfile, canManageTeamRoster)
        : billingNavTabsForUser(false, navProfile),
    [adminResolved, canManageTeamRoster, isAdmin, navProfile]
  );
  const introContent = useMemo(() => getBillingIntroContent(billingNavTabs), [billingNavTabs]);
  const tabShortcuts = useMemo(() => buildTabShortcutHelp(billingNavTabs), [billingNavTabs]);

  const handleIntroClose = useCallback(() => {
    markWorkspaceIntroSeen("billing", email);
    setIntroState("closed");
  }, [email]);

  const handleIntroSelectTab = useCallback(
    (tabId: string) => {
      markWorkspaceIntroSeen("billing", email);
      const allowed = billingNavTabs.some((tab) => tab.id === tabId);
      goToPage(allowed ? (tabId as AppPage) : "billing");
      setIntroState("closed");
    },
    [billingNavTabs, email, goToPage]
  );

  const replayWorkspaceGuide = useCallback(() => {
    clearWorkspaceIntroSeen("billing", email);
    setIntroState("open");
  }, [email]);

  useEffect(() => {
    setLastWorkspace("billing");
  }, []);

  useEffect(() => {
    if (introGate) return;

    const params = new URLSearchParams(searchParams.toString());
    const deepLink = parseBillingDeepLink(params);
    const clioNav = parseClioNavParam(params.get("nav"));
    const clioSection = params.get("section")?.trim() || "";

    if (params.get("page")?.trim() === "correspondence") {
      router.replace(
        correspondenceHref(params.get("client")?.trim() || deepLink?.clientCode),
        { scroll: false }
      );
      return;
    }

    if (clioNav) {
      const primary = findClioPrimary(clioNav);
      const requested = findClioSection(primary, clioSection);
      if (requested.tasksTab) {
        router.replace(buildClioHref(clioNav, requested.id, { billingPath, tasksPath }), {
          scroll: false
        });
        return;
      }
      const section = isClioSectionAllowed(requested, clioVisibility)
        ? requested
        : defaultClioSectionForUser(primary, clioVisibility);
      if (section.billingPage) {
        const nextPage = section.billingPage;
        if (
          isAllowedBillingPage(nextPage, isAdmin, navProfile, email, canManageTeamRoster) ||
          nextPage === "home" ||
          nextPage === "clients"
        ) {
          setPage(nextPage);
          saveBillingPage(nextPage);
        }
        saveClioNav(clioNav, section.id);
        if (section.id !== requested.id) {
          router.replace(buildClioHref(clioNav, section.id, { billingPath, tasksPath }), {
            scroll: false
          });
        }
      }
    } else {
      const resolvedPage: AppPage = deepLink?.page || getSavedBillingPage() || "home";
      if (deepLink?.page) {
        setPage(deepLink.page);
        saveBillingPage(deepLink.page);
      } else {
        const saved = getSavedBillingPage();
        if (saved) setPage(saved);
      }
      syncBillingClioUrl(resolvedPage);
    }

    if (deepLink?.clientCode) setClientCode(deepLink.clientCode);
    if (deepLink?.docTab) setDocTab(deepLink.docTab);
    if (deepLink?.billingTab) setTab(deepLink.billingTab);
  }, [
    introGate,
    router,
    searchParams,
    isAdmin,
    navProfile,
    email,
    canManageTeamRoster,
    clioVisibility,
    billingPath,
    tasksPath,
    syncBillingClioUrl
  ]);

  const clioActive = useMemo(() => {
    const fromUrl = parseClioNavParam(searchParams.get("nav"));
    const sectionFromUrl = searchParams.get("section")?.trim();
    if (fromUrl) {
      const primary = findClioPrimary(fromUrl);
      const section = findClioSection(primary, sectionFromUrl);
      // Prefer URL only when it still describes the current billing page (duplicate Matters/Contacts paths).
      if (!section.billingPage || section.billingPage === page) {
        return { nav: fromUrl, section: section.id };
      }
    }
    const saved = readSavedClioNav();
    if (saved) {
      const primary = findClioPrimary(saved.nav);
      const section = findClioSection(primary, saved.section);
      if (!section.billingPage || section.billingPage === page) {
        return { nav: saved.nav, section: section.id };
      }
    }
    return resolveClioFromBillingPage(page as SavedBillingPage);
  }, [page, searchParams]);

  useEffect(() => {
    if (session?.user?.isAdmin) {
      setIsAdmin(true);
      setAdminResolved(true);
    }
    if (session?.user?.canManageTeamRoster) {
      setCanManageTeamRoster(true);
      setAdminResolved(true);
    }
  }, [session?.user?.canManageTeamRoster, session?.user?.isAdmin]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (json) {
          setIsAdmin(Boolean(json.isAdmin));
          setCanManageTeamRoster(Boolean(json.canManageTeamRoster));
        }
        setAdminResolved(true);
      })
      .catch(() => {
        if (!cancelled) setAdminResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (introGate || !adminResolved || isAdmin) return;
    if (isAdminBillingPage(page) && !(page === "staffSalary" && canManageTeamRoster)) {
      setPage("billing");
      saveBillingPage("billing");
      syncBillingClioUrl("billing");
      return;
    }
    if (
      navProfile === "secretary" &&
      !isAllowedBillingPage(page, isAdmin, navProfile, email, canManageTeamRoster)
    ) {
      setPage("billing");
      saveBillingPage("billing");
      syncBillingClioUrl("billing");
    }
  }, [
    canManageTeamRoster,
    introGate,
    adminResolved,
    email,
    isAdmin,
    navProfile,
    page,
    syncBillingClioUrl
  ]);

  useEffect(() => {
    if (tab !== "payment" || !clientCode) return;
    let cancelled = false;
    void fetch(`/api/clients/${encodeURIComponent(clientCode)}/profile`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.ledger?.entries) return;
        const inferred = inferPaymentIncomeTypeFromLedger(json.ledger.entries);
        setPaymentIncomeType(inferred);
        setPaymentDefaultHint(`Suggested from latest charge · ${inferred}`);
        setOpenCharges(listOpenChargesFromLedger(json.ledger.entries));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clientCode, tab]);

  const [chargeDate, setChargeDate] = useState(todayLocal());
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeCategory, setChargeCategory] = useState<string>(GL.chargeCategories[1]);
  const [chargeDescription, setChargeDescription] = useState("");

  const [paymentDate, setPaymentDate] = useState(todayLocal());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(GL.paymentMethods[0]);
  const [paymentDetails, setPaymentDetails] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [paymentIncomeType, setPaymentIncomeType] = useState<PaymentIncomeType>("Professional Fee");
  const [paymentDefaultHint, setPaymentDefaultHint] = useState("");
  const [openCharges, setOpenCharges] = useState<OpenChargeOption[]>([]);

  useEffect(() => {
    if (introOpen) return;
    return bindWorkspaceTabShortcuts(
      billingNavTabs.map((tab) => tab.id),
      (next) => goToPage(next)
    );
  }, [billingNavTabs, goToPage, introOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Firm-wide search"]')?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function submitLedger(
    payload: Record<string, unknown>,
    successMessage: string,
    addAnother = false
  ) {
    if (!clientCode) {
      reportError("Choose a client first.");
      return;
    }

    setBusy(true);
    setLedgerSaving(true);
    reportProcessing(tab === "charge" ? "Saving charge to ledger…" : "Saving payment to ledger…");

    try {
      const result = await postJsonWithOfflineQueue<{ message?: string; error?: string }>("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        offlineLabel: tab === "charge" ? "Charge entry" : "Payment entry"
      });

      if ("queued" in result) {
        reportSuccess(result.message);
        return;
      }

      if (!result.ok) {
        const msg = result.data.error || "Failed to save entry.";
        if (typeof msg === "string" && msg.includes("Client tab not found")) {
          throw new Error(
            `${msg} Open the matter page for this client and create a ledger tab, or re-register under New.`
          );
        }
        throw new Error(msg);
      }

      if (addAnother) {
        if (tab === "charge") {
          setChargeAmount("");
          setChargeDescription("");
          reportSuccess(`${formatSuccessReport(result.data.message || successMessage, clientCode)} Add another below.`);
          window.requestAnimationFrame(() => chargeAmountRef.current?.focus());
        } else {
          setPaymentAmount("");
          setPaymentDetails("");
          setPaymentDescription("");
          reportSuccess(`${formatSuccessReport(result.data.message || successMessage, clientCode)} Add another below.`);
          window.requestAnimationFrame(() => paymentAmountRef.current?.focus());
        }
      } else {
        setChargeAmount("");
        setChargeDescription("");
        setPaymentAmount("");
        setPaymentDetails("");
        setPaymentDescription("");
        reportSuccess(formatSuccessReport(result.data.message || successMessage, clientCode));
      }
      await loadData({ quiet: true });
    } catch (error) {
      reportError(error instanceof Error ? error.message : "Failed to save entry.");
    } finally {
      setBusy(false);
      setLedgerSaving(false);
    }
  }

  async function submitNewClient(payload: NewClientPayload) {
    setBusy(true);
    reportProcessing(`Creating client ${payload.clientCode} and ledger tab…`);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create client.");
      }

      const code = result.clientCode || payload.clientCode;
      setClientCode(code);
      goToPage("billing");
      reportSuccess(formatSuccessReport(result.message || "Client created.", code));
      await loadData({ quiet: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create client.";
      reportError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setBusy(false);
    }
  }

  const selected = clients.find((c) => c.code === clientCode);

  async function refreshSpreadsheetDashboard() {
    setBusy(true);
    setAppStatus("Updating spreadsheet overview…", false, true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refreshDashboard" })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Refresh failed.");
      setAppStatus(formatSuccessReport(result.message || "Dashboard refreshed."));
      await loadData();
    } catch (error) {
      setAppStatus(error instanceof Error ? error.message : "Refresh failed.", true);
    } finally {
      setBusy(false);
    }
  }

  function setAppStatus(message: string, isError = false, isProcessing = false) {
    onStatus(message, isError, isProcessing);
  }

  function navigate(options: {
    page: AppPage;
    clientCode?: string;
    billingTab?: "charge" | "payment";
    docTab?: "soa" | "ar";
  }) {
    if (options.clientCode && options.page === "clients") {
      goTo(options.clientCode);
      return;
    }
    if (options.clientCode) setClientCode(options.clientCode);
    if (options.billingTab) setTab(options.billingTab);
    if (options.docTab) setDocTab(options.docTab);
    goToPage(options.page);
  }

  function handleHomeNavigate(nav: HomeNavigate) {
    navigate(nav);
  }

  return (
    <>
      <WorkspaceIntroDialog
        open={introOpen}
        content={introContent}
        onSelectTab={handleIntroSelectTab}
        onClose={handleIntroClose}
      />
    <ClientMatterProvider lazyLoadItems onNotice={setAppStatus}>
      <FirmWorkspaceShell
        workspace="billing"
        wide
        name={session?.user?.name}
        email={session?.user?.email}
        displayName={session?.user?.displayName}
        billingAccess={billingAccess}
        statusMessage={status}
        statusVariant={status ? statusVariant : "ok"}
        onOfflineStatus={(message, isError) => setAppStatus(message, isError)}
        breadcrumbPage={BILLING_PAGE_LABELS[page as SavedBillingPage] ?? "Billing"}
        chromeTopBanner={
          sheetsAccessHint ? (
            <SheetsAccessErrorPanel
              hint={sheetsAccessHint}
              reloadBusy={loading}
              onReload={() => void loadData()}
            />
          ) : undefined
        }
        tabShortcuts={tabShortcuts}
        tabShortcutsTitle="Billing tabs"
        onReplayWorkspaceGuide={replayWorkspaceGuide}
        clioSectionTabs={
          <ClioSubTabs
            activeNav={clioActive.nav}
            activeSection={clioActive.section}
            isAdmin={isAdmin}
            billingAccess={billingAccess}
            navProfile={navProfile}
            email={email}
            canManageTeamRoster={canManageTeamRoster}
            canViewLiaisonTab={canViewLiaisonConfidential}
            canViewPresenceTab={canViewPresenceTab}
            billingPath={billingPath}
            tasksPath={tasksPath}
          />
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
            canManageTeamRoster={canManageTeamRoster}
            canViewLiaisonTab={canViewLiaisonConfidential}
            canViewPresenceTab={canViewPresenceTab}
          />
        }
      >
      {!loading && loadFailed ? (
        <SmartLoadEmptyState
          errorMessage={
            lastLoadError ||
            status ||
            "Something went wrong reading billing data from Google Sheets."
          }
          context="billing"
          status={lastLoadStatus}
          onRetry={() => void loadData()}
        />
      ) : null}
      {!loadFailed ? (
      <PageTransition pageKey={page}>
      {page === "home" && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="overview">
              <BillingTabGuideText>
                Firm-wide snapshot — who owes money, recent documents, client birthdays, and batch SOA tools.
              </BillingTabGuideText>
              <BillingTabGuideText>
                To record a new fee or payment, go to <strong>Charges &amp; payments</strong>. For tasks and deadlines, go to{" "}
                <SameWindowLink
                  href={buildClioHref("checklist", "today", { billingPath, tasksPath })}
                  className="font-bold text-gold-dark underline"
                >
                  My work
                </SameWindowLink>
                .
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <HomeDashboard
            busy={busy}
            onNavigate={handleHomeNavigate}
            onRefresh={loadData}
            onNotify={setAppStatus}
          />
          </TabPageBody>
        </>
      )}

      {page === "newClient" && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="add a new client">
              <BillingTabGuideText>
                <strong>Full intake</strong> — for a retained client. You will enter client code (surname in CAPS, e.g.{" "}
                <em>SMITH</em>), full name, contact details (email or phone and address), case type, and choose a{" "}
                <strong>Contract of legal services</strong> or <strong>Retainership agreement</strong> to send.
              </BillingTabGuideText>
              <BillingTabGuideText>
                <strong>Client register</strong> (expand at bottom) — adds the client to the list and opens their billing
                file only, when you are not sending letters or starter tasks yet.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <MatterIntakeWizard
            busy={busy}
            onStatus={setAppStatus}
            onComplete={(code, options) => {
              void loadData();
              if (options?.highlightTaskId) {
                goTo(code, "tasks", {
                  highlightTask: options.highlightTaskId,
                  intake: true
                });
                return;
              }
              goTo(code, undefined, { intake: true });
            }}
          />
          <details className="card mt-4">
            <summary className="cursor-pointer text-xs font-bold text-muted">Client register (single form)</summary>
            <div className="mt-3">
              <NewClientForm busy={busy} onSubmit={submitNewClient} onStatus={setAppStatus} />
            </div>
          </details>
          </TabPageBody>
        </>
      )}

      {page === "clients" && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="find a client">
              <BillingTabGuideText>
                Search by client code or name. Select a row to see contact details, or open the <strong>matter page</strong>{" "}
                for their ledger, tasks, and documents.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <ClientsDirectory busy={busy} />
          </TabPageBody>
        </>
      )}

      {page === "walkIns" && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="log a walk-in">
              <BillingTabGuideText>
                For someone who visited the office today and is <strong>not yet a regular client</strong>. Enter their
                name, visit type (consultation, retainer visit, etc.), amount charged, and payment if they paid now.
              </BillingTabGuideText>
              <BillingTabGuideText>
                If they become a retained client, use <strong>Promote &amp; open matter</strong> to create their billing
                file and copy today&apos;s fees to their ledger.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <WalkInClientsPanel
            busy={busy}
            onBusy={setBusy}
            onStatus={setAppStatus}
            onPromoted={(code, walkInId) => {
              setClientCode(code);
              void loadData();
              goTo(code, undefined, { intake: true, walkin: walkInId });
            }}
            onOpenBilling={(code) => {
              goTo(code, "billing");
            }}
          />
          </TabPageBody>
        </>
      )}

      {page === "spotBilling" && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="record one-time fees">
              <BillingTabGuideText>
                For people who pay once or twice and do <strong>not</strong> need a full client file — e.g. a single
                document review or a one-off legal service. Enter their name, the fee, and how they paid.
              </BillingTabGuideText>
              <BillingTabGuideText>
                Use <strong>Walk-ins</strong> for same-day office visitors you may promote to a client later. Use{" "}
                <strong>New client</strong> when they are retained for ongoing work.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <SpotBillingPanel busy={busy} onBusy={setBusy} onStatus={setAppStatus} paymentMethods={paymentMethods} />
          </TabPageBody>
        </>
      )}

      {page === "notarizations" && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="log a notarization">
              <BillingTabGuideText>
                Enter the document type, notarial book and page numbers, document number, fee amount, and payment method.
                Then print the <strong>acknowledgment receipt</strong> for the signatory.
              </BillingTabGuideText>
              <BillingTabGuideText>
                If the person is not on the client list yet, you can log them under <strong>Walk-ins</strong> instead.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <NotarizationPanel
          busy={busy}
          onBusy={setBusy}
          onStatus={setAppStatus}
          paymentMethods={paymentMethods}
        />
          </TabPageBody>
        </>
      )}

      {page === "fieldDispatch" && adminResolved && isAdmin && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="track field visits">
              <BillingTabGuideText>
                Admin only. When staff travels out of town for a client: enter the advance given, service fee, and returned
                change when they are back. Use <strong>Bill client</strong> to post expenses and the liaison fee to the
                client ledger in one step.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <FieldDispatchPanel
            busy={busy}
            onBusy={setBusy}
            onStatus={setAppStatus}
            clients={clients}
            onOpenBilling={(code) => {
              setClientCode(code);
              goTo(code, "billing");
            }}
          />
          </TabPageBody>
        </>
      )}

      {page === "documents" && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="print SOA or receipt">
              <BillingTabGuideText>
                Pick a client, then choose <strong>Statement of Account (SOA)</strong> to show what they owe, or{" "}
                <strong>Acknowledgment Receipt (AR)</strong> for a payment already recorded on their ledger.
              </BillingTabGuideText>
              <BillingTabGuideText>
                Record new fees and payments first on <strong>Charges &amp; payments</strong> — this tab only prints or
                emails documents from what is already posted.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <TabPickerCard label="Client for documents">
            <select
              className="field"
              value={clientCode}
              disabled={ledgerSaving}
              onChange={(e) => setClientCode(e.target.value)}
            >
              {clients.map((client) => (
                <option key={client.code} value={client.code}>
                  {client.code} — {client.name || "Unnamed"}
                </option>
              ))}
            </select>
          </TabPickerCard>
          <DocumentsPanel
            clientCode={clientCode}
            clientName={selected?.name || ""}
            caseTitle={selected?.caseTitle || ""}
            clientEmail={selected?.email || ""}
            clientBalance={selected?.balance || 0}
            preferredGreeting={undefined}
            initialDocTab={docTab}
            paymentMethods={paymentMethods}
            onBusy={setBusy}
            onStatus={setAppStatus}
          />
          </TabPageBody>
        </>
      )}

      {page === "reports" && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="reports">
              <BillingTabGuideText>
                See who owes money (AR aging), monthly collections, and partner summaries. Admins can export CSV files,
                run data health checks, and download incremental backup PDFs under Maintenance.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <ReportsPanel busy={busy} onStatus={setAppStatus} onBusy={setBusy} />
          </TabPageBody>
        </>
      )}

      {page === "firmFinances" && adminResolved && isAdmin && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="firm income">
              <BillingTabGuideText>
                Admin only. Review firm income each month and split it into expense, savings, travel, and emergency
                buckets. Notarial fees from the Notary log tab are included automatically.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <FirmFinancesPanel busy={busy} onStatus={setAppStatus} />
          </TabPageBody>
        </>
      )}

      {page === "staffSalary" && adminResolved && canOpenPayroll && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="payroll">
              <BillingTabGuideText>
                Admin only. Run semi-monthly payroll on the 15th and last day of each month (or the prior business day if
                it falls on a weekend). Enter allowances, cash advances, and adjustments before closing each pay period.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <StaffSalaryPanel busy={busy} onStatus={setAppStatus} />
          </TabPageBody>
        </>
      )}

      {page === "history" && (
        <>
          <TabPageHeader resetKey={page}>
            <BillingTabGuide title="activity log">
              <BillingTabGuideText>
                See everything posted office-wide — charges, payments, SOAs, receipts, and client record changes. Filter
                by type or open a client from any row.
              </BillingTabGuideText>
            </BillingTabGuide>
          </TabPageHeader>
          <TabPageBody>
          <BillingHistoryPanel
            busy={busy}
            onOpenClient={(code) => {
              goTo(code);
            }}
          />
          </TabPageBody>
        </>
      )}

      {page === "billing" && (
        <>
      <TabPageHeader resetKey={page}>
        <BillingTabGuide title="post charges & payments">
          <BillingTabGuideText>
            Pick a regular client, choose <strong>Charge</strong> or <strong>Payment</strong>, then enter the date,
            amount, category (Professional fee, Filing fee, Notarial fee, etc.), and a short description of the work or
            payment.
          </BillingTabGuideText>
          <BillingTabGuideText>
            Same-day walk-in visitors belong on <strong>Walk-ins</strong>, not here. One-time payers belong on{" "}
            <strong>One-time fees</strong>.
          </BillingTabGuideText>
        </BillingTabGuide>
      </TabPageHeader>
      <TabPageBody className="tab-workspace tab-workspace--billing">
      <TabPickerCard
        label="Client"
        htmlFor="clientCode"
        hint={
          selected ? (
            <p>
              {selected.caseTitle} · {selected.accountStatus || "—"} · {selected.email || "No email"}
            </p>
          ) : undefined
        }
      >
        <select
          ref={clientCodeRef}
          id="clientCode"
          value={clientCode}
          disabled={ledgerSaving}
          onChange={(e) => setClientCode(e.target.value)}
          className="field"
        >
          {clients.map((client) => (
            <option key={client.code} value={client.code}>
              {client.code} — {client.name || "Unnamed"} ({formatPeso(client.balance)})
            </option>
          ))}
        </select>
      </TabPickerCard>

      <section className="tab-workspace__block">
        <p className="section-label">Input transaction</p>
        <div className="tab-subnav nav-tabs">
        <button
          type="button"
          className={`nav-tab ${tab === "charge" ? "nav-tab-active" : "nav-tab-idle"}`}
          onClick={() => {
            setTab("charge");
            window.requestAnimationFrame(() => chargeAmountRef.current?.focus());
          }}
          disabled={ledgerSaving}
        >
          Charge
        </button>
        <button
          type="button"
          className={`nav-tab ${tab === "payment" ? "nav-tab-active" : "nav-tab-idle"}`}
          onClick={() => {
            setTab("payment");
            window.requestAnimationFrame(() => paymentAmountRef.current?.focus());
          }}
          disabled={ledgerSaving}
        >
          Payment
        </button>
        </div>
      </section>

      <section className="card tab-form-panel">
        {tab === "charge" ? (
          <>
            <div className="form-grid-pair">
              <Field label="Date">
                <input
                  type="date"
                  value={chargeDate}
                  disabled={ledgerSaving}
                  onChange={(e) => setChargeDate(e.target.value)}
                  className="field"
                />
              </Field>
              <Field label="Amount">
                <input
                  ref={chargeAmountRef}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={chargeAmount}
                  disabled={ledgerSaving}
                  onChange={(e) => setChargeAmount(e.target.value)}
                  className="field"
                />
              </Field>
            </div>
            <Field label="Category">
              <select
                value={chargeCategory}
                disabled={ledgerSaving}
                onChange={(e) => setChargeCategory(e.target.value)}
                className="field"
              >
                {chargeCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <textarea
                value={chargeDescription}
                disabled={ledgerSaving}
                onChange={(e) => setChargeDescription(e.target.value)}
                placeholder="Charge description"
                className="field min-h-[86px]"
              />
            </Field>
            <div className="tab-action-bar">
              <div className="btn-row form-save-bar--sticky-mobile">
              <button
                type="button"
                disabled={ledgerSaving}
                onClick={() =>
                  void submitLedger(
                    {
                      clientCode,
                      type: "Charge",
                      date: chargeDate,
                      charge: chargeAmount,
                      category: chargeCategory,
                      description: chargeDescription
                    },
                    "Charge added."
                  )
                }
                className="btn-primary"
              >
                {ledgerSaving ? "Saving…" : "Add Charge"}
              </button>
              <button
                type="button"
                disabled={ledgerSaving}
                onClick={() =>
                  void submitLedger(
                    {
                      clientCode,
                      type: "Charge",
                      date: chargeDate,
                      charge: chargeAmount,
                      category: chargeCategory,
                      description: chargeDescription
                    },
                    "Charge added.",
                    true
                  )
                }
                className="btn-secondary"
              >
                Save &amp; add another
              </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="form-grid-pair">
              <Field label="Date">
                <input
                  type="date"
                  value={paymentDate}
                  disabled={ledgerSaving}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="field"
                />
              </Field>
              <Field label="Amount">
                <input
                  ref={paymentAmountRef}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentAmount}
                  disabled={ledgerSaving}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="field"
                />
              </Field>
            </div>
            <Field label="Method">
              <select
                value={paymentMethod}
                disabled={ledgerSaving}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="field"
              >
                {paymentMethods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference / Details">
              <input
                value={paymentDetails}
                disabled={ledgerSaving}
                onChange={(e) => setPaymentDetails(e.target.value)}
                placeholder="Bank reference, OR number, etc."
                className="field"
              />
            </Field>
            <OpenChargePicker
              charges={openCharges}
              disabled={ledgerSaving}
              onPick={(charge) => {
                setPaymentAmount(String(charge.amount));
                setPaymentIncomeType(charge.incomeType);
                setPaymentDescription(charge.description || charge.category);
                if (charge.details?.trim()) setPaymentDetails(charge.details.trim());
                setPaymentDefaultHint(`Matched open charge · ${charge.incomeType}`);
              }}
            />
            <PaymentIncomeFields
              incomeType={paymentIncomeType}
              onIncomeTypeChange={setPaymentIncomeType}
              description={paymentDescription}
              onDescriptionChange={setPaymentDescription}
              disabled={ledgerSaving}
              hint={paymentDefaultHint || undefined}
            />
            <div className="tab-action-bar">
              <div className="btn-row form-save-bar--sticky-mobile">
              <button
                type="button"
                disabled={ledgerSaving}
                onClick={() => {
                  const paymentFields = buildPaymentLedgerFields(paymentIncomeType, paymentDescription);
                  void submitLedger(
                    {
                      clientCode,
                      type: "Payment",
                      date: paymentDate,
                      payment: paymentAmount,
                      category: paymentFields.category,
                      description: paymentFields.description,
                      method: paymentMethod,
                      details: paymentDetails
                    },
                    "Payment added."
                  );
                }}
                className="btn-primary"
              >
                {ledgerSaving ? "Saving…" : "Add Payment"}
              </button>
              <button
                type="button"
                disabled={ledgerSaving}
                onClick={() => {
                  const paymentFields = buildPaymentLedgerFields(paymentIncomeType, paymentDescription);
                  void submitLedger(
                    {
                      clientCode,
                      type: "Payment",
                      date: paymentDate,
                      payment: paymentAmount,
                      category: paymentFields.category,
                      description: paymentFields.description,
                      method: paymentMethod,
                      details: paymentDetails
                    },
                    "Payment added.",
                    true
                  );
                }}
                className="btn-secondary"
              >
                Save &amp; add another
              </button>
              </div>
            </div>
          </>
        )}
      </section>

      <aside className="tab-utility-panel">
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshSpreadsheetDashboard()}
          className="btn-gold"
        >
          Update spreadsheet overview
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadData()}
          className="btn-gold"
        >
          Update
        </button>
      </aside>
      </TabPageBody>
        </>
      )}
      </PageTransition>
      ) : null}

      </FirmWorkspaceShell>
    </ClientMatterProvider>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2.5">
      <label className="mb-1.5 block text-xs font-bold text-[#4a4339]">{label}</label>
      {children}
    </div>
  );
}
