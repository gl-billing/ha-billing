"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AssignedLawyerFields } from "@/components/AssignedLawyerFields";
import { formatClientAssignedLawyers } from "@/lib/assigned-lawyers";
import { ClientCaseRoleSelect } from "@/components/ClientCaseRoleSelect";
import { ClientCaseTypeSelect } from "@/components/ClientCaseTypeSelect";
import {
  caseTypeOtherRequired,
  formatClientCaseTypeLabel,
  normalizeClientCaseType,
  showPsychologistFields,
  type ClientCaseType
} from "@/lib/client-case-type";
import { PsychologistFieldsSection } from "@/components/PsychologistFieldsSection";
import {
  caseTitleRequiredForMatterType,
  CLIENT_MATTER_TYPE_LABELS,
  formatMatterCaseCaption,
  resolveClientMatterType,
  type ClientMatterType
} from "@/lib/client-matter-type";
import type { ActivityItem, AuditLogEntry, ClientDetail, ClientLedgerSummary, ClientSummary, LedgerEntry } from "@/lib/gl-config";
import { ClientMatterTypeSelect } from "@/components/ClientMatterTypeSelect";
import { formatClientCaseLabel, formatPeso } from "@/lib/gl-config";
import { ClientActivityTimeline } from "@/components/ClientActivityTimeline";
import { ClientCodeButton } from "@/components/ClientCodeButton";
import { TasksMatterLink } from "@/components/CrossSystemLinks";
import { ClientCodeRenameForm } from "@/components/ClientCodeRenameForm";
import { PaymentRequestPanel } from "@/components/PaymentRequestPanel";
import { ClientPortalPanel } from "@/components/ClientPortalPanel";
import { ClientListTable } from "@/components/ClientListTable";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { UndoBar } from "@/components/UndoBar";
import { truncateForDisplay } from "@/lib/link-display";
import type { ClientDeletePreview } from "@/lib/sheets/client-delete-preview";
import { formatDisplayDate as formatRegisterDate } from "@/lib/office-tasks/date-only";

export type ProfileNavigate = {
  page: "billing" | "documents";
  clientCode: string;
  billingTab?: "charge" | "payment";
  docTab?: "soa" | "ar";
};

type Props = {
  busy: boolean;
  onStatus: (message: string, isError?: boolean) => void;
  onBusy: (busy: boolean) => void;
  onSaved: () => void;
  onNavigate: (nav: ProfileNavigate) => void;
  initialClientCode?: string;
  onClientCodeRenamed?: (newCode: string) => void;
};

type LedgerFilter = "all" | "charge" | "payment";
type ViewMode = "list" | "profile";

function formatDisplayDate(value: string): string {
  if (!value) return "—";
  const ymd = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return formatRegisterDate(ymd, "register");
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm text-ink sm:max-w-[65%] sm:text-right">{value ?? "—"}</dd>
    </div>
  );
}

function Section({
  title,
  action,
  children
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="section-label !mb-0">{title}</p>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <label className="mb-1.5 block text-xs font-bold text-[#4a4339]">{label}</label>
      {children}
    </div>
  );
}

function statusBadge(status: string): ReactNode {
  const normalized = status.toLowerCase();
  const variant =
    normalized === "active"
      ? "matter-status-badge--active"
      : normalized === "closed"
        ? "matter-status-badge--closed"
        : normalized === "inactive"
          ? "matter-status-badge--inactive"
          : "matter-status-badge--default";
  return <span className={`matter-status-badge ${variant}`}>{status || "Unknown"}</span>;
}

