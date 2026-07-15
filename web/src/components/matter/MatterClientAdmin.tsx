"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ClientDetail, LedgerEntry } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { ClientCodeRenameForm } from "@/components/ClientCodeRenameForm";
import { AssignedLawyerFields } from "@/components/AssignedLawyerFields";
import { formatClientAssignedLawyers } from "@/lib/assigned-lawyers";
import { ClientMatterTypeSelect } from "@/components/ClientMatterTypeSelect";
import { PsychologistFieldsSection } from "@/components/PsychologistFieldsSection";
import { ClientCaseTypeSelect } from "@/components/ClientCaseTypeSelect";
import { ClientCaseRoleSelect } from "@/components/ClientCaseRoleSelect";
import {
  caseTypeOtherRequired,
  formatClientCaseTypeLabel,
  normalizeClientCaseType,
  showPsychologistFields,
  type ClientCaseType
} from "@/lib/client-case-type";
import {
  caseTitleRequiredForMatterType,
  CLIENT_MATTER_TYPE_LABELS,
  formatMatterCaseCaption,
  resolveClientMatterType,
  type ClientMatterType
} from "@/lib/client-matter-type";
import { MatterLedgerHistory } from "@/components/matter/MatterLedgerHistory";
import type { ClientDeletePreview } from "@/lib/sheets/client-delete-preview";
import {
  birthdayToDateInputValue,
  formatBirthdayDisplay,
  isBirthdayToday
} from "@/lib/birthday-greeting";
import { notifyBirthdaysRefresh } from "@/components/TodayBirthdaysProvider";
import { UndoBar } from "@/components/UndoBar";
import { parseApiJson } from "@/lib/parse-api-response";
import { formatDisplayDate as formatRegisterDate } from "@/lib/office-tasks/date-only";

type Props = {
  detail: ClientDetail;
  ledgerEntries: LedgerEntry[];
  busy: boolean;
  openOnMount?: boolean;
  autoEdit?: boolean;
  onBusy: (busy: boolean) => void;
  onStatus: (message: string, isError?: boolean) => void;
  onSaved: () => void;
  onCodeRenamed: (newCode: string) => void;
  onDeleted: () => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <label className="mb-1.5 block text-xs font-bold text-[#4a4339]">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm text-ink sm:max-w-[65%] sm:text-right">{value ?? "—"}</dd>
    </div>
  );
}

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

function applyDetailToForm(c: ClientDetail) {
  return {
    clientName: c.name,
    caseTitle: c.caseTitle,
    matterType: resolveClientMatterType(c),
    caseType: normalizeClientCaseType(c.caseType),
    caseTypeOther: c.caseTypeOther || "",
    caseNumber: c.caseNumber || "",
    caseRole: c.caseRole || "",
    courtPending: c.courtPending || "",
    contactEmail: c.email,
    contactPhone: c.phone || "",
    clientAddress: c.address || "",
    prevBalance: String(c.prevBalance || 0),
    preferredGreeting: c.preferredGreeting || "",
    clientStatus: c.status || "Active",
    assignedAttorney: c.assignedAttorney || "",
    coAssignedAttorney: c.coAssignedAttorney || "",
    retainerBalance: String(c.retainerBalance || 0),
    birthday: birthdayToDateInputValue(c.birthday),
    psychologistName: c.psychologistName || "",
    psychologistPhone: c.psychologistPhone || "",
    psychologistAddress: c.psychologistAddress || ""
  };
}

