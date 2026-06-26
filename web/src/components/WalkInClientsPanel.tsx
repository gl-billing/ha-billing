"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusOnMount } from "@/hooks/useFocusOnMount";
import { FormStatusReport } from "@/components/FormStatusReport";
import { ClientCodeWarningPanel } from "@/components/ClientCodeWarningPanel";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { TableSkeleton } from "@/components/Skeleton";
import { useClientCodeCheck } from "@/hooks/useClientCodeCheck";
import type { WalkInBillingKind, WalkInClient } from "@/lib/gl-config";
import { formatClientCaseLabel, formatPeso, GL } from "@/lib/gl-config";
import type { FormSaveStatus } from "@/lib/firm-status-report";
import type { EngagementDocumentType, EngagementLetterInput } from "@/lib/engagement-letter";
import {
  defaultFeeTypeForDocument,
  feeTypeOptionsForDocument,
  INTAKE_CONFERENCE_TASK,
  previewIntakeTasks
} from "@/lib/intake-checklist-config";
import { clientCodeCheckBlocksCreate, clientCodeCheckCanProceed, conflictReviewBlocksProceed } from "@/lib/sheets/client-code-check";
import { clearFormDraft, readFormDraft, saveFormDraft } from "@/lib/form-draft-storage";

const WALK_IN_DRAFT_KEY = "walk-in-new";

type Props = {
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onStatus: (message: string, isError?: boolean) => void;
  onPromoted?: (clientCode: string, walkInId?: string) => void;
  onOpenBilling?: (clientCode: string) => void;
};

type Filter = "active" | "promoted" | "all";

const WALK_IN_SERVICE_TYPES = [
  "Professional Fee",
  "Acceptance Fee",
  "Notarial Fee",
  "Filing Fee",
  "Other"
] as const;

function todayLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function billingSummary(entry: WalkInClient): string {
  if (entry.billingStatus === "Retainer") return "Retainer · no charge";
  if (!entry.chargeAmount) return "Not billed";
  const parts = [formatPeso(entry.chargeAmount)];
  if (entry.billingStatus) parts.push(entry.billingStatus);
  if (entry.paymentAmount > 0) parts.push(`paid ${formatPeso(entry.paymentAmount)}`);
  return parts.join(" · ");
}

function hasWalkInBilling(entry: WalkInClient): boolean {
  return entry.billingStatus === "Retainer" || entry.chargeAmount > 0;
}