export function ClientProfile({
  busy,
  onStatus,
  onBusy,
  onSaved,
  onNavigate,
  initialClientCode,
  onClientCodeRenamed
}: Props) {
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [selectedCode, setSelectedCode] = useState(initialClientCode || "");
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<ClientLedgerSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [missingLedgerTab, setMissingLedgerTab] = useState(false);
  const [creatingLedgerTab, setCreatingLedgerTab] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState("");
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteForceAck, setDeleteForceAck] = useState(false);
  const [deleteOpenOfficeItems, setDeleteOpenOfficeItems] = useState(false);
  const [deletePreview, setDeletePreview] = useState<ClientDeletePreview | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const profileSectionRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const scrollToProfileOnSelect = useRef(false);
  const profileRequestRef = useRef(0);
  const [pendingVoidUndo, setPendingVoidUndo] = useState<{
    clientCode: string;
    sheetRow: number;
    snapshot: {
      date: string;
      type: string;
      category: string;
      description: string;
      charge: number;
      payment: number;
      method: string;
      details: string;
      documentNumber: string;
      arSent: boolean;
      pdfLink: string;
    };
  } | null>(null);
  const [pendingCloseUndo, setPendingCloseUndo] = useState<{ code: string } | null>(null);

  useEffect(() => {
    if (!pendingVoidUndo) return;
    const timer = window.setTimeout(() => setPendingVoidUndo(null), 30_000);
    return () => window.clearTimeout(timer);
  }, [pendingVoidUndo]);

  useEffect(() => {
    if (!pendingCloseUndo) return;
    const timer = window.setTimeout(() => setPendingCloseUndo(null), 30_000);
    return () => window.clearTimeout(timer);
  }, [pendingCloseUndo]);

  const [clientName, setClientName] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [matterType, setMatterType] = useState<ClientMatterType>("case");
  const [caseType, setCaseType] = useState<ClientCaseType | "">("");
  const [caseTypeOther, setCaseTypeOther] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [caseRole, setCaseRole] = useState("");
  const [courtPending, setCourtPending] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [prevBalance, setPrevBalance] = useState("");
  const [preferredGreeting, setPreferredGreeting] = useState("");
  const [clientStatus, setClientStatus] = useState("Active");
  const [assignedAttorney, setAssignedAttorney] = useState("");
  const [coAssignedAttorney, setCoAssignedAttorney] = useState("");
  const [retainerBalance, setRetainerBalance] = useState("");
  const [psychologistName, setPsychologistName] = useState("");
  const [psychologistPhone, setPsychologistPhone] = useState("");
  const [psychologistAddress, setPsychologistAddress] = useState("");

  function applyDetailToForm(c: ClientDetail) {
    setClientName(c.name);
    setCaseTitle(c.caseTitle);
    setMatterType(resolveClientMatterType(c));
    setCaseType(normalizeClientCaseType(c.caseType));
    setCaseTypeOther(c.caseTypeOther || "");
    setCaseNumber(c.caseNumber || "");
    setCaseRole(c.caseRole || "");
    setCourtPending(c.courtPending || "");
    setContactEmail(c.email);
    setContactPhone(c.phone || "");
    setClientAddress(c.address || "");
    setPrevBalance(String(c.prevBalance || 0));
    setPreferredGreeting(c.preferredGreeting || "");
    setClientStatus(c.status || "Active");
    setAssignedAttorney(c.assignedAttorney || "");
    setCoAssignedAttorney(c.coAssignedAttorney || "");
    setRetainerBalance(String(c.retainerBalance || 0));
    setPsychologistName(c.psychologistName || "");
    setPsychologistPhone(c.psychologistPhone || "");
    setPsychologistAddress(c.psychologistAddress || "");
  }

  useEffect(() => {
    void fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.isAdmin) setIsAdmin(true);
      })
      .catch(() => {
        /* non-admins: no delete UI */
      });
  }, []);

  const loadList = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (includeClosed) params.set("includeClosed", "1");

    const response = await fetch(`/api/clients?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to search clients.");
    setClients(data.clients);
    setSelectedCode((prev) => {
      if (prev && data.clients.some((c: ClientSummary) => c.code === prev)) return prev;
      return data.clients[0]?.code || "";
    });
  }, [query, includeClosed]);

  function clearProfileState() {
    setDetail(null);
    setEntries([]);
    setSummary(null);
    setActivity([]);
    setAuditLog([]);
    setMissingLedgerTab(false);
  }

  const loadProfile = useCallback(async (code: string) => {
    if (!code) {
      clearProfileState();
      setLoading(false);
      return;
    }

    const requestId = ++profileRequestRef.current;
    setLoading(true);
    clearProfileState();

    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(code)}/profile`);
      const data = await response.json();
      if (requestId !== profileRequestRef.current) return;
      if (!response.ok) throw new Error(data.error || "Unable to load client.");

      const client = data.client as ClientDetail;
      setDetail(client);
      applyDetailToForm(client);
      setEntries(data.ledger.entries as LedgerEntry[]);
      setSummary(data.ledger.summary as ClientLedgerSummary);
      setActivity(data.activity as ActivityItem[]);
      setMissingLedgerTab(data.missingLedgerTab === true);

      const auditRes = await fetch(
        `/api/audit-log?clientCode=${encodeURIComponent(code)}&limit=10`
      );
      if (requestId !== profileRequestRef.current) return;
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLog(auditData.entries || []);
      }

      if (requestId === profileRequestRef.current) {
        setLoading(false);
      }

      try {
        const fullRes = await fetch(
          `/api/clients/${encodeURIComponent(code)}/profile?includeTasks=1`
        );
        const fullData = await fullRes.json();
        if (requestId !== profileRequestRef.current) return;
        if (fullRes.ok && Array.isArray(fullData.activity)) {
          setActivity(fullData.activity as ActivityItem[]);
        }
      } catch {
        // Task/hearing timeline enrichment is optional.
      }
    } catch (error) {
      if (requestId === profileRequestRef.current) {
        throw error;
      }
    } finally {
      if (requestId === profileRequestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (initialClientCode) {
      setSelectedCode(initialClientCode);
      setViewMode("profile");
      scrollToProfileOnSelect.current = true;
    }
  }, [initialClientCode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadList().catch((e) => onStatus(e.message, true));
    }, 500);
    return () => clearTimeout(timer);
  }, [loadList, onStatus]);

  useEffect(() => {
    if (selectedCode) {
      setEditing(false);
      void loadProfile(selectedCode).catch((e) => onStatus(e.message, true));
    }
  }, [selectedCode, loadProfile, onStatus]);

  const filteredEntries = useMemo(() => {
    if (filter === "all") return [...entries].reverse();
    return entries.filter((entry) => entry.type.toLowerCase() === filter).reverse();
  }, [entries, filter]);

  const pendingArPayments = useMemo(
    () =>
      entries.filter(
        (entry) => entry.type.toLowerCase() === "payment" && entry.payment > 0 && !entry.arSent
      ),
    [entries]
  );

  async function createLedgerTab() {
    if (!selectedCode) return;
    setCreatingLedgerTab(true);
    onBusy(true);
    onStatus(`Creating ledger tab for ${selectedCode}…`);
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(selectedCode)}/ledger-tab`, {
        method: "POST"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create ledger tab.");
      onStatus(data.message || "Ledger tab created.");
      setMissingLedgerTab(false);
      onSaved();
      await loadProfile(selectedCode);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not create ledger tab.", true);
    } finally {
      setCreatingLedgerTab(false);
      onBusy(false);
    }
  }

  async function refreshProfile() {
    if (!selectedCode) return;
    onBusy(true);
    onStatus("Refreshing client profile...");
    try {
      await loadProfile(selectedCode);
      onStatus("Client profile updated.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to refresh.", true);
    } finally {
      onBusy(false);
    }
  }

  function startEditing() {
    if (detail) applyDetailToForm(detail);
    setEditing(true);
  }

  function cancelEditing() {
    if (detail) applyDetailToForm(detail);
    setEditing(false);
  }

  async function saveChanges() {
    if (!selectedCode) return;
    if (caseTitleRequiredForMatterType(matterType) && !caseTitle.trim()) {
      onStatus("Case title is required for an active case.", true);
      return;
    }
    if (caseTitleRequiredForMatterType(matterType) && !caseType) {
      onStatus("Case type is required for an active case.", true);
      return;
    }
    if (caseTypeOtherRequired(caseType) && !caseTypeOther.trim()) {
      onStatus("Please specify the case type.", true);
      return;
    }
    onBusy(true);
    onStatus("Saving client...");

    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(selectedCode)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          caseTitle,
          matterType,
          caseType,
          caseTypeOther,
          caseNumber,
          caseRole,
          courtPending,
          contactEmail,
          contactPhone,
          clientAddress,
          prevBalance,
          preferredGreeting,
          clientStatus,
          assignedAttorney,
          coAssignedAttorney,
          retainerBalance,
          psychologistName,
          psychologistPhone,
          psychologistAddress
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save.");
      onStatus(result.message || "Client updated.");
      setEditing(false);
      onSaved();
      await loadProfile(selectedCode);
      await loadList();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to save.", true);
    } finally {
      onBusy(false);
    }
  }

  function openProfile(code: string) {
    if (code !== selectedCode) {
      profileRequestRef.current += 1;
    }
    setSelectedCode(code);
    setViewMode("profile");
    scrollToProfileOnSelect.current = true;
  }

  const profileReady = Boolean(detail && detail.code === selectedCode && !loading);

  useEffect(() => {
    if (viewMode !== "profile" || !scrollToProfileOnSelect.current || !profileReady) return;
    scrollToProfileOnSelect.current = false;
    const el = heroSectionRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [viewMode, selectedCode, profileReady]);

  function printProfile() {
    window.print();
  }

  async function closeClientAccount() {
    if (!selectedCode) return;
    onBusy(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(selectedCode)}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: closeReason })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to close client.");
      onStatus(json.message || "Client closed.");
      setShowCloseModal(false);
      setCloseReason("");
      setPendingCloseUndo({ code: selectedCode });
      onSaved();
      await loadProfile(selectedCode);
      await loadList();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to close.", true);
    } finally {
      onBusy(false);
    }
  }

  async function loadDeletePreview(code: string) {
    setDeletePreviewLoading(true);
    setDeletePreview(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(code)}/delete-preview`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load delete preview.");
      setDeletePreview(json.preview as ClientDeletePreview);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not load delete preview.", true);
    } finally {
      setDeletePreviewLoading(false);
    }
  }

  async function deleteClientPermanently() {
    if (!selectedCode || !detail) return;
    if (deleteConfirmCode.trim() !== detail.code) {
      onStatus("Type the exact client code to confirm deletion.", true);
      return;
    }
    if (!deleteAck) {
      onStatus("Check the box to confirm you understand this cannot be undone.", true);
      return;
    }

    const needsForce =
      (detail?.balance ?? 0) > 0.005 || (pendingArPayments?.length ?? 0) > 0;
    if (needsForce && !deleteForceAck) {
      onStatus("Check the box to confirm delete despite balance or pending AR.", true);
      return;
    }

    onBusy(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(selectedCode)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmCode: deleteConfirmCode.trim(),
          force: needsForce,
          deleteOpenOfficeItems
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete client.");

      onStatus(json.message || "Client deleted.");
      setShowDeleteModal(false);
      setDeleteConfirmCode("");
      setDeleteAck(false);
      setDeleteForceAck(false);
      setDeleteOpenOfficeItems(false);
      setDeletePreview(null);
      setViewMode("list");
      setSelectedCode("");
      setDetail(null);
      onSaved();
      await loadList();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to delete client.", true);
    } finally {
      onBusy(false);
    }
  }

  async function undoCloseClient() {
    const code = pendingCloseUndo?.code;
    if (!code) return;
    setPendingCloseUndo(null);
    onBusy(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(code)}/reopen`, {
        method: "POST"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reopen client.");
      onStatus(json.message || "Client reopened.");
      onSaved();
      await loadProfile(code);
      await loadList();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to reopen.", true);
    } finally {
      onBusy(false);
    }
  }

  async function reopenClientAccount() {
    if (!selectedCode) return;
    onBusy(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(selectedCode)}/reopen`, {
        method: "POST"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reopen client.");
      onStatus(json.message || "Client reopened.");
      onSaved();
      await loadProfile(selectedCode);
      await loadList();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to reopen.", true);
    } finally {
      onBusy(false);
    }
  }

  async function voidEntry(entry: LedgerEntry) {
    if (!selectedCode) return;
    if (!window.confirm(`Void this ${entry.type.toLowerCase()} entry? You can undo for 30 seconds.`)) return;

    const snapshot = {
      date: entry.date,
      type: entry.type,
      category: entry.category,
      description: entry.description,
      charge: entry.charge,
      payment: entry.payment,
      method: entry.method,
      details: entry.details,
      documentNumber: entry.documentNumber,
      arSent: entry.arSent,
      pdfLink: entry.pdfLink
    };

    onBusy(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientCode: selectedCode, sheetRow: entry.sheetRow })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to void entry.");
      onStatus(json.message || "Entry voided.");
      onSaved();
      await loadProfile(selectedCode);
      setPendingVoidUndo({ clientCode: selectedCode, sheetRow: entry.sheetRow, snapshot });
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to void.", true);
    } finally {
      onBusy(false);
    }
  }

  async function undoVoidRestore() {
    if (!pendingVoidUndo) return;
    const payload = pendingVoidUndo;
    setPendingVoidUndo(null);
    onBusy(true);
    try {
      const restoreRes = await fetch("/api/ledger", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const restoreJson = await restoreRes.json();
      if (!restoreRes.ok) throw new Error(restoreJson.error || "Could not restore entry.");
      onStatus(restoreJson.message || "Entry restored.");
      onSaved();
      await loadProfile(payload.clientCode);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not restore entry.", true);
    } finally {
      onBusy(false);
    }
  }

  async function saveEntryEdit() {
    if (!editingEntry || !selectedCode) return;
    onBusy(true);
    try {
      const isPayment = editingEntry.type.toLowerCase() === "payment";
      const res = await fetch("/api/ledger", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCode: selectedCode,
          sheetRow: editingEntry.sheetRow,
          date: editingEntry.date,
          category: editingEntry.category,
          description: editingEntry.description,
          charge: isPayment ? undefined : editingEntry.charge,
          payment: isPayment ? editingEntry.payment : undefined,
          method: editingEntry.method,
          details: editingEntry.details
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save entry.");
      onStatus(json.message || "Entry updated.");
      setEditingEntry(null);
      onSaved();
      await loadProfile(selectedCode);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to save.", true);
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="space-y-3 print:space-y-2">
    <section className="card no-print">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="section-label !mb-0">Client directory</p>
          <div className="flex gap-1">
            <button
              type="button"
              className={`rounded px-2 py-1 text-[10px] font-bold ${viewMode === "list" ? "bg-[#171411] text-white" : "border border-line"}`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-[10px] font-bold ${viewMode === "profile" ? "bg-[#171411] text-white" : "border border-line"}`}
              disabled={!selectedCode}
              onClick={() => {
                setViewMode("profile");
                scrollToProfileOnSelect.current = true;
              }}
            >
              Profile
            </button>
          </div>
        </div>
        <label className="mb-1.5 block text-xs font-bold text-[#4a4339]">Find client</label>
        <input
          className="field"
          value={query}
          disabled={busy}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Code, name, case title, email..."
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={includeClosed}
            disabled={busy}
            onChange={(e) => setIncludeClosed(e.target.checked)}
          />
          Include closed clients
        </label>

        <div className="mt-3">
          {loading && !clients.length ? (
            <Skeleton lines={4} />
          ) : (
            <ClientListTable
              clients={clients}
              busy={busy}
              onOpenClient={(code) => openProfile(code)}
            />
          )}
        </div>
      </section>

      {viewMode === "profile" && (
        <div ref={profileSectionRef} className="scroll-mt-3 space-y-3">
      {pendingCloseUndo ? (
        <UndoBar
          busy={busy}
          title={
            <>
              Client <strong>{pendingCloseUndo.code}</strong> was closed.
            </>
          }
          onUndo={() => void undoCloseClient()}
        />
      ) : null}
      {selectedCode && !profileReady ? (
        <section className="card no-print" aria-busy="true" aria-live="polite">
          <p className="section-label">Client profile</p>
          <Skeleton lines={8} />
          <p className="mt-2 text-xs text-muted">Loading {selectedCode}…</p>
        </section>
      ) : null}

      {profileReady && detail && (
        <>
        {missingLedgerTab && (
          <section className="card border-l-4 border-amber-500 bg-amber-50/80 no-print">
            <p className="text-sm font-bold text-amber-950">Ledger tab missing</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
              <strong>{detail.code}</strong> is on Master List but has no billing tab yet, so charges,
              payments, and transaction history cannot load. Create the tab from your <strong>Template</strong>{" "}
              sheet.
            </p>
            <button
              type="button"
              className="btn-primary mt-3 !text-xs"
              disabled={busy || creatingLedgerTab}
              onClick={() => void createLedgerTab()}
            >
              {creatingLedgerTab ? "Creating tab…" : `Create ledger tab (${detail.code})`}
            </button>
          </section>
        )}
        <section
          ref={heroSectionRef}
          className="card client-profile-hero scroll-mt-3 print:border-none print:shadow-none"
        >
            <div className="client-profile-hero__top">
              <div className="client-profile-hero__identity">
                <h2 className="text-lg font-extrabold text-ink">{detail.name || "Unnamed client"}</h2>
                <ClientCodeButton
                  code={detail.code}
                  className="text-xs font-bold uppercase tracking-wide text-muted no-underline"
                />
                <div className="mt-2">{statusBadge(detail.status)}</div>
              </div>
              <div className="client-profile-hero__balance">
                <p className="client-profile-hero__balance-label">Total due</p>
                <p className="client-profile-hero__balance-value">{formatPeso(detail.balance)}</p>
                <p className="client-profile-hero__balance-status">{detail.accountStatus || "—"}</p>
              </div>
            </div>

            <div className="client-profile-hero__actions no-print">
              <TasksMatterLink
                clientCode={detail.code}
                caseHint={formatClientCaseLabel(detail.name, detail.caseTitle)}
                className="client-profile-hero__action-btn cross-system-link cross-system-link--inline"
              />
              <button
                type="button"
                className="client-profile-hero__action-btn client-profile-hero__action-btn--gold"
                disabled={busy}
                onClick={() => void refreshProfile()}
              >
                Refresh
              </button>
              <button
                type="button"
                className="client-profile-hero__action-btn"
                disabled={busy}
                onClick={printProfile}
              >
                Print
              </button>
              {detail.status.toLowerCase() === "closed" ? (
                <button
                  type="button"
                  className="client-profile-hero__action-btn"
                  disabled={busy}
                  onClick={() => void reopenClientAccount()}
                >
                  Reopen
                </button>
              ) : (
                <button
                  type="button"
                  className="client-profile-hero__action-btn"
                  disabled={busy}
                  onClick={() => setShowCloseModal(true)}
                >
                  Close client
                </button>
              )}
            </div>

            <div className="client-profile-hero__stats">
              <div className="client-profile-hero__stat-box">
                <p className="client-profile-hero__stat-label">Charges</p>
                <p className="client-profile-hero__stat-value">
                  {formatPeso(summary?.charges ?? detail.newCharges)}
                </p>
              </div>
              <div className="client-profile-hero__stat-box">
                <p className="client-profile-hero__stat-label">Payments</p>
                <p className="client-profile-hero__stat-value client-profile-hero__stat-value--positive">
                  {formatPeso(summary?.payments ?? detail.paymentsTotal)}
                </p>
              </div>
              <div className="client-profile-hero__stat-box">
                <p className="client-profile-hero__stat-label">Transactions</p>
                <p className="client-profile-hero__stat-value">{summary?.entryCount ?? entries.length}</p>
              </div>
            </div>
          </section>

          {detail.balance > 0.005 ? (
            <PaymentRequestPanel
              key={`payment-${detail.code}`}
              clientCode={detail.code}
              clientName={detail.name}
              balance={detail.balance}
              email={detail.email}
              busy={busy || loading}
              onStatus={onStatus}
            />
          ) : null}

          <ClientPortalPanel
            key={`portal-${detail.code}`}
            clientCode={detail.code}
            clientName={detail.name}
            balance={detail.balance}
            email={detail.email}
            busy={busy || loading}
            onStatus={onStatus}
          />

          <section className="card">
            <p className="section-label">Desk actions</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                disabled={busy}
                className="btn-secondary min-h-[40px] text-xs"
                onClick={() =>
                  onNavigate({ page: "billing", clientCode: detail.code, billingTab: "charge" })
                }
              >
                Add charge
              </button>
              <button
                type="button"
                disabled={busy}
                className="btn-secondary min-h-[40px] text-xs"
                onClick={() =>
                  onNavigate({ page: "billing", clientCode: detail.code, billingTab: "payment" })
                }
              >
                Add payment
              </button>
              <button
                type="button"
                disabled={busy}
                className="btn-secondary min-h-[40px] text-xs"
                onClick={() =>
                  onNavigate({ page: "documents", clientCode: detail.code, docTab: "soa" })
                }
              >
                Send SOA
              </button>
              <button
                type="button"
                disabled={busy}
                className="btn-secondary min-h-[40px] text-xs"
                onClick={() =>
                  onNavigate({ page: "documents", clientCode: detail.code, docTab: "ar" })
                }
              >
                Issue AR
              </button>
            </div>
          </section>

          {editing ? (
            <Section title="Edit client">
              <p className="mb-3 text-xs text-muted">
                Client code <strong>{detail.code}</strong> cannot be changed here.
              </p>

              <Field label="Client name *">
                <input
                  className="field"
                  value={clientName}
                  disabled={busy}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </Field>
              <Field label="Client file type">
                <ClientMatterTypeSelect
                  value={matterType}
                  disabled={busy}
                  onChange={(next) => {
                    setMatterType(next);
                    if (!caseTitleRequiredForMatterType(next)) {
                      setCaseTitle("");
                      setCaseRole("");
                      setCaseType("");
                      setCaseTypeOther("");
                    }
                  }}
                />
              </Field>
              {caseTitleRequiredForMatterType(matterType) ? (
                <>
                  <Field label="Case title *">
                    <input
                      className="field"
                      value={caseTitle}
                      disabled={busy}
                      onChange={(e) => setCaseTitle(e.target.value)}
                    />
                  </Field>
                  <Field label="Case type *">
                    <ClientCaseTypeSelect
                      caseType={caseType}
                      caseTypeOther={caseTypeOther}
                      disabled={busy}
                      onCaseTypeChange={setCaseType}
                      onCaseTypeOtherChange={setCaseTypeOther}
                    />
                  </Field>
                </>
              ) : null}
              {caseTitleRequiredForMatterType(matterType) ? (
                <Field label="Role in case">
                  <ClientCaseRoleSelect value={caseRole} disabled={busy} onChange={setCaseRole} />
                </Field>
              ) : null}
              {caseTitleRequiredForMatterType(matterType) ? (
                <Field label="Case number">
                  <input
                    className="field"
                    value={caseNumber}
                    disabled={busy}
                    onChange={(e) => setCaseNumber(e.target.value)}
                  />
                </Field>
              ) : null}
              {caseTitleRequiredForMatterType(matterType) ? (
                <Field label="Court where pending">
                  <input
                    className="field"
                    value={courtPending}
                    disabled={busy}
                    onChange={(e) => setCourtPending(e.target.value)}
                    placeholder="e.g. RTC Branch 45, Quezon City"
                  />
                </Field>
              ) : null}
              <Field label="Contact email">
                <input
                  className="field"
                  type="email"
                  value={contactEmail}
                  disabled={busy}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </Field>
              <Field label="Contact phone">
                <input
                  className="field"
                  value={contactPhone}
                  disabled={busy}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </Field>
              <Field label="Client address">
                <textarea
                  className="field min-h-[72px]"
                  value={clientAddress}
                  disabled={busy}
                  onChange={(e) => setClientAddress(e.target.value)}
                />
              </Field>
              <PsychologistFieldsSection
                caseType={caseType}
                caseTitle={caseTitle}
                name={psychologistName}
                phone={psychologistPhone}
                address={psychologistAddress}
                disabled={busy}
                onNameChange={setPsychologistName}
                onPhoneChange={setPsychologistPhone}
                onAddressChange={setPsychologistAddress}
              />
              <div className="form-grid-pair">
                <Field label="Previous balance">
                  <input
                    className="field"
                    type="number"
                    step="0.01"
                    value={prevBalance}
                    disabled={busy}
                    onChange={(e) => setPrevBalance(e.target.value)}
                  />
                </Field>
                <Field label="Case status">
                  <select
                    className="field"
                    value={clientStatus}
                    disabled={busy}
                    onChange={(e) => setClientStatus(e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Closed">Closed</option>
                  </select>
                </Field>
              </div>
              <Field label="Preferred greeting">
                <input
                  className="field"
                  value={preferredGreeting}
                  disabled={busy}
                  onChange={(e) => setPreferredGreeting(e.target.value)}
                />
              </Field>
              <AssignedLawyerFields
                primaryLawyer={assignedAttorney}
                secondaryLawyer={coAssignedAttorney}
                disabled={busy}
                onPrimaryChange={setAssignedAttorney}
                onSecondaryChange={setCoAssignedAttorney}
              />
              <Field label="Retainer balance">
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  value={retainerBalance}
                  disabled={busy}
                  onChange={(e) => setRetainerBalance(e.target.value)}
                />
              </Field>

              <div className="form-grid-pair mt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelEditing}
                  className="min-h-[44px] rounded-md border border-line text-sm font-bold text-ink hover:bg-[#f5f3ef]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveChanges()}
                  className="min-h-[44px] rounded-md border border-gold-2/55 bg-gradient-to-br from-[#171411] to-[#3a3022] text-sm font-extrabold text-white shadow-lg"
                >
                  Save changes
                </button>
              </div>
            </Section>
          ) : (
            <>
              <Section
                title="Client information"
                action={
                  <button
                    type="button"
                    disabled={busy}
                    onClick={startEditing}
                    className="btn-gold"
                  >
                    Edit
                  </button>
                }
              >
                <dl className="space-y-2">
                  <InfoRow label="Client name" value={detail.name} />
                  <InfoRow label="Email" value={detail.email} />
                  <InfoRow label="Phone" value={detail.phone} />
                  <InfoRow label="Address" value={detail.address} />
                  <InfoRow label="Preferred greeting" value={detail.preferredGreeting} />
                  <InfoRow
                    label="Assigned lawyers"
                    value={formatClientAssignedLawyers(detail.assignedAttorney, detail.coAssignedAttorney) || "—"}
                  />
                  <InfoRow label="Retainer balance" value={formatPeso(detail.retainerBalance)} />
                  {detail.closeReason ? (
                    <InfoRow label="Close reason" value={detail.closeReason} />
                  ) : null}
                  {detail.closedDate ? (
                    <InfoRow label="Closed date" value={detail.closedDate} />
                  ) : null}
                </dl>
              </Section>

              <Section title="Case details">
                <dl className="space-y-2">
                  <InfoRow
                    label="File type"
                    value={CLIENT_MATTER_TYPE_LABELS[resolveClientMatterType(detail)]}
                  />
                  {formatMatterCaseCaption(detail) ? (
                    <InfoRow label="Case" value={formatMatterCaseCaption(detail)} />
                  ) : null}
                  {formatClientCaseTypeLabel(detail.caseType, detail.caseTypeOther) ? (
                    <InfoRow
                      label="Case type"
                      value={formatClientCaseTypeLabel(detail.caseType, detail.caseTypeOther)}
                    />
                  ) : null}
                  {caseTitleRequiredForMatterType(resolveClientMatterType(detail)) ? (
                    <>
                      <InfoRow label="Role in case" value={detail.caseRole} />
                      <InfoRow label="Case number" value={detail.caseNumber} />
                      <InfoRow label="Court where pending" value={detail.courtPending} />
                    </>
                  ) : null}
                  <InfoRow label="Case status" value={statusBadge(detail.status)} />
                  {showPsychologistFields(detail) ? (
                    <>
                      <InfoRow label="Psychologist" value={detail.psychologistName} />
                      <InfoRow label="Psychologist contact" value={detail.psychologistPhone} />
                      <InfoRow label="Psychologist address" value={detail.psychologistAddress} />
                    </>
                  ) : null}
                </dl>
              </Section>

              <Section title="Billing & documents">
                <dl className="space-y-2">
                  <InfoRow label="Previous balance" value={formatPeso(detail.prevBalance)} />
                  <InfoRow label="Account status" value={detail.accountStatus} />
                  <InfoRow label="Last SOA sent" value={formatDisplayDate(detail.soaSent)} />
                  <InfoRow label="Last billing date" value={formatDisplayDate(detail.lastBillingDate)} />
                  <InfoRow label="Last invoice no." value={detail.lastInvoiceNumber} />
                  <InfoRow
                    label="Last invoice"
                    value={
                      detail.lastInvoiceUrl ? (
                        <a
                          href={detail.lastInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-[#1a4d8f] underline"
                        >
                          Open invoice PDF
                        </a>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    label="AR pending (master)"
                    value={detail.arPending === "Yes" ? "Yes — receipt needed" : detail.arPending || "No"}
                  />
                  <InfoRow label="Last activity" value={formatDisplayDate(detail.lastActivity)} />
                  <InfoRow label="Next follow-up" value={formatDisplayDate(detail.nextFollowUp)} />
                </dl>

                {pendingArPayments.length > 0 && (
                  <div className="mt-4 border-t border-line/60 pt-3">
                    <p className="mb-2 text-xs font-bold text-[#8b1e1e]">
                      Payments without acknowledgment receipt ({pendingArPayments.length})
                    </p>
                    <div className="space-y-1.5">
                      {pendingArPayments.map((entry) => (
                        <div
                          key={entry.sheetRow}
                          className="rounded border border-line/60 bg-[#faf9f7] px-2 py-1.5 text-xs"
                        >
                          {entry.date} · {formatPeso(entry.payment)} ·{" "}
                          {entry.description || entry.category || "Payment"}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            </>
          )}

          <Section title="Matter timeline">
            <ClientActivityTimeline items={activity} />
          </Section>

          {auditLog.length > 0 && (
            <Section title="Audit log">
              <div className="space-y-1.5">
                {auditLog.map((entry) => (
                  <div key={entry.logRow} className="audit-log-entry">
                    <p className="audit-log-entry__line font-bold text-ink" title={entry.summary}>
                      {truncateForDisplay(entry.summary, 56)}
                    </p>
                    <p className="audit-log-entry__line text-muted" title={`${entry.timestamp} · ${entry.user} · ${entry.action}`}>
                      {truncateForDisplay(`${entry.timestamp} · ${entry.user} · ${entry.action}`, 56)}
                    </p>
                    {entry.details ? (
                      <p className="audit-log-entry__line text-muted" title={entry.details}>
                        {truncateForDisplay(entry.details, 48)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Transaction history">
            {pendingVoidUndo ? (
              <UndoBar
                busy={busy}
                title={
                  <>
                    Row <strong>{pendingVoidUndo.sheetRow}</strong> was voided.
                  </>
                }
                onUndo={() => void undoVoidRestore()}
              />
            ) : null}
            <div className="mb-3 flex flex-wrap gap-1">
              {(
                [
                  ["all", "All"],
                  ["charge", "Charges only"],
                  ["payment", "Payments only"]
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  className={`rounded px-2.5 py-1 text-[11px] font-bold ${
                    filter === id
                      ? "bg-[#171411] text-white"
                      : "border border-line text-ink hover:bg-[#f5f3ef]"
                  }`}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {!filteredEntries.length ? (
              <EmptyState compact message="No transactions found for this filter." />
            ) : (
              <div className="space-y-2">
                {filteredEntries.map((entry) => {
                  const isPayment = entry.type.toLowerCase() === "payment";
                  const isVoid = entry.type.toLowerCase() === "void";
                  const amount = isPayment ? entry.payment : entry.charge;
                  return (
                    <article
                      key={entry.sheetRow}
                      className={`rounded-md border border-line/70 bg-[#faf9f7] p-2.5 text-sm ${isVoid ? "opacity-60" : ""}`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-ink">{entry.date}</p>
                          <p className="text-[11px] font-bold uppercase text-muted">{entry.type}</p>
                        </div>
                        <div className="text-right">
                          {!isVoid && (
                            <p
                              className={`font-extrabold ${isPayment ? "text-[#1f6b3a]" : "text-[#8b1e1e]"}`}
                            >
                              {isPayment ? "−" : "+"}
                              {formatPeso(amount)}
                            </p>
                          )}
                          {!isVoid && !entry.documentNumber && !entry.arSent && (
                            <div className="no-print mt-1 flex justify-end gap-1">
                              <button
                                type="button"
                                className="text-[10px] font-bold text-gold-dark underline"
                                disabled={busy}
                                onClick={() => setEditingEntry({ ...entry })}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="text-[10px] font-bold text-red-700 underline"
                                disabled={busy}
                                onClick={() => void voidEntry(entry)}
                              >
                                Void
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-ink">{entry.description || entry.category || "—"}</p>
                      {entry.category && entry.description && (
                        <p className="text-xs text-muted">{entry.category}</p>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                        <span>Balance: {formatPeso(entry.balance)}</span>
                        {entry.method ? <span>Method: {entry.method}</span> : null}
                        {entry.details ? (
                          <span className="col-span-2">Details: {entry.details}</span>
                        ) : null}
                        {entry.documentNumber ? <span>Doc #: {entry.documentNumber}</span> : null}
                        {isPayment ? (
                          <span>{entry.arSent ? "AR issued" : "No AR yet"}</span>
                        ) : null}
                      </div>
                      {entry.pdfLink ? (
                        <a
                          href={entry.pdfLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-xs font-bold text-[#1a4d8f] underline"
                        >
                          View PDF
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </Section>

          {isAdmin && detail && (
            <section className="card border border-[#d4c4a0]/80 bg-[#faf8f4]">
              <p className="section-label">Client code (owner / admin)</p>
              <p className="mb-2 text-xs text-muted">
                Current code: <strong className="text-ink">{detail.code}</strong> — used as the ledger tab name
                and task/event ID prefix.
              </p>
              <ClientCodeRenameForm
                currentCode={detail.code}
                busy={busy}
                onBusy={onBusy}
                onStatus={onStatus}
                onRenamed={(newCode) => {
                  setSelectedCode(newCode);
                  onClientCodeRenamed?.(newCode);
                  onSaved();
                  void loadList().then(() => loadProfile(newCode)).catch((e) => onStatus(e.message, true));
                }}
              />
            </section>
          )}

          {isAdmin && (
            <section className="card border-2 border-red-200/80 bg-red-50/40">
              <p className="section-label text-red-900">Danger zone (owner / admin)</p>
              <p className="mb-3 text-xs leading-relaxed text-red-900/90">
                Permanently removes this client from the Master List and deletes the ledger tab.
                SOA PDFs on Drive are not removed.
              </p>
              <button
                type="button"
                className="rounded-md border-2 border-red-700 bg-white px-3 py-2 text-xs font-extrabold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  setDeleteConfirmCode("");
                  setDeleteAck(false);
                  setDeleteForceAck(false);
                  setDeleteOpenOfficeItems(false);
                  setDeletePreview(null);
                  setShowDeleteModal(true);
                  if (detail?.code) void loadDeletePreview(detail.code);
                }}
              >
                Permanently delete client…
              </button>
              {detail.balance > 0.005 || pendingArPayments.length > 0 ? (
                <p className="mt-2 text-[11px] font-bold text-red-800">
                  {detail.balance > 0.005
                    ? `Balance is ${formatPeso(detail.balance)} — you can still delete with extra confirmation in the next step.`
                    : "Pending AR on file — extra confirmation required in the next step."}
                </p>
              ) : null}
            </section>
          )}
        </>
      )}
        </div>
      )}

      {showDeleteModal && detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-h-[90vh] max-w-lg w-full overflow-y-auto border-2 border-red-300">
            <p className="section-label text-red-900">Permanently delete client</p>
            <p className="mb-3 text-xs text-muted">
              This removes <strong>{detail.code}</strong> — {detail.name}. This cannot be undone.
            </p>

            <section className="mb-4 rounded-lg border border-red-200/80 bg-red-50/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-red-900">Review before deleting</p>
              {deletePreviewLoading ? (
                <p className="mt-2 text-xs text-muted">Loading balances and open tasks…</p>
              ) : deletePreview ? (
                <div className="mt-2 space-y-3 text-xs text-ink">
                  <ul className="space-y-1">
                    <li>
                      <strong>Balance due:</strong>{" "}
                      {deletePreview.balance > 0.005 ? formatPeso(deletePreview.balance) : "None"}
                    </li>
                    <li>
                      <strong>Pending AR:</strong>{" "}
                      {deletePreview.pendingArCount > 0
                        ? `${deletePreview.pendingArCount} payment(s) without acknowledgment receipt`
                        : "None"}
                    </li>
                    <li>
                      <strong>Open office tasks:</strong> {deletePreview.openTaskCount}
                    </li>
                    <li>
                      <strong>Open hearings / events:</strong> {deletePreview.openEventCount}
                    </li>
                  </ul>

                  {deletePreview.openTaskCount + deletePreview.openEventCount > 0 ? (
                    <div>
                      <p className="mb-2 font-bold text-red-900">
                        Pending tasks and hearings still linked to this client
                      </p>
                      <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-red-200/70 bg-white p-2">
                        {[...deletePreview.openTasks, ...deletePreview.openEvents].map((item) => (
                          <li key={`${item.source}-${item.id}`} className="border-b border-[#ece7df] pb-2 last:border-0 last:pb-0">
                            <p className="font-bold text-ink">
                              {item.source === "Task" ? "Task" : "Event"}
                              {item.id ? ` · ${item.id}` : ""}
                            </p>
                            <p className="mt-0.5 text-muted">{item.title}</p>
                            <p className="mt-0.5 text-[11px] text-muted">
                              {item.clientCase}
                              {item.date ? ` · Due ${formatDisplayDate(item.date)}` : ""}
                              {item.assignee ? ` · ${item.assignee}` : ""}
                              {item.status ? ` · ${item.status}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11px] leading-relaxed text-red-900/90">
                        {deleteOpenOfficeItems
                          ? "Checked items above will be permanently removed from Master Tasks and Hearings & Events."
                          : "Leave unchecked to keep these in Office Tasks, or check the box below to delete them with the client."}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted">No open tasks or hearings linked to this client.</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  Balance: {detail.balance > 0.005 ? formatPeso(detail.balance) : "None"}
                  {pendingArPayments.length > 0
                    ? ` · Pending AR: ${pendingArPayments.length}`
                    : ""}
                </p>
              )}
            </section>

            <Field label={`Type ${detail.code} to confirm`}>
              <input
                className="field"
                value={deleteConfirmCode}
                disabled={busy}
                autoComplete="off"
                onChange={(e) => setDeleteConfirmCode(e.target.value)}
                placeholder={detail.code}
              />
            </Field>
            <label className="mt-3 flex items-start gap-2 text-xs text-ink">
              <input
                type="checkbox"
                checked={deleteAck}
                disabled={busy}
                className="mt-0.5"
                onChange={(e) => setDeleteAck(e.target.checked)}
              />
              I understand the ledger tab and Master List row will be deleted permanently.
            </label>
            {deletePreview && deletePreview.openTaskCount + deletePreview.openEventCount > 0 ? (
              <label className="mt-2 flex items-start gap-2 text-xs font-bold text-red-900">
                <input
                  type="checkbox"
                  checked={deleteOpenOfficeItems}
                  disabled={busy}
                  className="mt-0.5"
                  onChange={(e) => setDeleteOpenOfficeItems(e.target.checked)}
                />
                Also permanently delete the open tasks and hearings listed above from Office Tasks.
              </label>
            ) : null}
            {(detail.balance > 0.005 || pendingArPayments.length > 0) && (
              <label className="mt-2 flex items-start gap-2 text-xs font-bold text-red-900">
                <input
                  type="checkbox"
                  checked={deleteForceAck}
                  disabled={busy}
                  className="mt-0.5"
                  onChange={(e) => setDeleteForceAck(e.target.checked)}
                />
                Delete anyway
                {detail.balance > 0.005 ? ` (balance ${formatPeso(detail.balance)})` : ""}
                {pendingArPayments.length > 0 ? " (pending AR)" : ""}.
              </label>
            )}
            <div className="form-grid-pair mt-4">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePreview(null);
                  setDeleteOpenOfficeItems(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-red-800 px-3 py-2 text-xs font-extrabold text-white hover:bg-red-900 disabled:opacity-50"
                disabled={
                  busy ||
                  deleteConfirmCode.trim() !== detail.code ||
                  !deleteAck ||
                  ((detail.balance > 0.005 || pendingArPayments.length > 0) && !deleteForceAck)
                }
                onClick={() => void deleteClientPermanently()}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card client-profile-modal max-w-md w-full">
            <p className="section-label">Close client account</p>
            <p className="client-profile-modal__desc">
              This marks the client as closed in the Master List. You can undo for 30 seconds after closing, or reopen later from the profile.
            </p>
            <textarea
              className="field client-profile-modal__textarea"
              value={closeReason}
              disabled={busy}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="Reason for closing (optional)"
            />
            <div className="client-profile-modal__actions">
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setShowCloseModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void closeClientAccount()}>
                Confirm close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-w-sm w-full">
            <p className="section-label">Edit {editingEntry.type}</p>
            <Field label="Description">
              <input
                className="field"
                value={editingEntry.description}
                disabled={busy}
                onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <input
                className="field"
                value={editingEntry.category}
                disabled={busy}
                onChange={(e) => setEditingEntry({ ...editingEntry, category: e.target.value })}
              />
            </Field>
            <Field label={editingEntry.type.toLowerCase() === "payment" ? "Payment amount" : "Charge amount"}>
              <input
                className="field"
                type="number"
                step="0.01"
                value={editingEntry.type.toLowerCase() === "payment" ? editingEntry.payment : editingEntry.charge}
                disabled={busy}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (editingEntry.type.toLowerCase() === "payment") {
                    setEditingEntry({ ...editingEntry, payment: val });
                  } else {
                    setEditingEntry({ ...editingEntry, charge: val });
                  }
                }}
              />
            </Field>
            <div className="form-grid-pair mt-3">
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditingEntry(null)}>
                Cancel
              </button>
              <button type="button" className="btn-gold" disabled={busy} onClick={() => void saveEntryEdit()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