export function MatterAdvancedSettings({
  detail,
  ledgerEntries,
  busy,
  openOnMount = false,
  autoEdit = false,
  onBusy,
  onStatus,
  onSaved,
  onCodeRenamed,
  onDeleted
}: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [editing, setEditing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState("");
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteForceAck, setDeleteForceAck] = useState(false);
  const [deleteOpenOfficeItems, setDeleteOpenOfficeItems] = useState(false);
  const [deletePreview, setDeletePreview] = useState<ClientDeletePreview | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [pendingCloseUndo, setPendingCloseUndo] = useState<{ code: string } | null>(null);

  useEffect(() => {
    if (!pendingCloseUndo) return;
    const timer = window.setTimeout(() => setPendingCloseUndo(null), 30_000);
    return () => window.clearTimeout(timer);
  }, [pendingCloseUndo]);

  const [clientName, setClientName] = useState(detail.name);
  const [caseTitle, setCaseTitle] = useState(detail.caseTitle);
  const [matterType, setMatterType] = useState<ClientMatterType>(() => resolveClientMatterType(detail));
  const [caseType, setCaseType] = useState<ClientCaseType | "">(() => normalizeClientCaseType(detail.caseType));
  const [caseTypeOther, setCaseTypeOther] = useState(detail.caseTypeOther || "");
  const [caseNumber, setCaseNumber] = useState(detail.caseNumber || "");
  const [caseRole, setCaseRole] = useState(detail.caseRole || "");
  const [courtPending, setCourtPending] = useState(detail.courtPending || "");
  const [contactEmail, setContactEmail] = useState(detail.email);
  const [contactPhone, setContactPhone] = useState(detail.phone || "");
  const [clientAddress, setClientAddress] = useState(detail.address || "");
  const [prevBalance, setPrevBalance] = useState(String(detail.prevBalance || 0));
  const [preferredGreeting, setPreferredGreeting] = useState(detail.preferredGreeting || "");
  const [clientStatus, setClientStatus] = useState(detail.status || "Active");
  const [assignedAttorney, setAssignedAttorney] = useState(detail.assignedAttorney || "");
  const [coAssignedAttorney, setCoAssignedAttorney] = useState(detail.coAssignedAttorney || "");
  const [retainerBalance, setRetainerBalance] = useState(String(detail.retainerBalance || 0));
  const [birthday, setBirthday] = useState(birthdayToDateInputValue(detail.birthday));
  const [psychologistName, setPsychologistName] = useState(detail.psychologistName || "");
  const [psychologistPhone, setPsychologistPhone] = useState(detail.psychologistPhone || "");
  const [psychologistAddress, setPsychologistAddress] = useState(detail.psychologistAddress || "");
  const [greetingPreviewHtml, setGreetingPreviewHtml] = useState("");
  const [greetingPreviewSubject, setGreetingPreviewSubject] = useState("");
  const [greetingPreviewLoading, setGreetingPreviewLoading] = useState(false);

  useEffect(() => {
    const next = applyDetailToForm(detail);
    setClientName(next.clientName);
    setCaseTitle(next.caseTitle);
    setMatterType(next.matterType);
    setCaseType(next.caseType);
    setCaseTypeOther(next.caseTypeOther);
    setCaseNumber(next.caseNumber);
    setCaseRole(next.caseRole);
    setCourtPending(next.courtPending);
    setContactEmail(next.contactEmail);
    setContactPhone(next.contactPhone);
    setClientAddress(next.clientAddress);
    setPrevBalance(next.prevBalance);
    setPreferredGreeting(next.preferredGreeting);
    setClientStatus(next.clientStatus);
    setAssignedAttorney(next.assignedAttorney);
    setCoAssignedAttorney(next.coAssignedAttorney);
    setRetainerBalance(next.retainerBalance);
    setBirthday(next.birthday);
    setPsychologistName(next.psychologistName);
    setPsychologistPhone(next.psychologistPhone);
    setPsychologistAddress(next.psychologistAddress);
    setGreetingPreviewHtml("");
    setGreetingPreviewSubject("");
    setEditing(false);
  }, [detail]);

  useEffect(() => {
    void fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.isAdmin) setIsAdmin(true);
      })
      .catch(() => {
        /* non-admins: no advanced UI */
      });
  }, []);

  useEffect(() => {
    if (!openOnMount || !isAdmin || !detailsRef.current) return;
    detailsRef.current.open = true;
  }, [openOnMount, isAdmin]);

  const pendingArPayments = useMemo(
    () =>
      ledgerEntries.filter(
        (entry) => entry.type.toLowerCase() === "payment" && entry.payment > 0 && !entry.arSent
      ),
    [ledgerEntries]
  );

  function startEditing() {
    const next = applyDetailToForm(detail);
    setClientName(next.clientName);
    setCaseTitle(next.caseTitle);
    setMatterType(next.matterType);
    setCaseType(next.caseType);
    setCaseTypeOther(next.caseTypeOther);
    setCaseNumber(next.caseNumber);
    setCaseRole(next.caseRole);
    setCourtPending(next.courtPending);
    setContactEmail(next.contactEmail);
    setContactPhone(next.contactPhone);
    setClientAddress(next.clientAddress);
    setPrevBalance(next.prevBalance);
    setPreferredGreeting(next.preferredGreeting);
    setClientStatus(next.clientStatus);
    setAssignedAttorney(next.assignedAttorney);
    setCoAssignedAttorney(next.coAssignedAttorney);
    setRetainerBalance(next.retainerBalance);
    setBirthday(next.birthday);
    setPsychologistName(next.psychologistName);
    setPsychologistPhone(next.psychologistPhone);
    setPsychologistAddress(next.psychologistAddress);
    setEditing(true);
  }

  useEffect(() => {
    if (!autoEdit) return;
    startEditing();
  }, [autoEdit, detail.code]);

  function cancelEditing() {
    const next = applyDetailToForm(detail);
    setClientName(next.clientName);
    setCaseTitle(next.caseTitle);
    setMatterType(next.matterType);
    setCaseType(next.caseType);
    setCaseTypeOther(next.caseTypeOther);
    setCaseNumber(next.caseNumber);
    setCaseRole(next.caseRole);
    setCourtPending(next.courtPending);
    setContactEmail(next.contactEmail);
    setContactPhone(next.contactPhone);
    setClientAddress(next.clientAddress);
    setPrevBalance(next.prevBalance);
    setPreferredGreeting(next.preferredGreeting);
    setClientStatus(next.clientStatus);
    setAssignedAttorney(next.assignedAttorney);
    setCoAssignedAttorney(next.coAssignedAttorney);
    setRetainerBalance(next.retainerBalance);
    setBirthday(next.birthday);
    setPsychologistName(next.psychologistName);
    setPsychologistPhone(next.psychologistPhone);
    setPsychologistAddress(next.psychologistAddress);
    setEditing(false);
  }

  async function loadGreetingPreview() {
    setGreetingPreviewLoading(true);
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(detail.code)}/birthday-greeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview" })
      });
      const { ok, data: result, errorMessage } = await parseApiJson<{
        subject?: string;
        html?: string;
        error?: string;
      }>(response);
      if (!ok) throw new Error(errorMessage || "Could not load greeting preview.");
      setGreetingPreviewSubject(String(result.subject || ""));
      setGreetingPreviewHtml(String(result.html || ""));
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not load greeting preview.", true);
    } finally {
      setGreetingPreviewLoading(false);
    }
  }

  async function sendBirthdayGreeting(force = false) {
    onBusy(true);
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(detail.code)}/birthday-greeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", force })
      });
      const { ok, data: result, errorMessage } = await parseApiJson<{
        message?: string;
        error?: string;
      }>(response);
      if (!ok) throw new Error(errorMessage || "Could not send birthday greeting.");
      onStatus(result.message || "Birthday greeting sent.");
      notifyBirthdaysRefresh();
      onSaved();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not send birthday greeting.", true);
    } finally {
      onBusy(false);
    }
  }

  async function saveChanges() {
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
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(detail.code)}`, {
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
          birthday,
          psychologistName,
          psychologistPhone,
          psychologistAddress
        })
      });
      const { ok, data: result, errorMessage } = await parseApiJson<{
        message?: string;
        error?: string;
      }>(response);
      if (!ok) throw new Error(errorMessage || "Failed to save.");
      onStatus(result.message || "Client updated.");
      setEditing(false);
      onSaved();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to save.", true);
    } finally {
      onBusy(false);
    }
  }

  async function closeClientAccount() {
    onBusy(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(detail.code)}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: closeReason })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to close client.");
      onStatus(json.message || "Client closed.");
      setShowCloseModal(false);
      setCloseReason("");
      setPendingCloseUndo({ code: detail.code });
      onSaved();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to close.", true);
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
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to reopen.", true);
    } finally {
      onBusy(false);
    }
  }

  async function reopenClientAccount() {
    onBusy(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(detail.code)}/reopen`, {
        method: "POST"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to reopen client.");
      onStatus(json.message || "Client reopened.");
      onSaved();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to reopen.", true);
    } finally {
      onBusy(false);
    }
  }

  async function loadDeletePreview() {
    setDeletePreviewLoading(true);
    setDeletePreview(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(detail.code)}/delete-preview`);
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
    if (deleteConfirmCode.trim() !== detail.code) {
      onStatus("Type the exact client code to confirm deletion.", true);
      return;
    }
    if (!deleteAck) {
      onStatus("Check the box to confirm you understand this cannot be undone.", true);
      return;
    }

    const needsForce = (detail.balance ?? 0) > 0.005 || pendingArPayments.length > 0;
    if (needsForce && !deleteForceAck) {
      onStatus("Check the box to confirm delete despite balance or pending AR.", true);
      return;
    }

    onBusy(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(detail.code)}`, {
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
      onDeleted();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to delete client.", true);
    } finally {
      onBusy(false);
    }
  }

  if (!isAdmin) return null;

  return (
    <>
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
      <details ref={detailsRef} id="matter-advanced-settings" className="matter-admin-details no-print scroll-mt-3">
        <summary className="matter-admin-details__summary">Advanced settings — edit client, billing lines, delete</summary>
        <div className="matter-advanced-settings__body space-y-3">
          <section className="card matter-advanced-subsection">
            <h3 className="matter-advanced-subsection__title">Client information</h3>
            <p className="matter-advanced-subsection__help mb-3">
              Change name, contact, case details, or close this client file.
            </p>
            <div className="matter-client-admin__actions mb-4">
              {detail.status.toLowerCase() === "closed" ? (
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => void reopenClientAccount()}>
                  Reopen client file
                </button>
              ) : (
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => setShowCloseModal(true)}>
                  Close client file
                </button>
              )}
              {!editing ? (
                <button type="button" className="btn-primary" disabled={busy} onClick={startEditing}>
                  Change client details
                </button>
              ) : null}
            </div>
            {editing ? (
              <>
                <p className="mb-3 text-xs text-muted">
                  Client code <strong>{detail.code}</strong> — use &quot;Edit client code&quot; below to rename.
                </p>
                <Field label="Client name *">
                  <input className="field" value={clientName} disabled={busy} onChange={(e) => setClientName(e.target.value)} />
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
                      <input className="field" value={caseTitle} disabled={busy} onChange={(e) => setCaseTitle(e.target.value)} />
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
                    <input className="field" value={caseNumber} disabled={busy} onChange={(e) => setCaseNumber(e.target.value)} />
                  </Field>
                ) : null}
                {caseTitleRequiredForMatterType(matterType) ? (
                  <Field label="Court where pending">
                    <input className="field" value={courtPending} disabled={busy} onChange={(e) => setCourtPending(e.target.value)} placeholder="e.g. RTC Branch 45, Quezon City" />
                  </Field>
                ) : null}
                <Field label="Contact email">
                  <input className="field" type="email" value={contactEmail} disabled={busy} onChange={(e) => setContactEmail(e.target.value)} />
                </Field>
                <Field label="Contact phone">
                  <input className="field" value={contactPhone} disabled={busy} onChange={(e) => setContactPhone(e.target.value)} />
                </Field>
                <Field label="Client address">
                  <textarea className="field min-h-[72px]" value={clientAddress} disabled={busy} onChange={(e) => setClientAddress(e.target.value)} />
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
                    <input className="field" type="number" step="0.01" value={prevBalance} disabled={busy} onChange={(e) => setPrevBalance(e.target.value)} />
                  </Field>
                  <Field label="Case status">
                    <select className="field" value={clientStatus} disabled={busy} onChange={(e) => setClientStatus(e.target.value)}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </Field>
                </div>
                <Field label="Preferred greeting">
                  <input className="field" value={preferredGreeting} disabled={busy} onChange={(e) => setPreferredGreeting(e.target.value)} />
                </Field>
                <Field label="Birthday">
                  <input
                    className="field"
                    type="date"
                    value={birthday}
                    disabled={busy}
                    onChange={(e) => setBirthday(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-muted">Used for an annual birthday greeting email on this date.</p>
                </Field>
                <AssignedLawyerFields
                  primaryLawyer={assignedAttorney}
                  secondaryLawyer={coAssignedAttorney}
                  disabled={busy}
                  onPrimaryChange={setAssignedAttorney}
                  onSecondaryChange={setCoAssignedAttorney}
                />
                <Field label="Retainer balance">
                  <input className="field" type="number" step="0.01" value={retainerBalance} disabled={busy} onChange={(e) => setRetainerBalance(e.target.value)} />
                </Field>
                <div className="matter-client-admin__form-actions">
                  <button type="button" disabled={busy} onClick={cancelEditing} className="btn-secondary">Cancel</button>
                  <button type="button" disabled={busy} onClick={() => void saveChanges()} className="btn-primary">Save changes</button>
                </div>
              </>
            ) : (
              <dl className="space-y-2">
                <InfoRow label="Client name" value={detail.name} />
                <InfoRow label="Email" value={detail.email} />
                <InfoRow label="Phone" value={detail.phone} />
                <InfoRow label="Address" value={detail.address} />
                <InfoRow label="File type" value={CLIENT_MATTER_TYPE_LABELS[resolveClientMatterType(detail)]} />
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
                <InfoRow label="Preferred greeting" value={detail.preferredGreeting} />
                <InfoRow
                  label="Birthday"
                  value={formatBirthdayDisplay(detail.birthday) || "—"}
                />
                <InfoRow
                  label="Birthday greeting sent"
                  value={detail.birthdayGreetingSent ? formatDisplayDate(detail.birthdayGreetingSent) : "—"}
                />
                <InfoRow
                  label="Assigned lawyers"
                  value={formatClientAssignedLawyers(detail.assignedAttorney, detail.coAssignedAttorney) || "—"}
                />
                <InfoRow label="Retainer balance" value={formatPeso(detail.retainerBalance)} />
                <InfoRow label="Previous balance" value={formatPeso(detail.prevBalance)} />
                <InfoRow label="Account status" value={detail.accountStatus} />
                {detail.closeReason ? <InfoRow label="Close reason" value={detail.closeReason} /> : null}
                {detail.closedDate ? <InfoRow label="Closed date" value={detail.closedDate} /> : null}
              </dl>
            )}
          </section>

          <section className="card matter-advanced-subsection matter-birthday-greeting border border-[#d4c4a0]/80 bg-[#faf8f4]">
            <h3 className="matter-advanced-subsection__title">Birthday greeting</h3>
            <p className="matter-advanced-subsection__help matter-birthday-greeting__intro">
              On the client&apos;s birthday, the firm sends a warm email on behalf of everyone at Hernandez &amp;
              Associates. Greetings run automatically at 8:00 AM (Manila) when{" "}
              <strong className="text-ink">CRON_GOOGLE_REFRESH_TOKEN</strong> is configured on Vercel.
            </p>
            {detail.birthday ? (
              <p className="matter-birthday-greeting__status text-sm text-muted">
                Birthday on file: <strong className="text-ink">{formatBirthdayDisplay(detail.birthday)}</strong>
                {isBirthdayToday(detail.birthday) ? (
                  <span className="ml-2 font-bold text-gold-dark">— Today</span>
                ) : null}
              </p>
            ) : (
              <p className="matter-birthday-greeting__status text-sm text-muted">
                Add a birthday above to enable automatic greetings.
              </p>
            )}
            <div className="matter-birthday-greeting__actions">
              <button
                type="button"
                className="btn-secondary matter-birthday-greeting__action-btn"
                disabled={busy || greetingPreviewLoading}
                onClick={() => void loadGreetingPreview()}
              >
                {greetingPreviewLoading ? "Loading preview…" : "Preview greeting"}
              </button>
              <button
                type="button"
                className="btn-primary matter-birthday-greeting__action-btn"
                disabled={busy || !detail.email?.trim() || !detail.birthday}
                onClick={() => void sendBirthdayGreeting(false)}
              >
                Send today
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  className="btn-secondary matter-birthday-greeting__action-btn matter-birthday-greeting__action-btn--test"
                  disabled={busy || !detail.email?.trim() || !detail.birthday}
                  onClick={() => void sendBirthdayGreeting(true)}
                >
                  Force send (test)
                </button>
              ) : null}
            </div>
            {greetingPreviewSubject || greetingPreviewHtml ? (
              <div className="matter-birthday-greeting__preview">
                <p className="matter-birthday-greeting__preview-label">Email preview</p>
                {greetingPreviewSubject ? (
                  <p className="matter-birthday-greeting__preview-subject">
                    <span>Subject</span> {greetingPreviewSubject}
                  </p>
                ) : null}
                {greetingPreviewHtml ? (
                  <div className="matter-birthday-greeting__preview-frame">
                    <iframe
                      title="Birthday greeting preview"
                      className="matter-birthday-greeting__preview-iframe"
                      srcDoc={greetingPreviewHtml}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <MatterLedgerHistory
            clientCode={detail.code}
            entries={ledgerEntries}
            busy={busy}
            embedded
            onBusy={onBusy}
            onStatus={onStatus}
            onSaved={onSaved}
          />

          <section className="card matter-advanced-subsection border border-[#d4c4a0]/80 bg-[#faf8f4]">
            <h3 className="matter-advanced-subsection__title">Edit client code</h3>
            <p className="matter-advanced-subsection__help mb-2">
              Current code: <strong className="text-ink">{detail.code}</strong>
            </p>
            <ClientCodeRenameForm currentCode={detail.code} busy={busy} onBusy={onBusy} onStatus={onStatus} onRenamed={onCodeRenamed} compact />
          </section>

          <section className="card matter-advanced-subsection border-2 border-red-200/80 bg-red-50/40">
            <h3 className="matter-advanced-subsection__title text-red-900">Permanently delete client</h3>
            <p className="matter-advanced-subsection__help mb-3 text-red-900/90">
              Removes this client from the Master List and deletes the ledger tab.
            </p>
            <button
              type="button"
              className="matter-client-admin__danger-btn"
              disabled={busy}
              onClick={() => {
                setDeleteConfirmCode("");
                setDeleteAck(false);
                setDeleteForceAck(false);
                setDeleteOpenOfficeItems(false);
                setDeletePreview(null);
                setShowDeleteModal(true);
                void loadDeletePreview();
              }}
            >
              Permanently delete client…
            </button>
            {detail.balance > 0.005 || pendingArPayments.length > 0 ? (
              <p className="mt-2 text-[11px] font-bold text-red-800">
                {detail.balance > 0.005
                  ? `Balance is ${formatPeso(detail.balance)} — extra confirmation required.`
                  : "Pending AR on file — extra confirmation required."}
              </p>
            ) : null}
          </section>
        </div>
      </details>

      {showCloseModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card client-profile-modal max-w-md w-full">
            <p className="section-label">Close client account</p>
            <p className="client-profile-modal__desc">
              This marks the client as closed in the Master List. You can undo for 30 seconds after closing, or reopen later.
            </p>
            <textarea
              className="field client-profile-modal__textarea"
              value={closeReason}
              disabled={busy}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="Reason for closing (optional)"
            />
            <div className="client-profile-modal__actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => setShowCloseModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void closeClientAccount()}
              >
                Confirm close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-h-[90vh] max-w-lg w-full overflow-y-auto border-2 border-red-300">
            <p className="section-label text-red-900">Permanently delete client</p>
            <p className="mb-3 text-xs text-muted">
              This removes <strong>{detail.code}</strong> — {detail.name}. This cannot be undone.
            </p>

            <section className="mb-4 rounded-lg border border-red-200/80 bg-red-50/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-red-900">
                Review before deleting
              </p>
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
                          <li
                            key={`${item.source}-${item.id}`}
                            className="border-b border-[#ece7df] pb-2 last:border-0 last:pb-0"
                          >
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
                  {pendingArPayments.length > 0 ? ` · Pending AR: ${pendingArPayments.length}` : ""}
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
            <div className="matter-client-admin__form-actions">
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
                className="rounded-lg bg-red-800 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-red-900 disabled:opacity-50"
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
      ) : null}
    </>
  );
}
