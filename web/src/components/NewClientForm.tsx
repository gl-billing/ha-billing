"use client";

import { useState } from "react";
import type { NewClientPayload } from "@/lib/gl-config";
import { ClientCaseRoleSelect } from "@/components/ClientCaseRoleSelect";
import { ClientCodeWarningPanel } from "@/components/ClientCodeWarningPanel";
import { FormStatusReport } from "@/components/FormStatusReport";
import { useClientCodeCheck } from "@/hooks/useClientCodeCheck";
import { conflictReviewBlocksProceed } from "@/lib/sheets/client-code-check";
import type { FormSaveStatus } from "@/lib/firm-status-report";

type Props = {
  busy: boolean;
  onSubmit: (payload: NewClientPayload) => Promise<void>;
  onStatus?: (message: string, isError?: boolean, isProcessing?: boolean) => void;
};

export function NewClientForm({ busy, onSubmit, onStatus }: Props) {
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [caseRole, setCaseRole] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [courtPending, setCourtPending] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [prevBalance, setPrevBalance] = useState("");
  const [preferredGreeting, setPreferredGreeting] = useState("");
  const [saveStatus, setSaveStatus] = useState<FormSaveStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { check, runCheck, conflictReviewChoice, setConflictReviewChoice, codeBlocked, canProceed } =
    useClientCodeCheck({
    clientCode,
    clientName,
    caseTitle,
    caseNumber,
    courtPending
  });

  async function handleSubmit() {
    if (!canProceed) {
      if (codeBlocked) {
        onStatus?.("Change the client code — that profile already exists and cannot be overridden.", true);
      } else {
        onStatus?.(
          conflictReviewBlocksProceed(conflictReviewChoice) ||
            "Review the possible conflict and choose whether this is the same case or a different case.",
          true
        );
      }
      return;
    }

    setSaveStatus({ phase: "processing", message: `Creating client ${clientCode} and ledger tab…` });
    onStatus?.(`Creating client ${clientCode} and ledger tab…`, false, true);
    setSubmitting(true);

    try {
    await onSubmit({
      clientCode,
      clientName,
      caseTitle,
      caseRole,
      caseNumber,
      courtPending,
      contactEmail,
      contactPhone,
      clientAddress,
      prevBalance,
      preferredGreeting,
      clientStatus: "Active"
    });

    setClientCode("");
    setClientName("");
    setCaseTitle("");
    setCaseRole("");
    setCaseNumber("");
    setCourtPending("");
    setContactEmail("");
    setContactPhone("");
    setClientAddress("");
    setPrevBalance("");
    setPreferredGreeting("");
    setSaveStatus(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create client.";
      setSaveStatus({ phase: "error", message });
      onStatus?.(message, true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <p className="mb-3 text-xs text-muted">
        Adds a row to Master List and creates a client ledger tab from your Template sheet.
      </p>

      <Field label="Client code *" hint="Short ID, no special characters. Becomes the tab name.">
        <input
          className="field"
          value={clientCode}
          disabled={submitting}
          onChange={(e) => setClientCode(e.target.value.toUpperCase())}
          onBlur={() => void runCheck()}
          placeholder="e.g. SMITH2026"
        />
      </Field>

      <Field label="Client name *">
        <input
          className="field"
          value={clientName}
          disabled={submitting}
          onChange={(e) => setClientName(e.target.value)}
          onBlur={() => void runCheck()}
          placeholder="Full client name"
        />
      </Field>

      <Field label="Case title *">
        <input
          className="field"
          value={caseTitle}
          disabled={submitting}
          onChange={(e) => setCaseTitle(e.target.value)}
          onBlur={() => void runCheck()}
          placeholder="e.g. Collection vs. Juan Dela Cruz"
        />
      </Field>

      <Field label="Role in case">
        <ClientCaseRoleSelect value={caseRole} disabled={submitting} onChange={setCaseRole} />
      </Field>

      <ClientCodeWarningPanel
        check={check}
        clientCode={clientCode}
        context="intake"
        conflictReviewChoice={conflictReviewChoice}
        onConflictReviewChoiceChange={setConflictReviewChoice}
        onUseExistingCode={(code) => {
          setClientCode(code);
          setConflictReviewChoice("same_case");
          void runCheck();
        }}
      />

      <Field label="Case number">
        <input
          className="field"
          value={caseNumber}
          disabled={submitting}
          onChange={(e) => setCaseNumber(e.target.value)}
          onBlur={() => void runCheck()}
          placeholder="Court case number, if any"
        />
      </Field>

      <Field label="Court where pending">
        <input
          className="field"
          value={courtPending}
          disabled={submitting}
          onChange={(e) => setCourtPending(e.target.value)}
          onBlur={() => void runCheck()}
          placeholder="e.g. RTC Branch 45, Quezon City"
        />
      </Field>

      <Field label="Contact email" hint="For SOA and receipts. Can use firm email if none.">
        <input
          className="field"
          type="email"
          value={contactEmail}
          disabled={submitting}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="client@email.com"
        />
      </Field>

      <Field label="Contact phone">
        <input
          className="field"
          value={contactPhone}
          disabled={submitting}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="+63 ..."
        />
      </Field>

      <Field label="Client address">
        <textarea
          className="field min-h-[72px]"
          value={clientAddress}
          disabled={submitting}
          onChange={(e) => setClientAddress(e.target.value)}
          placeholder="Address for invoices"
        />
      </Field>

      <div className="form-grid-pair">
        <Field label="Previous balance">
          <input
            className="field"
            type="number"
            min="0"
            step="0.01"
            value={prevBalance}
            disabled={submitting}
            onChange={(e) => setPrevBalance(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Preferred greeting" hint="Used in emails. First name if blank.">
          <input
            className="field"
            value={preferredGreeting}
            disabled={submitting}
            onChange={(e) => setPreferredGreeting(e.target.value)}
            placeholder="e.g. Maria"
          />
        </Field>
      </div>

      <FormStatusReport status={saveStatus} />
      <button
        type="button"
        disabled={submitting || !clientCode || !clientName || codeBlocked}
        onClick={() => void handleSubmit()}
        className="btn-primary mt-4"
      >
        {busy || saveStatus?.phase === "processing" ? "Creating client…" : "Create client & ledger tab"}
      </button>
    </section>
  );
}

function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2.5">
      <label className="mb-1 block text-xs font-bold text-[#4a4339]">{label}</label>
      {hint && <p className="mb-1 text-[10px] text-muted">{hint}</p>}
      {children}
    </div>
  );
}