export function WalkInClientsPanel({ busy, onBusy, onStatus, onPromoted, onOpenBilling }: Props) {
  const [walkIns, setWalkIns] = useState<WalkInClient[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promoteEntry, setPromoteEntry] = useState<WalkInClient | null>(null);
  const [billEntry, setBillEntry] = useState<WalkInClient | null>(null);
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [promoteAttorney, setPromoteAttorney] = useState("");
  const [promoteChecklist, setPromoteChecklist] = useState({
    engagementLetter: true,
    scheduleInitialConference: true as boolean | null,
    documentType: "engagement" as EngagementDocumentType,
    feeType: "retainer" as EngagementLetterInput["feeType"]
  });
  const [promoteTransferBilling, setPromoteTransferBilling] = useState(true);
  const [promoteSuccess, setPromoteSuccess] = useState<{
    clientCode: string;
    clientName: string;
    walkInId: string;
  } | null>(null);

  const [newName, setNewName] = useState("");
  const [newMatter, setNewMatter] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newBillNow, setNewBillNow] = useState(true);
  const [newBillingKind, setNewBillingKind] = useState<WalkInBillingKind>("charge");
  const [newServiceType, setNewServiceType] = useState<string>(WALK_IN_SERVICE_TYPES[0]);
  const [newCharge, setNewCharge] = useState("");
  const [newPaid, setNewPaid] = useState("");
  const [newMethod, setNewMethod] = useState<string>(GL.paymentMethods[0]);

  const [billServiceType, setBillServiceType] = useState<string>(WALK_IN_SERVICE_TYPES[0]);
  const [billBillingKind, setBillBillingKind] = useState<WalkInBillingKind>("charge");
  const [billCharge, setBillCharge] = useState("");
  const [billPaid, setBillPaid] = useState("");
  const [billMethod, setBillMethod] = useState<string>(GL.paymentMethods[0]);
  const [billDate, setBillDate] = useState(todayLocal());
  const [billDescription, setBillDescription] = useState("");
  const [billPaidNow, setBillPaidNow] = useState(true);
  const [panelStatus, setPanelStatus] = useState<FormSaveStatus | null>(null);
  const promoteCardRef = useRef<HTMLElement>(null);
  const billCardRef = useRef<HTMLElement>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  useFocusOnMount(newNameRef);

  useEffect(() => {
    const draft = readFormDraft<{
      newName: string;
      newMatter: string;
      newPhone: string;
      newEmail: string;
      newNotes: string;
    }>(WALK_IN_DRAFT_KEY);
    if (!draft) return;
    setNewName(draft.newName || "");
    setNewMatter(draft.newMatter || "");
    setNewPhone(draft.newPhone || "");
    setNewEmail(draft.newEmail || "");
    setNewNotes(draft.newNotes || "");
  }, []);

  useEffect(() => {
    if (!newName && !newMatter && !newPhone && !newEmail && !newNotes) return;
    saveFormDraft(WALK_IN_DRAFT_KEY, {
      newName,
      newMatter,
      newPhone,
      newEmail,
      newNotes
    });
  }, [newName, newMatter, newPhone, newEmail, newNotes]);

  const {
    check: promoteCodeCheck,
    checking: promoteCodeChecking,
    runCheck: runPromoteCodeCheck,
    conflictReviewChoice: promoteConflictReviewChoice,
    setConflictReviewChoice: setPromoteConflictReviewChoice,
    codeBlocked: promoteCodeBlocked
  } = useClientCodeCheck({
    clientCode,
    clientName,
    caseTitle
  });

  useEffect(() => {
    if (!promoteEntry) return;
    void runPromoteCodeCheck();
  }, [promoteEntry, clientCode, clientName, caseTitle, runPromoteCodeCheck]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/walk-ins${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load walk-in clients.");
      setWalkIns(json.walkIns || []);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not load walk-in clients.", true);
    } finally {
      setLoading(false);
    }
  }, [filter, onStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!promoteEntry) return;
    const timer = window.setTimeout(() => {
      promoteCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [promoteEntry]);

  useEffect(() => {
    if (!billEntry) return;
    const timer = window.setTimeout(() => {
      billCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [billEntry]);

  function openPromote(entry: WalkInClient) {
    setPanelStatus(null);
    setPromoteEntry(entry);
    setBillEntry(null);
    setClientCode("");
    setClientName(entry.name);
    setCaseTitle(entry.matter);
    setPromoteAttorney("");
    setPromoteChecklist({
      engagementLetter: true,
      scheduleInitialConference: true,
      documentType: "engagement",
      feeType: "retainer"
    });
    setPromoteTransferBilling(hasWalkInBilling(entry) && entry.billingStatus !== "Retainer");
  }

  function openBill(entry: WalkInClient) {
    setPanelStatus(null);
    setBillEntry(entry);
    setPromoteEntry(null);
    setBillServiceType(entry.serviceType || WALK_IN_SERVICE_TYPES[0]);
    setBillBillingKind(entry.billingStatus === "Retainer" ? "retainer" : "charge");
    setBillCharge(entry.chargeAmount ? String(entry.chargeAmount) : "");
    setBillPaid(entry.paymentAmount ? String(entry.paymentAmount) : "");
    setBillMethod(entry.paymentMethod || GL.paymentMethods[0]);
    setBillDate(entry.billingDate || todayLocal());
    setBillDescription("");
    setBillPaidNow(entry.billingStatus !== "Retainer" && (!entry.chargeAmount || entry.billingStatus !== "Unpaid"));
  }

  async function submitWalkIn(addAnother = false) {
    if (!newName.trim() || !newMatter.trim()) {
      onStatus("Name and consultation topic are required.", true);
      return;
    }

    const charge = Number(newCharge);
    const payment = Number(newPaid);
    let billing;
    if (newBillNow) {
      if (newBillingKind === "retainer") {
        billing = {
          serviceType: newServiceType,
          billingKind: "retainer" as const,
          charge: 0,
          date: todayLocal()
        };
      } else if (charge > 0) {
        billing = {
          serviceType: newServiceType,
          billingKind: "charge" as const,
          charge,
          payment: payment > 0 ? payment : charge,
          method: newMethod,
          date: todayLocal()
        };
      } else {
        onStatus("Enter a valid charge amount, or choose Retainer (no charge).", true);
        return;
      }
    }

    onBusy(true);
    setSaving(true);
    setPanelStatus({ phase: "processing", message: "Saving walk-in…" });
    try {
      const res = await fetch("/api/tasks/walk-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          matter: newMatter.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim(),
          notes: newNotes.trim(),
          billing
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save walk-in.");
      if (addAnother) {
        setNewName("");
        setNewMatter("");
        setNewPhone("");
        setNewEmail("");
        setNewNotes("");
        clearFormDraft(WALK_IN_DRAFT_KEY);
        setPanelStatus({ phase: "success", message: `${json.message || "Walk-in saved."} Add another below.` });
        window.requestAnimationFrame(() => newNameRef.current?.focus());
      } else {
        setNewName("");
        setNewMatter("");
        setNewPhone("");
        setNewEmail("");
        setNewNotes("");
        setNewCharge("");
        setNewPaid("");
        setNewBillNow(true);
        setNewBillingKind("charge");
        clearFormDraft(WALK_IN_DRAFT_KEY);
        setPanelStatus({ phase: "success", message: json.message || "Walk-in saved." });
      }
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save walk-in.";
      setPanelStatus({ phase: "error", message });
      onStatus(message, true);
    } finally {
      onBusy(false);
      setSaving(false);
    }
  }

  async function submitBilling() {
    if (!billEntry) return;
    const isRetainer = billBillingKind === "retainer";
    const charge = Number(billCharge);
    if (!isRetainer && (!charge || charge <= 0)) {
      onStatus("Enter a valid charge amount, or choose Retainer (no charge).", true);
      return;
    }
    const payment = isRetainer ? 0 : billPaidNow ? Number(billPaid || billCharge) : Number(billPaid || 0);

    onBusy(true);
    setSaving(true);
    setPanelStatus({ phase: "processing", message: "Recording billing…" });
    try {
      const res = await fetch(`/api/walk-ins/${encodeURIComponent(billEntry.walkInId)}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: billServiceType,
          billingKind: billBillingKind,
          charge: isRetainer ? 0 : charge,
          payment: payment > 0 ? payment : undefined,
          method: payment > 0 ? billMethod : undefined,
          date: billDate,
          description: billDescription.trim()
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not record billing.");
      setPanelStatus({ phase: "success", message: json.message || "Billing saved." });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not record billing.";
      setPanelStatus({ phase: "error", message });
      onStatus(message, true);
    } finally {
      onBusy(false);
      setSaving(false);
    }
  }

  async function submitPromote() {
    if (!promoteEntry || !clientCode.trim() || !clientName.trim() || !caseTitle.trim()) {
      const message = "Client code, name, and case title are required to promote.";
      setPanelStatus({ phase: "error", message });
      return;
    }
    if (promoteChecklist.scheduleInitialConference === null) {
      const message = "Choose whether to schedule an initial client conference.";
      setPanelStatus({ phase: "error", message });
      return;
    }
    if (promoteCodeChecking) {
      setPanelStatus({ phase: "error", message: "Conflict check still running — wait a moment." });
      return;
    }
    const result = promoteCodeCheck ?? (await runPromoteCodeCheck());
    if (!clientCodeCheckCanProceed(result, promoteConflictReviewChoice)) {
      const message = clientCodeCheckBlocksCreate(result)
        ? "Change the client code — that profile already exists and cannot be overridden."
        : conflictReviewBlocksProceed(promoteConflictReviewChoice) ||
          "Review the possible conflict before promoting this walk-in.";
      setPanelStatus({ phase: "error", message });
      onStatus(message, true);
      return;
    }
    onBusy(true);
    setSaving(true);
    setPanelStatus({
      phase: "processing",
      message: "Creating client file, starter tasks, and opening matter…"
    });
    try {
      const res = await fetch(`/api/walk-ins/${encodeURIComponent(promoteEntry.walkInId)}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCode: clientCode.trim(),
          clientName: clientName.trim(),
          caseTitle: caseTitle.trim(),
          contactEmail: promoteEntry.email,
          contactPhone: promoteEntry.phone,
          assignedAttorney: promoteAttorney.trim() || undefined,
          checklist: {
            engagementLetter: promoteChecklist.engagementLetter,
            scheduleInitialConference: promoteChecklist.scheduleInitialConference === true,
            documentType: promoteChecklist.documentType,
            feeType: promoteChecklist.feeType
          },
          conflictReviewChoice: promoteConflictReviewChoice || undefined,
          transferBilling: promoteTransferBilling
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not promote walk-in.");
      const walkInId = promoteEntry.walkInId;
      const promotedName = clientName.trim();
      const promotedCode = json.clientCode as string;
      setPromoteEntry(null);
      setPanelStatus(null);
      setPromoteSuccess({ clientCode: promotedCode, clientName: promotedName, walkInId });
      onStatus(json.message || "Walk-in promoted to client file.", false);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not promote walk-in.";
      setPanelStatus({ phase: "error", message });
      onStatus(message, true);
    } finally {
      onBusy(false);
      setSaving(false);
    }
  }

  async function closeWalkIn(walkInId: string) {
    if (!window.confirm(`Close walk-in ${walkInId}? It will no longer appear in task case lists.`)) return;
    onBusy(true);
    setPanelStatus({ phase: "processing", message: "Closing walk-in…" });
    try {
      const res = await fetch(`/api/walk-ins/${encodeURIComponent(walkInId)}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not close walk-in.");
      setPanelStatus({ phase: "success", message: json.message || "Walk-in closed." });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not close walk-in.";
      setPanelStatus({ phase: "error", message });
      onStatus(message, true);
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="walk-in-panel">
      <section className="card walk-in-panel__add-form">
        <div className="walk-in-panel__card-head">
          <p className="walk-in-panel__step">01 · Log walk-in</p>
          <h2 className="walk-in-panel__card-title">Add walk-in consultation</h2>
          <p className="walk-in-panel__card-lede">Record the visit first — contact details, then optional payment at the desk.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Name *">
            <input ref={newNameRef} className="field" value={newName} disabled={saving} onChange={(e) => setNewName(e.target.value)} />
          </Field>
          <Field label="Consultation topic *">
            <input className="field" value={newMatter} disabled={saving} placeholder="Reason for visit" onChange={(e) => setNewMatter(e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className="field" value={newPhone} disabled={saving} onChange={(e) => setNewPhone(e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="field" type="email" value={newEmail} disabled={saving} onChange={(e) => setNewEmail(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="field min-h-[72px]" value={newNotes} disabled={saving} onChange={(e) => setNewNotes(e.target.value)} />
        </Field>

        <div className="walk-in-panel__billing-inline">
          <label className="walk-in-panel__billing-toggle flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={newBillNow} disabled={saving} onChange={(e) => setNewBillNow(e.target.checked)} />
            Collect payment now (consultation / one-time service)
          </label>
          {newBillNow ? (
            <>
              <BillingKindToggle
                value={newBillingKind}
                disabled={saving}
                onChange={setNewBillingKind}
                className="mt-2"
              />
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Field label="Service type">
                  <select className="field" value={newServiceType} disabled={saving} onChange={(e) => setNewServiceType(e.target.value)}>
                    {WALK_IN_SERVICE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                {newBillingKind === "charge" ? (
                  <>
                    <Field label="Charge *">
                      <input className="field" type="number" min="0" step="0.01" value={newCharge} disabled={saving} placeholder="0.00" onChange={(e) => {
                        setNewCharge(e.target.value);
                        if (!newPaid) setNewPaid(e.target.value);
                      }} />
                    </Field>
                    <Field label="Amount received">
                      <input className="field" type="number" min="0" step="0.01" value={newPaid} disabled={saving} placeholder="Same as charge" onChange={(e) => setNewPaid(e.target.value)} />
                    </Field>
                    <div className="walk-in-panel__payment-field sm:col-span-3">
                      <Field label="Payment method">
                        <select className="field" value={newMethod} disabled={saving} onChange={(e) => setNewMethod(e.target.value)}>
                          {GL.paymentMethods.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </>
                ) : (
                  <p className="sm:col-span-2 self-end text-sm text-muted">Retainer visit — no charge or payment.</p>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="btn-row walk-in-panel__add-actions form-save-bar--sticky-mobile">
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void submitWalkIn(false)}>
            {busy ? "Saving…" : "Add walk-in"}
          </button>
          <button type="button" className="btn-secondary" disabled={saving} onClick={() => void submitWalkIn(true)}>
            Save &amp; add another
          </button>
        </div>
      </section>

      {!promoteEntry && !billEntry && panelStatus ? (
        <FormStatusReport status={panelStatus} className="walk-in-panel__status-report" />
      ) : null}

      <section className="card walk-in-panel__register">
        <div className="walk-in-panel__card-head walk-in-panel__card-head--compact">
          <p className="walk-in-panel__step">02 · Walk-in register</p>
          <h2 className="walk-in-panel__card-title">Active visits &amp; history</h2>
          <p className="walk-in-panel__card-lede">Filter the list, then bill, promote, or close from the row actions.</p>
        </div>
        <div className="walk-in-panel__filters" role="tablist" aria-label="Filter walk-in clients">
          {(
            [
              ["active", "Active"],
              ["promoted", "Promoted"],
              ["all", "All"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`walk-in-panel__filter-btn ${filter === id ? "walk-in-panel__filter-btn--active" : ""}`}
              disabled={saving}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : walkIns.length === 0 ? (
          <EmptyState
            title="No walk-ins here"
            message="All caught up — no walk-in clients in this view. Log a new visit when someone walks in."
            action={
              <button type="button" className="btn-primary" disabled={saving} onClick={() => newNameRef.current?.focus()}>
                Log walk-in
              </button>
            }
          />
        ) : (
          <div className="walk-in-panel__table-wrap firm-ledger-table-wrap">
            <table className="walk-in-panel__table firm-ledger-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Consultation</th>
                  <th>Billing</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {walkIns.map((entry) => (
                  <tr key={entry.walkInId}>
                    <td data-label="ID">{entry.walkInId}</td>
                    <td data-label="Date">{entry.dateAdded || "—"}</td>
                    <td data-label="Name">{entry.name}</td>
                    <td data-label="Consultation">{entry.matter}</td>
                    <td data-label="Billing">
                      <span className={`walk-in-panel__billing walk-in-panel__billing--${(entry.billingStatus || "none").toLowerCase()}`}>
                        {billingSummary(entry)}
                      </span>
                    </td>
                    <td data-label="Status">
                      <span className={`walk-in-panel__status walk-in-panel__status--${entry.status.toLowerCase()}`}>
                        {entry.status}
                        {entry.promotedClientCode ? ` → ${entry.promotedClientCode}` : ""}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="walk-in-panel__actions">
                        {entry.status === "Active" ? (
                          <>
                            <button type="button" className="btn-primary btn-sm" disabled={busy || saving} onClick={() => openBill(entry)}>
                              {hasWalkInBilling(entry) ? "Update" : "Bill"}
                            </button>
                            <button type="button" className="btn-secondary btn-sm" disabled={busy || saving} onClick={() => openPromote(entry)}>
                              Promote
                            </button>
                            <button type="button" className="btn-ghost btn-sm" disabled={busy || saving} onClick={() => void closeWalkIn(entry.walkInId)}>
                              Close
                            </button>
                          </>
                        ) : entry.status === "Promoted" && entry.promotedClientCode ? (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            disabled={busy || saving}
                            onClick={() => onOpenBilling?.(entry.promotedClientCode)}
                          >
                            Billing
                          </button>
                        ) : (
                          "—"
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {promoteSuccess ? (
        <section className="card walk-in-promote-success" role="status">
          <div className="walk-in-promote-success__icon" aria-hidden>
            ✓
          </div>
          <div className="walk-in-promote-success__body">
            <p className="walk-in-promote-success__eyebrow">Walk-in promoted</p>
            <h2 className="walk-in-promote-success__title">
              {promoteSuccess.clientName} is now on the Master List
            </h2>
            <p className="walk-in-promote-success__text">
              Matter code <strong>{promoteSuccess.clientCode}</strong> — billing file created, walk-in history
              transferred, and starter tasks added.
            </p>
            <div className="walk-in-promote-success__actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const { clientCode: code, walkInId } = promoteSuccess;
                  setPromoteSuccess(null);
                  onPromoted?.(code, walkInId);
                }}
              >
                Open matter file →
              </button>
              <button type="button" className="btn-secondary" onClick={() => setPromoteSuccess(null)}>
                Stay on walk-ins
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {billEntry ? (
        <section
          ref={billCardRef}
          id="walk-in-bill-card"
          className="card walk-in-panel__subcard walk-in-panel__billing-form scroll-mt-4"
        >
          <FormStatusReport status={panelStatus} className="walk-in-panel__status-report" />
          <div className="walk-in-panel__card-head walk-in-panel__card-head--compact">
            <p className="walk-in-panel__step">03 · Bill walk-in</p>
            <h2 className="walk-in-panel__card-title">{billEntry.walkInId}</h2>
            <p className="walk-in-panel__card-lede">
              {billEntry.name} · {billEntry.matter}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Service type *">
              <select className="field" value={billServiceType} disabled={saving} onChange={(e) => setBillServiceType(e.target.value)}>
                {WALK_IN_SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Billing date *">
              <input className="field" type="date" value={billDate} disabled={saving} onChange={(e) => setBillDate(e.target.value)} />
            </Field>
            <Field label="Description">
              <input
                className="field sm:col-span-2"
                value={billDescription}
                disabled={saving}
                placeholder="e.g. Initial consultation, demand letter fee"
                onChange={(e) => setBillDescription(e.target.value)}
              />
            </Field>
          </div>
          <BillingKindToggle
            value={billBillingKind}
            disabled={saving}
            onChange={(kind) => {
              setBillBillingKind(kind);
              if (kind === "retainer") setBillPaidNow(false);
            }}
          />
          {billBillingKind === "charge" ? (
            <>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Charge amount *">
                  <input
                    className="field"
                    type="number"
                    min="0"
                    step="0.01"
                    value={billCharge}
                    disabled={saving}
                    placeholder="0.00"
                    onChange={(e) => {
                      setBillCharge(e.target.value);
                      if (billPaidNow && !billPaid) setBillPaid(e.target.value);
                    }}
                  />
                </Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={billPaidNow} disabled={saving} onChange={(e) => {
                  setBillPaidNow(e.target.checked);
                  if (e.target.checked && billCharge && !billPaid) setBillPaid(billCharge);
                }} />
                Paid now (before / after consult)
              </label>
              {billPaidNow ? (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="Amount received">
                    <input className="field" type="number" min="0" step="0.01" value={billPaid} disabled={saving} onChange={(e) => setBillPaid(e.target.value)} />
                  </Field>
                  <Field label="Payment method">
                    <select className="field" value={billMethod} disabled={saving} onChange={(e) => setBillMethod(e.target.value)}>
                      {GL.paymentMethods.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Retainer visit — no charge or payment will be recorded.</p>
          )}
          <div className="btn-row form-save-bar--sticky-mobile">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void submitBilling()}>
              {busy ? "Saving…" : "Save billing"}
            </button>
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => setBillEntry(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {promoteEntry ? (
        <section
          ref={promoteCardRef}
          id="walk-in-promote-card"
          className="card walk-in-panel__subcard walk-in-panel__promote scroll-mt-4"
        >
          <FormStatusReport status={panelStatus} className="walk-in-panel__status-report" />
          <div className="walk-in-panel__card-head walk-in-panel__card-head--compact">
            <p className="walk-in-panel__step">04 · Promote to matter</p>
            <h2 className="walk-in-panel__card-title">{promoteEntry.walkInId}</h2>
            <p className="walk-in-panel__card-lede">
              Creates a billing file, optional starter tasks, and opens the matter page. Task labels using{" "}
              <strong>{formatClientCaseLabel(clientName, caseTitle)}</strong> stay linked by name.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Client code *">
              <input
                className="field"
                value={clientCode}
                disabled={saving}
                placeholder="e.g. CRUZ2026"
                onChange={(e) => setClientCode(e.target.value.toUpperCase())}
                onBlur={() => void runPromoteCodeCheck()}
              />
            </Field>
            <Field label="Client name *">
              <input
                className="field"
                value={clientName}
                disabled={saving}
                onChange={(e) => setClientName(e.target.value)}
                onBlur={() => void runPromoteCodeCheck()}
              />
            </Field>
            <Field label="Case title *">
              <input
                className="field"
                value={caseTitle}
                disabled={saving}
                onChange={(e) => setCaseTitle(e.target.value)}
                onBlur={() => void runPromoteCodeCheck()}
              />
            </Field>
            <Field label="Assigned attorney">
              <input
                className="field sm:col-span-2"
                value={promoteAttorney}
                disabled={saving}
                placeholder="e.g. Atty. Janine"
                onChange={(e) => setPromoteAttorney(e.target.value)}
              />
            </Field>
          </div>
          <ClientCodeWarningPanel
            check={promoteCodeCheck}
            checking={promoteCodeChecking}
            clientCode={clientCode}
            context="intake"
            conflictReviewChoice={promoteConflictReviewChoice}
            onConflictReviewChoiceChange={setPromoteConflictReviewChoice}
            onUseExistingCode={(code) => {
              setClientCode(code);
              setPromoteConflictReviewChoice("same_case");
              void runPromoteCodeCheck();
            }}
          />
          {(promoteEntry.phone || promoteEntry.email) && (
            <p className="mt-2 text-xs text-muted">
              Contact on file: {[promoteEntry.phone, promoteEntry.email].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="walk-in-panel__billing-inline mt-4">
            <p className="text-xs font-bold text-ink">Starter tasks (Office Tasks)</p>
            <p className="mt-1 text-[11px] text-muted">
              Conflict review is completed above before the client file is created. Same checklist as new matter
              intake — due in 7 days.
            </p>

            <label className="mt-2 flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={promoteChecklist.engagementLetter}
                disabled={saving}
                onChange={(e) => setPromoteChecklist((prev) => ({ ...prev, engagementLetter: e.target.checked }))}
              />
              <span>
                <strong className="text-ink">Prepare engagement document</strong>
                <span className="block text-[11px] text-muted">Task follows document type and fee structure below</span>
              </span>
            </label>

            {promoteChecklist.engagementLetter ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field label="Document type">
                  <select
                    className="field"
                    value={promoteChecklist.documentType}
                    disabled={saving}
                    onChange={(e) => {
                      const documentType = e.target.value as EngagementDocumentType;
                      setPromoteChecklist((prev) => ({
                        ...prev,
                        documentType,
                        feeType: defaultFeeTypeForDocument(documentType)
                      }));
                    }}
                  >
                    <option value="engagement">Retainership agreement</option>
                    <option value="contract">Contract of legal services</option>
                  </select>
                </Field>
                <Field label="Fee type">
                  <select
                    className="field"
                    value={promoteChecklist.feeType}
                    disabled={saving}
                    onChange={(e) =>
                      setPromoteChecklist((prev) => ({
                        ...prev,
                        feeType: e.target.value as EngagementLetterInput["feeType"]
                      }))
                    }
                  >
                    {feeTypeOptionsForDocument(promoteChecklist.documentType).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="sm:col-span-2 text-[11px] text-muted">
                  Office task:{" "}
                  <strong className="text-ink">
                    {previewIntakeTasks({
                      engagementLetter: true,
                      documentType: promoteChecklist.documentType,
                      feeType: promoteChecklist.feeType
                    })[0] || "—"}
                  </strong>
                </p>
              </div>
            ) : null}

            <div className="mt-3 rounded-md border border-line/70 bg-white/50 p-3">
              <p className="text-xs font-bold text-ink">Schedule initial client conference?</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="promoteScheduleInitialConference"
                    checked={promoteChecklist.scheduleInitialConference === true}
                    disabled={saving}
                    onChange={() => setPromoteChecklist((prev) => ({ ...prev, scheduleInitialConference: true }))}
                  />
                  Yes — create task
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="promoteScheduleInitialConference"
                    checked={promoteChecklist.scheduleInitialConference === false}
                    disabled={saving}
                    onChange={() => setPromoteChecklist((prev) => ({ ...prev, scheduleInitialConference: false }))}
                  />
                  No — not needed
                </label>
              </div>
              {promoteChecklist.scheduleInitialConference === true ? (
                <p className="mt-2 text-[11px] text-muted">Creates task: {INTAKE_CONFERENCE_TASK}</p>
              ) : null}
            </div>
          </div>
          {hasWalkInBilling(promoteEntry) && promoteEntry.billingStatus !== "Retainer" ? (
            <label className="mt-4 flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={promoteTransferBilling}
                disabled={saving}
                onChange={(e) => setPromoteTransferBilling(e.target.checked)}
              />
              <span>
                <strong className="text-ink">Copy walk-in billing to client ledger</strong>
                <span className="block text-[11px] text-muted">{billingSummary(promoteEntry)}</span>
              </span>
            </label>
          ) : null}
          <div className="btn-row form-save-bar--sticky-mobile">
            <button type="button" className="btn-primary" disabled={saving || promoteCodeChecking || promoteCodeBlocked} onClick={() => void submitPromote()}>
              {saving ? "Promoting…" : "Promote & open matter"}
            </button>
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => setPromoteEntry(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BillingKindToggle({
  value,
  onChange,
  disabled,
  className = ""
}: {
  value: WalkInBillingKind;
  onChange: (kind: WalkInBillingKind) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`walk-in-panel__billing-kind ${className}`.trim()}>
      <span className="field-label">Payment</span>
      <div className="walk-in-panel__billing-kind-options" role="group" aria-label="Payment type">
        <button
          type="button"
          className={`walk-in-panel__billing-kind-btn ${value === "charge" ? "walk-in-panel__billing-kind-btn--active" : ""}`}
          disabled={disabled}
          onClick={() => onChange("charge")}
        >
          Enter amount
        </button>
        <button
          type="button"
          className={`walk-in-panel__billing-kind-btn ${value === "retainer" ? "walk-in-panel__billing-kind-btn--active" : ""}`}
          disabled={disabled}
          onClick={() => onChange("retainer")}
        >
          Retainer (no charge)
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
