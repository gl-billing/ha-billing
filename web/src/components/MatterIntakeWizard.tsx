"use client";

import { useEffect, useMemo, useState } from "react";
import type { NewClientPayload } from "@/lib/gl-config";
import { AssignedLawyerFields } from "@/components/AssignedLawyerFields";
import { formatClientAssignedLawyers } from "@/lib/assigned-lawyers";
import { ClientCaseRoleSelect } from "@/components/ClientCaseRoleSelect";
import { ClientCodeWarningPanel } from "@/components/ClientCodeWarningPanel";
import { ClientContactEmailField } from "@/components/office-tasks/ClientContactEmailField";
import { useClientCodeCheck } from "@/hooks/useClientCodeCheck";
import {
  formatContactEmails,
  hasAnyContactEmail,
  primaryContactEmail
} from "@/lib/contact-emails";
import { LitigationAppearanceFeeTable } from "@/components/LitigationAppearanceFeeTable";
import {
  contractAcceptanceFeeSummary,
  defaultEngagementLetterInput,
  formatLitigationAcceptanceFee,
  isDeclarationOfNullityCase,
  resolveContractAcceptanceFee,
  resolveLitigationFeeSchedule,
  type EngagementDocumentType,
  type EngagementLetterInput
} from "@/lib/engagement-letter";
import {
  defaultFeeTypeForDocument,
  feeTypeOptionsForDocument,
  INTAKE_CONFERENCE_TASK,
  previewIntakeTasks
} from "@/lib/intake-checklist-config";
import {
  clientCodeCheckBlocksCreate,
  clientCodeCheckCanProceed,
  collisionWarningMessage,
  conflictReviewBlocksProceed,
  formatCodeConflictMessage,
  groupCollisionWarnings,
  type ClientCodeCheckResult,
  type ConflictReviewChoice
} from "@/lib/sheets/client-code-check";
import { ConflictReviewAcknowledgement } from "@/components/ConflictReviewAcknowledgement";
import {
  ConflictMatchList,
  ConflictWarningCard,
  ConflictWarningSection
} from "@/components/ConflictWarningCard";
import { resolveClientGreeting } from "@/lib/client-greeting";
import { formatSuccessReport } from "@/lib/firm-status-report";
import { ClientCaseTypeSelect } from "@/components/ClientCaseTypeSelect";
import {
  caseTypeOtherRequired,
  formatClientCaseTypeLabel,
  normalizeClientCaseType,
  showPsychologistFields,
  type ClientCaseType
} from "@/lib/client-case-type";
import { PsychologistFieldsSection } from "@/components/PsychologistFieldsSection";
import { ClientMatterTypeSelect } from "@/components/ClientMatterTypeSelect";
import {
  caseTitleRequiredForMatterType,
  CLIENT_MATTER_TYPE_LABELS,
  formatMatterCaseCaption,
  resolveClientMatterType,
  type ClientMatterType
} from "@/lib/client-matter-type";
import { clearFormDraft, readFormDraft, saveFormDraft } from "@/lib/form-draft-storage";

const INTAKE_DRAFT_KEY = "matter-intake-wizard";

type IntakeDraft = {
  step: Step;
  clientCode: string;
  clientName: string;
  caseTitle: string;
  matterType: ClientMatterType;
  caseType: ClientCaseType | "";
  caseTypeOther: string;
  caseRole: string;
  caseNumber: string;
  courtPending: string;
  contactEmails: string[];
  contactPhone: string;
  clientAddress: string;
  psychologistName: string;
  psychologistPhone: string;
  psychologistAddress: string;
  prevBalance: string;
  assignedAttorney: string;
  coAssignedAttorney: string;
  checklist: {
    engagementLetter: boolean;
    scheduleInitialConference: boolean | null;
  };
  letter: EngagementLetterInput;
};

type Props = {
  busy: boolean;
  onStatus: (message: string, isError?: boolean, isProcessing?: boolean) => void;
  onComplete: (clientCode: string, options?: { highlightTaskId?: string }) => void;
};

type Step = 1 | 2 | 3 | 4 | 5;

function activeCaseValidationError(input: {
  matterType: ClientMatterType;
  caseTitle: string;
  caseType: ClientCaseType | "";
  caseTypeOther: string;
}): string | null {
  if (!caseTitleRequiredForMatterType(input.matterType)) return null;
  if (!input.caseTitle.trim()) return "Enter the case title for an active case.";
  if (!input.caseType) return "Select the case type.";
  if (caseTypeOtherRequired(input.caseType) && !input.caseTypeOther.trim()) {
    return "Please specify the case type.";
  }
  return null;
}

export function MatterIntakeWizard({ busy, onStatus, onComplete }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [matterType, setMatterType] = useState<ClientMatterType>("case");
  const [caseType, setCaseType] = useState<ClientCaseType | "">("");
  const [caseTypeOther, setCaseTypeOther] = useState("");
  const [caseRole, setCaseRole] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [courtPending, setCourtPending] = useState("");
  const [contactEmails, setContactEmails] = useState<string[]>([""]);
  const [contactPhone, setContactPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [psychologistName, setPsychologistName] = useState("");
  const [psychologistPhone, setPsychologistPhone] = useState("");
  const [psychologistAddress, setPsychologistAddress] = useState("");
  const [prevBalance, setPrevBalance] = useState("");
  const [assignedAttorney, setAssignedAttorney] = useState("");
  const [coAssignedAttorney, setCoAssignedAttorney] = useState("");
  const [checklist, setChecklist] = useState({
    engagementLetter: true,
    scheduleInitialConference: null as boolean | null
  });
  const [registeredCode, setRegisteredCode] = useState<string | null>(null);
  const [engagementTaskId, setEngagementTaskId] = useState<string | null>(null);
  const [letterBusy, setLetterBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [letterPreviewHtml, setLetterPreviewHtml] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; body: string } | null>(null);
  const [letter, setLetter] = useState<EngagementLetterInput>(() =>
    defaultEngagementLetterInput({ clientName: "", clientCode: "", caseTitle: "" })
  );

  const intakeChecklistPayload = useMemo(
    () => ({
      engagementLetter: checklist.engagementLetter,
      documentType: letter.documentType,
      feeType: letter.feeType,
      scheduleInitialConference: checklist.scheduleInitialConference === true
    }),
    [checklist, letter.documentType, letter.feeType]
  );

  const selectedTasks = useMemo(() => previewIntakeTasks(intakeChecklistPayload), [intakeChecklistPayload]);

  const feeTypeOptions = useMemo(() => feeTypeOptionsForDocument(letter.documentType), [letter.documentType]);

  const { check, checking, runCheck, conflictReviewChoice, setConflictReviewChoice, codeBlocked, hasWarnings, canProceed, warningMessage } =
    useClientCodeCheck({
      clientCode,
      clientName,
      caseTitle,
      caseNumber,
      courtPending
    });

  useEffect(() => {
    const draft = readFormDraft<IntakeDraft>(INTAKE_DRAFT_KEY);
    if (!draft || draft.step >= 5) return;
    setStep(draft.step);
    setClientCode(draft.clientCode || "");
    setClientName(draft.clientName || "");
    setCaseTitle(draft.caseTitle || "");
    setMatterType(resolveClientMatterType({ matterType: draft.matterType, caseTitle: draft.caseTitle }));
    setCaseType(normalizeClientCaseType(draft.caseType));
    setCaseTypeOther(draft.caseTypeOther || "");
    setCaseRole(draft.caseRole || "");
    setCaseNumber(draft.caseNumber || "");
    setCourtPending(draft.courtPending || "");
    setContactEmails(draft.contactEmails?.length ? draft.contactEmails : [""]);
    setContactPhone(draft.contactPhone || "");
    setClientAddress(draft.clientAddress || "");
    setPsychologistName(draft.psychologistName || "");
    setPsychologistPhone(draft.psychologistPhone || "");
    setPsychologistAddress(draft.psychologistAddress || "");
    setPrevBalance(draft.prevBalance || "");
    setAssignedAttorney(draft.assignedAttorney || "");
    setCoAssignedAttorney(draft.coAssignedAttorney || "");
    setChecklist(draft.checklist || { engagementLetter: true, scheduleInitialConference: null });
    if (draft.letter) setLetter(draft.letter);
  }, []);

  useEffect(() => {
    if (registeredCode || step >= 5) return;
    saveFormDraft(INTAKE_DRAFT_KEY, {
      step,
      clientCode,
      clientName,
      caseTitle,
      matterType,
      caseType,
      caseTypeOther,
      caseRole,
      caseNumber,
      courtPending,
      contactEmails,
      contactPhone,
      clientAddress,
      psychologistName,
      psychologistPhone,
      psychologistAddress,
      prevBalance,
      assignedAttorney,
      coAssignedAttorney,
      checklist,
      letter
    });
  }, [
    step,
    clientCode,
    clientName,
    caseTitle,
    matterType,
    caseType,
    caseTypeOther,
    caseRole,
    caseNumber,
    courtPending,
    contactEmails,
    contactPhone,
    clientAddress,
    psychologistName,
    psychologistPhone,
    psychologistAddress,
    prevBalance,
    assignedAttorney,
    coAssignedAttorney,
    checklist,
    letter,
    registeredCode
  ]);

  useEffect(() => {
    if (step === 3 && clientCode.trim() && clientName.trim()) {
      void runCheck();
    }
  }, [step, clientCode, clientName, runCheck]);

  useEffect(() => {
    if (letter.documentType !== "contract") return;
    const fee = resolveContractAcceptanceFee(caseTitle, courtPending);
    const schedule = resolveLitigationFeeSchedule(courtPending);
    setLetter((prev) => ({
      ...prev,
      feeAmount: formatLitigationAcceptanceFee(fee.acceptanceFee),
      appearanceFeeAmount: formatLitigationAcceptanceFee(schedule.appearanceFee),
      scopeOfWork:
        prev.scopeOfWork.trim() &&
        !prev.scopeOfWork.startsWith("Legal representation of the Client")
          ? prev.scopeOfWork
          : `Legal representation of the Client in the civil case described above${courtPending.trim() ? ` before ${courtPending.trim()}` : ""}, including consultation, preparation and filing of pleadings and submissions, attendance at hearings, pre-trial conferences, and mediations as scheduled, and related client communications.`
    }));
  }, [caseTitle, courtPending, letter.documentType]);

  function syncLetterFromForm() {
    setLetter((prev) => ({
      ...prev,
      clientName,
      clientCode: registeredCode || clientCode,
      caseTitle,
      caseRole,
      caseNumber,
      courtPending,
      contactEmail: formatContactEmails(contactEmails),
      clientAddress,
      handlingAttorney: formatClientAssignedLawyers(assignedAttorney, coAssignedAttorney) || assignedAttorney
    }));
  }

  function letterPayloadForDelivery(): EngagementLetterInput {
    return {
      ...letter,
      clientName: clientName.trim() || letter.clientName,
      clientCode: registeredCode || clientCode || letter.clientCode,
      caseTitle,
      caseNumber,
      courtPending,
      contactEmail: formatContactEmails(contactEmails),
      clientAddress,
      handlingAttorney: formatClientAssignedLawyers(assignedAttorney, coAssignedAttorney) || assignedAttorney
    };
  }

  async function loadLetterPreview(nextLetter?: EngagementLetterInput) {
    const payload = nextLetter || letter;
    const res = await fetch("/api/intake/engagement-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", letter: payload })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not load letter preview.");
    setLetterPreviewHtml(json.html || null);
    setEmailPreview(json.email || null);
  }

  async function submitIntake() {
    if (!canProceed) {
      if (codeBlocked) {
        onStatus("Change the client code — that profile already exists and cannot be overridden.", true);
      } else {
        onStatus(conflictReviewBlocksProceed(conflictReviewChoice) || "Review the collision warning before continuing.", true);
      }
      return;
    }

    if (caseTitleRequiredForMatterType(matterType) && !caseTitle.trim()) {
      onStatus("Enter the case title for an active case.", true);
      return;
    }
    const caseValidationError = activeCaseValidationError({ matterType, caseTitle, caseType, caseTypeOther });
    if (caseValidationError) {
      onStatus(caseValidationError, true);
      return;
    }

    onStatus("Registering matter and creating ledger tab…", false, true);
    setSubmitting(true);

    try {
    const payload: NewClientPayload = {
      clientCode,
      clientName,
      caseTitle,
      matterType,
      caseType,
      caseTypeOther,
      caseRole,
      caseNumber,
      courtPending,
      contactEmail: formatContactEmails(contactEmails),
      contactPhone,
      clientAddress,
      psychologistName,
      psychologistPhone,
      psychologistAddress,
      prevBalance,
      preferredGreeting: resolveClientGreeting("", clientName),
      clientStatus: "Active",
      assignedAttorney,
      coAssignedAttorney
    };

    const res = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        checklist: intakeChecklistPayload,
        acknowledgeConflicts: conflictReviewChoice === "different_case",
        conflictReviewChoice: conflictReviewChoice || undefined
      })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Intake failed.");

    const code = json.clientCode || clientCode;
    setRegisteredCode(code);
    const createdTasks = Array.isArray(json.createdTasks)
      ? (json.createdTasks as string[]).filter((id) => /-TASK-/i.test(id))
      : [];
    setEngagementTaskId(createdTasks[0] || null);
    onStatus(formatSuccessReport(json.message || "Matter registered.", code));

    if (checklist.engagementLetter) {
      const nextLetter = {
        ...letter,
        clientName,
        clientCode: code,
        caseTitle,
        caseNumber,
        courtPending,
        contactEmail: formatContactEmails(contactEmails),
        clientAddress,
        handlingAttorney: formatClientAssignedLawyers(assignedAttorney, coAssignedAttorney) || assignedAttorney,
        preferredGreeting: resolveClientGreeting("", clientName)
      };
      setLetter(nextLetter);
      await loadLetterPreview(nextLetter);
      setStep(5);
      return;
    }

    finishWizard(code);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Intake failed.", true);
    } finally {
      setSubmitting(false);
    }
  }

  function finishWizard(code: string, options?: { highlightTaskId?: string }) {
    onComplete(code, options);
    resetForm();
  }

  function resetForm() {
    clearFormDraft(INTAKE_DRAFT_KEY);
    setStep(1);
    setClientCode("");
    setClientName("");
    setCaseTitle("");
    setMatterType("case");
    setCaseType("");
    setCaseTypeOther("");
    setCaseRole("");
    setCaseNumber("");
    setCourtPending("");
    setContactEmails([""]);
    setContactPhone("");
    setClientAddress("");
    setPsychologistName("");
    setPsychologistPhone("");
    setPsychologistAddress("");
    setPrevBalance("");
    setAssignedAttorney("");
    setCoAssignedAttorney("");
    setChecklist({ engagementLetter: true, scheduleInitialConference: null });
    setRegisteredCode(null);
    setEngagementTaskId(null);
    setLetterPreviewHtml(null);
    setEmailPreview(null);
    setLetter(defaultEngagementLetterInput({ clientName: "", clientCode: "", caseTitle: "" }));
  }

  async function downloadLetterPdf() {
    setLetterBusy(true);
    try {
      const payload = letterPayloadForDelivery();
      const res = await fetch("/api/intake/engagement-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pdf", letter: payload })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "PDF download failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${payload.documentType === "contract" ? "Contract-of-Legal-Services" : "Retainership-Agreement"}-${payload.clientCode}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      onStatus("Engagement letter PDF downloaded.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "PDF download failed.", true);
    } finally {
      setLetterBusy(false);
    }
  }

  async function deliverLetter(action: "send" | "draft") {
    if (!primaryContactEmail(contactEmails)) {
      onStatus("Add a client email on step 2 before sending the engagement letter.", true);
      return;
    }

    setLetterBusy(true);
    try {
      const payload = letterPayloadForDelivery();
      const res = await fetch("/api/intake/engagement-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          letter: payload,
          recipientEmail: primaryContactEmail(contactEmails)
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not deliver engagement letter.");
      onStatus(json.message || (action === "draft" ? "Gmail draft saved." : "Engagement letter sent."));
      if (action === "send" && registeredCode) {
        finishWizard(registeredCode, { highlightTaskId: engagementTaskId || undefined });
      }
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not deliver engagement letter.", true);
    } finally {
      setLetterBusy(false);
    }
  }

  const formBusy = letterBusy || submitting;
  const totalSteps = checklist.engagementLetter ? 5 : 4;
  const stepLabels = ["Client", "Contact", "Engagement", "Review", "Send"];

  return (
    <section className="card matter-intake-wizard">
      <p className="section-label">New matter intake</p>
      <p className="mb-3 text-xs text-muted">
        Step {step} of {totalSteps} — registers billing client, ledger tab, and optional starter tasks in Office Tasks.
      </p>

      <ol className="matter-intake-wizard__steps" aria-label="Intake progress">
        {stepLabels.slice(0, totalSteps).map((label, index) => {
          const stepNumber = (index + 1) as Step;
          const state = step > stepNumber ? "done" : step === stepNumber ? "active" : "pending";
          return (
            <li key={label} className={`matter-intake-wizard__step matter-intake-wizard__step--${state}`}>
              <span className="matter-intake-wizard__step-mark" aria-hidden>
                {state === "done" ? "✓" : stepNumber}
              </span>
              <span className="matter-intake-wizard__step-label">{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <div className="space-y-2">
          <Field label="Client code *" hint="Client's surname in CAPS — e.g. SMITH or SMITH2026.">
            <input
              className="field"
              value={clientCode}
              disabled={formBusy}
              onChange={(e) => setClientCode(e.target.value.toUpperCase())}
              onBlur={() => void runCheck()}
            />
          </Field>
          <Field label="Client name *" hint="Full name of the client.">
            <input
              className="field"
              value={clientName}
              disabled={formBusy}
              onChange={(e) => setClientName(e.target.value)}
              onBlur={() => void runCheck()}
            />
          </Field>
          <Field label="Client file type *" hint="Choose whether this file is tied to a case, a retainer, or general billing only.">
            <ClientMatterTypeSelect
              value={matterType}
              disabled={formBusy}
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
              <Field label="Case title *" hint="Caption of the case — e.g. Smith vs. Smith. Shown as Re: on letters.">
                <input
                  className="field"
                  value={caseTitle}
                  disabled={formBusy}
                  onChange={(e) => setCaseTitle(e.target.value)}
                  onBlur={() => void runCheck()}
                />
              </Field>
              <Field label="Case type *" hint="Nature of the case — annulment, civil, criminal, and so on.">
                <ClientCaseTypeSelect
                  caseType={caseType}
                  caseTypeOther={caseTypeOther}
                  disabled={formBusy}
                  onCaseTypeChange={setCaseType}
                  onCaseTypeOtherChange={setCaseTypeOther}
                />
              </Field>
            </>
          ) : null}
          {caseTitleRequiredForMatterType(matterType) ? (
            <Field label="Role in case" hint="Optional — leave blank if not applicable.">
              <ClientCaseRoleSelect value={caseRole} disabled={formBusy} onChange={setCaseRole} />
            </Field>
          ) : null}
          <ClientCodeWarningPanel
            check={check}
            checking={checking}
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
          <div className="matter-intake-wizard__nav form-save-bar--sticky-mobile">
            <button
              type="button"
              className="btn-primary"
              disabled={formBusy || !clientCode || !clientName || codeBlocked || checking}
              onClick={async () => {
                if (checking) return;
                const caseValidationError = activeCaseValidationError({
                  matterType,
                  caseTitle,
                  caseType,
                  caseTypeOther
                });
                if (caseValidationError) {
                  onStatus(caseValidationError, true);
                  return;
                }
                const result = check ?? (await runCheck());
                const reviewError = conflictReviewBlocksProceed(conflictReviewChoice);
                if (!clientCodeCheckCanProceed(result, conflictReviewChoice)) {
                  if (clientCodeCheckBlocksCreate(result)) {
                    onStatus("Change the client code — that code is already listed or has a ledger tab.", true);
                  } else {
                    onStatus(reviewError || "Review the client code warning before continuing.", true);
                  }
                  return;
                }
                setStep(2);
              }}
            >
              {checking ? "Checking…" : "Next"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-2">
          <p className="matter-intake-wizard__panel-hint mb-1">
            Get <strong className="text-ink">contact email or phone</strong> and the client&apos;s{" "}
            <strong className="text-ink">address</strong>. Other fields may be left blank.
          </p>
          <Field label="Case number" hint="Optional.">
            <input className="field" value={caseNumber} disabled={formBusy} onChange={(e) => setCaseNumber(e.target.value)} />
          </Field>
          <Field label="Court where pending" hint="Optional.">
            <input className="field" value={courtPending} disabled={formBusy} onChange={(e) => setCourtPending(e.target.value)} />
          </Field>
          <AssignedLawyerFields
            primaryLawyer={assignedAttorney}
            secondaryLawyer={coAssignedAttorney}
            disabled={formBusy}
            layout="stack"
            onPrimaryChange={setAssignedAttorney}
            onSecondaryChange={setCoAssignedAttorney}
          />
          <ClientContactEmailField
            emails={contactEmails}
            disabled={formBusy}
            hint="Email or phone required — enter at least one. Use + Add email when the client has more than one address."
            onEmailsChange={setContactEmails}
          />
          <Field label="Phone" hint="Email or phone required — enter at least one.">
            <input className="field" value={contactPhone} disabled={formBusy} onChange={(e) => setContactPhone(e.target.value)} />
          </Field>
          <Field label="Address" hint="Required for letters and client records.">
            <textarea className="field min-h-[72px]" value={clientAddress} disabled={formBusy} onChange={(e) => setClientAddress(e.target.value)} />
          </Field>
          <PsychologistFieldsSection
            caseType={caseType}
            caseTitle={caseTitle}
            name={psychologistName}
            phone={psychologistPhone}
            address={psychologistAddress}
            disabled={formBusy}
            onNameChange={setPsychologistName}
            onPhoneChange={setPsychologistPhone}
            onAddressChange={setPsychologistAddress}
          />
          <div className="matter-intake-wizard__nav form-save-bar--sticky-mobile">
            <button type="button" className="btn-secondary" disabled={formBusy} onClick={() => setStep(1)}>Back</button>
            <button
              type="button"
              className="btn-primary"
              disabled={formBusy}
              onClick={() => {
                if (!hasAnyContactEmail(contactEmails) && !contactPhone.trim()) {
                  onStatus("Enter contact email or phone before continuing.", true);
                  return;
                }
                if (!clientAddress.trim()) {
                  onStatus("Enter the client's address before continuing.", true);
                  return;
                }
                setStep(3);
              }}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <Field label="Previous balance">
            <input className="field" type="number" min="0" step="0.01" value={prevBalance} disabled={formBusy} onChange={(e) => setPrevBalance(e.target.value)} />
          </Field>

          <ConflictCheckStatus
            checking={checking}
            check={check}
            codeBlocked={codeBlocked}
            hasWarnings={hasWarnings}
            warningMessage={warningMessage}
            clientCode={clientCode}
            conflictReviewChoice={conflictReviewChoice}
            onConflictReviewChoiceChange={setConflictReviewChoice}
            onUseExistingCode={(code) => {
              setClientCode(code);
              setConflictReviewChoice("same_case");
              void runCheck();
            }}
          />

          <div className="matter-intake-wizard__panel">
            <p className="matter-intake-wizard__panel-title">Starter checklist</p>
            <p className="matter-intake-wizard__panel-hint">
              Conflict review is completed above <strong>before</strong> this client is registered. Selected items
              create tasks in <strong>Office Tasks</strong> (due in 7 days). Document prep goes to Andrea; conference
              tasks go to the handling attorney.
            </p>

            <label className="mt-3 flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checklist.engagementLetter}
                disabled={formBusy}
                onChange={(e) => setChecklist((prev) => ({ ...prev, engagementLetter: e.target.checked }))}
              />
              <span>
                <strong className="text-ink">Prepare engagement document</strong>
                <span className="block text-[11px] text-muted">
                  Task follows document type and fee structure below
                </span>
              </span>
            </label>

            <div className="mt-3 rounded-md border border-line/70 bg-white/50 p-3">
              <p className="text-xs font-bold text-ink">Schedule initial client conference?</p>
              <p className="mt-1 text-[11px] text-muted">Choose whether to create a follow-up task for plotting the first meeting.</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scheduleInitialConference"
                    checked={checklist.scheduleInitialConference === true}
                    disabled={formBusy}
                    onChange={() => setChecklist((prev) => ({ ...prev, scheduleInitialConference: true }))}
                  />
                  Yes — create task
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scheduleInitialConference"
                    checked={checklist.scheduleInitialConference === false}
                    disabled={formBusy}
                    onChange={() => setChecklist((prev) => ({ ...prev, scheduleInitialConference: false }))}
                  />
                  No — not needed
                </label>
              </div>
              {checklist.scheduleInitialConference === true ? (
                <p className="mt-2 text-[11px] text-muted">Creates task: {INTAKE_CONFERENCE_TASK}</p>
              ) : null}
            </div>

            {courtPending ? (
              <p className="mt-2 text-[11px] text-muted">A hearing event with “Call court to confirm” will also be created.</p>
            ) : null}
          </div>

          {checklist.engagementLetter ? (
            <div className="matter-intake-wizard__panel matter-intake-wizard__panel--gold">
              <p className="matter-intake-wizard__panel-title">Document type & fees</p>
              <p className="matter-intake-wizard__panel-hint">
                The prep task text matches your selection — retainership (retainer / hourly / flat) or contract
                (acceptance fee).
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Field label="Document type">
                  <select
                    className="field"
                    value={letter.documentType}
                    disabled={formBusy}
                    onChange={(e) => {
                      const documentType = e.target.value as EngagementDocumentType;
                      const fee = resolveContractAcceptanceFee(caseTitle, courtPending);
                      const schedule = resolveLitigationFeeSchedule(courtPending);
                      setLetter((prev) => ({
                        ...prev,
                        documentType,
                        feeType: defaultFeeTypeForDocument(documentType),
                        feeAmount:
                          documentType === "contract"
                            ? formatLitigationAcceptanceFee(fee.acceptanceFee)
                            : prev.feeAmount || "To be confirmed upon signing",
                        appearanceFeeAmount:
                          documentType === "contract"
                            ? formatLitigationAcceptanceFee(schedule.appearanceFee)
                            : prev.appearanceFeeAmount || "",
                        successFeeEnabled: documentType === "contract" ? prev.successFeeEnabled : false,
                        successFeeAmount:
                          documentType === "contract" ? prev.successFeeAmount || "" : "",
                        scopeOfWork:
                          documentType === "contract"
                            ? `Legal representation of the Client in the civil case described above${courtPending.trim() ? ` before ${courtPending.trim()}` : ""}, including consultation, preparation and filing of pleadings and submissions, attendance at hearings, pre-trial conferences, and mediations as scheduled, and related client communications.`
                            : prev.scopeOfWork
                      }));
                    }}
                  >
                    <option value="engagement">Retainership agreement</option>
                    <option value="contract">Contract of legal services</option>
                  </select>
                </Field>
                <Field label="Effective date">
                  <input
                    className="field"
                    type="date"
                    value={letter.effectiveDate}
                    disabled={formBusy}
                    onChange={(e) => setLetter((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Scope of legal services">
                <textarea
                  className="field min-h-[72px]"
                  value={letter.scopeOfWork}
                  disabled={formBusy}
                  onChange={(e) => setLetter((prev) => ({ ...prev, scopeOfWork: e.target.value }))}
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                {letter.documentType === "contract" ? (
                  <>
                    <Field
                      label="Acceptance fee"
                      hint="Default follows case type and court; adjust if needed."
                    >
                      <input
                        className="field"
                        value={letter.feeAmount}
                        disabled={formBusy}
                        onChange={(e) => setLetter((prev) => ({ ...prev, feeAmount: e.target.value }))}
                        placeholder={contractAcceptanceFeeSummary(caseTitle, courtPending)}
                      />
                    </Field>
                    <Field
                      label="Appearance fee (per hearing)"
                      hint="Exclusive of gas, meal, and accommodation. Table below suggests the amount by venue."
                    >
                      <input
                        className="field"
                        value={letter.appearanceFeeAmount || ""}
                        disabled={formBusy}
                        onChange={(e) =>
                          setLetter((prev) => ({ ...prev, appearanceFeeAmount: e.target.value }))
                        }
                        placeholder={
                          courtPending.trim()
                            ? formatLitigationAcceptanceFee(
                                resolveLitigationFeeSchedule(courtPending).appearanceFee
                              )
                            : "e.g. PHP 5,000.00"
                        }
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Fee type">
                      <select
                        className="field"
                        value={letter.feeType}
                        disabled={formBusy}
                        onChange={(e) =>
                          setLetter((prev) => ({
                            ...prev,
                            feeType: e.target.value as EngagementLetterInput["feeType"]
                          }))
                        }
                      >
                        {feeTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Fee amount / rate">
                      <input
                        className="field"
                        value={letter.feeAmount}
                        disabled={formBusy}
                        onChange={(e) => setLetter((prev) => ({ ...prev, feeAmount: e.target.value }))}
                        placeholder="e.g. PHP 25,000 retainer"
                      />
                    </Field>
                  </>
                )}
              </div>
              {letter.documentType === "contract" ? (
                <>
                  <label className="mt-3 flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={Boolean(letter.successFeeEnabled)}
                      disabled={formBusy}
                      onChange={(e) =>
                        setLetter((prev) => ({
                          ...prev,
                          successFeeEnabled: e.target.checked,
                          successFeeAmount: e.target.checked ? prev.successFeeAmount || "" : ""
                        }))
                      }
                    />
                    <span>
                      <strong className="text-ink">Include success fee</strong>
                      <span className="block text-[11px] text-muted">
                        Adds a success fee section to the contract when an amount is entered.
                      </span>
                    </span>
                  </label>
                  {letter.successFeeEnabled ? (
                    <Field label="Success fee amount">
                      <input
                        className="field"
                        value={letter.successFeeAmount || ""}
                        disabled={formBusy}
                        onChange={(e) =>
                          setLetter((prev) => ({ ...prev, successFeeAmount: e.target.value }))
                        }
                        placeholder="e.g. PHP 50,000.00"
                      />
                    </Field>
                  ) : null}
                  <LitigationAppearanceFeeTable
                    courtPending={courtPending}
                    disabled={formBusy}
                    onExampleCourtSelect={(example) => setCourtPending(example)}
                  />
                  <p className="mt-3 text-[11px] leading-relaxed text-muted">
                    Suggested acceptance fee:{" "}
                    <strong className="text-ink">{contractAcceptanceFeeSummary(caseTitle, courtPending)}</strong>.
                    {isDeclarationOfNullityCase(caseTitle)
                      ? " Nullity matters use ₱250,000 (Davao/nearby) or ₱350,000 (regional/farther) based on the court above."
                      : " Other civil matters use ₱100,000 unless you change the acceptance fee above."}{" "}
                    Expense deposit in the contract is PHP 5,000–10,000 based on case evaluation and record volume.
                  </p>
                </>
              ) : null}
              <p className="mt-2 text-[11px] text-muted">
                Office task:{" "}
                <strong className="text-ink">
                  {previewIntakeTasks({
                    engagementLetter: true,
                    documentType: letter.documentType,
                    feeType: letter.feeType
                  })[0] || "—"}
                </strong>
              </p>
              <Field label="Additional fee notes">
                <input
                  className="field"
                  value={letter.feeNotes || ""}
                  disabled={formBusy}
                  onChange={(e) => setLetter((prev) => ({ ...prev, feeNotes: e.target.value }))}
                  placeholder="Optional billing notes"
                />
              </Field>
            </div>
          ) : null}

          <div className="matter-intake-wizard__nav form-save-bar--sticky-mobile">
            <button type="button" className="btn-secondary" disabled={formBusy} onClick={() => setStep(2)}>Back</button>
            <button
              type="button"
              className="btn-primary"
              disabled={formBusy}
              onClick={() => {
                if (checklist.scheduleInitialConference === null) {
                  onStatus("Choose whether to schedule an initial client conference.", true);
                  return;
                }
                const reviewError = conflictReviewBlocksProceed(conflictReviewChoice);
                if (!canProceed) {
                  if (codeBlocked) {
                    onStatus("Change the client code — that code is already listed or has a ledger tab.", true);
                  } else {
                    onStatus(reviewError || "Complete conflict review before continuing.", true);
                  }
                  return;
                }
                syncLetterFromForm();
                setStep(4);
              }}
            >
              Review
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3 text-sm">
          <div className="matter-intake-wizard__panel text-xs">
            <p><strong>Code:</strong> {clientCode}</p>
            <p><strong>Client:</strong> {clientName}</p>
            <p><strong>File type:</strong> {CLIENT_MATTER_TYPE_LABELS[matterType]}</p>
            {formatMatterCaseCaption({ matterType, caseTitle }) ? (
              <p><strong>Case:</strong> {formatMatterCaseCaption({ matterType, caseTitle })}</p>
            ) : null}
            {caseType ? (
              <p><strong>Case type:</strong> {formatClientCaseTypeLabel(caseType, caseTypeOther)}</p>
            ) : null}
            <p><strong>Court:</strong> {courtPending || "—"}</p>
            <p><strong>Lawyers:</strong> {formatClientAssignedLawyers(assignedAttorney, coAssignedAttorney) || "Unassigned"}</p>
            <p><strong>Email:</strong> {formatContactEmails(contactEmails) || "—"}</p>
            {showPsychologistFields({ caseType, caseTitle }) ? (
              <>
                <p><strong>Psychologist:</strong> {psychologistName || "—"}</p>
                <p><strong>Psychologist contact:</strong> {psychologistPhone || "—"}</p>
                <p><strong>Psychologist address:</strong> {psychologistAddress || "—"}</p>
              </>
            ) : null}
          </div>

          {selectedTasks.length ? (
            <div className="matter-intake-wizard__panel matter-intake-wizard__panel--gold text-xs">
              <p className="matter-intake-wizard__panel-title">Tasks that will be created in Office Tasks</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
                {selectedTasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted">No starter tasks selected.</p>
          )}

          {checklist.engagementLetter ? (
            <>
              {letter.documentType === "contract" ? (
                <div className="matter-intake-wizard__panel text-xs">
                  <p className="matter-intake-wizard__panel-title">Contract fees</p>
                  <p><strong>Acceptance fee:</strong> {letter.feeAmount || contractAcceptanceFeeSummary(caseTitle, courtPending)}</p>
                  <p>
                    <strong>Appearance fee:</strong>{" "}
                    {letter.appearanceFeeAmount?.trim() ||
                      (courtPending.trim()
                        ? formatLitigationAcceptanceFee(
                            resolveLitigationFeeSchedule(courtPending).appearanceFee
                          )
                        : "—")}
                  </p>
                  {letter.successFeeEnabled && letter.successFeeAmount?.trim() ? (
                    <p><strong>Success fee:</strong> {letter.successFeeAmount.trim()}</p>
                  ) : null}
                </div>
              ) : null}
              <p className="text-xs text-muted">
                After registration, step 5 will open so you can review the retainership agreement or contract PDF and
                send it to the client.
              </p>
            </>
          ) : null}

          <div className="matter-intake-wizard__nav form-save-bar--sticky-mobile">
            <button type="button" className="btn-secondary" disabled={formBusy} onClick={() => setStep(3)}>Back</button>
            <button
              type="button"
              className="btn-primary"
              disabled={formBusy}
              onClick={() =>
                void submitIntake().catch((e) => onStatus(e instanceof Error ? e.message : "Intake failed.", true))
              }
            >
              Register matter
            </button>
          </div>
        </div>
      ) : null}

      {step === 5 && registeredCode ? (
        <div className="space-y-3">
          <div className="matter-intake-wizard__success">
            Matter <strong>{registeredCode}</strong> registered.
            {selectedTasks.length ? ` ${selectedTasks.length} starter task(s) created in Office Tasks.` : ""}
          </div>

          <p className="text-xs font-bold text-ink">Review document</p>
          <p className="text-[11px] text-muted">
            Confirm the document below, download the PDF, or send it to <strong>{formatContactEmails(contactEmails) || "the client email on file"}</strong>.
          </p>

          {letterPreviewHtml ? (
            <div className="max-h-72 overflow-auto rounded-lg border border-line bg-white p-2">
              <iframe title="Document preview" className="h-[26rem] w-full border-0" srcDoc={letterPreviewHtml} />
            </div>
          ) : null}

          {emailPreview ? (
            <div className="matter-intake-wizard__panel matter-intake-wizard__panel--gold">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-gold-dark">Email preview</p>
              <p className="mt-2 text-xs font-bold text-ink">Subject: {emailPreview.subject}</p>
              <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md border border-line/60 bg-white p-2 text-[11px] leading-relaxed text-muted">
                {emailPreview.body}
              </pre>
              <p className="mt-2 text-[11px] text-muted">The PDF will be attached to this email.</p>
            </div>
          ) : null}

          <button type="button" className="btn-secondary w-full" disabled={formBusy} onClick={() => void downloadLetterPdf()}>
            Download PDF
          </button>
          <button type="button" className="btn-primary w-full" disabled={formBusy || !primaryContactEmail(contactEmails)} onClick={() => void deliverLetter("send")}>
            Send email with PDF
          </button>
          <button
            type="button"
            className="w-full min-h-[42px] rounded-md border border-line bg-gradient-to-b from-white to-[#f4f1eb] text-xs font-extrabold text-ink disabled:opacity-50"
            disabled={formBusy || !primaryContactEmail(contactEmails)}
            onClick={() => void deliverLetter("draft")}
          >
            Save as Gmail draft instead
          </button>
          <button type="button" className="w-full text-xs font-bold text-muted underline" disabled={formBusy} onClick={() => finishWizard(registeredCode)}>
            Done — skip sending for now
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ConflictCheckStatus({
  checking,
  check,
  codeBlocked,
  hasWarnings,
  warningMessage,
  clientCode,
  conflictReviewChoice,
  onConflictReviewChoiceChange,
  onUseExistingCode
}: {
  checking: boolean;
  check: ClientCodeCheckResult | null;
  codeBlocked: boolean;
  hasWarnings: boolean;
  warningMessage: string | null;
  clientCode: string;
  conflictReviewChoice: ConflictReviewChoice | null;
  onConflictReviewChoiceChange: (value: ConflictReviewChoice | null) => void;
  onUseExistingCode: (code: string) => void;
}) {
  if (checking) {
    return (
      <ConflictWarningCard variant="checking" title="Checking for conflicts…" eyebrow="Conflict review" />
    );
  }

  if (codeBlocked && check?.codeConflict) {
    return (
      <ConflictWarningCard
        variant="blocked"
        eyebrow="Client code"
        title="Conflict — cannot use this code"
        subtitle={formatCodeConflictMessage(check.codeConflict)}
      />
    );
  }

  if (hasWarnings && check) {
    const groups = groupCollisionWarnings(check);
    const matches = [...groups.profileMatches, ...groups.taskGroupingMatches];

    return (
      <ConflictWarningCard
        variant="review"
        eyebrow="Before registration"
        title="Possible conflict — review required"
        subtitle={warningMessage || collisionWarningMessage(check) || undefined}
      >
        {groups.profileMatches.length ? (
          <ConflictWarningSection title="Similar profiles">
            <ConflictMatchList matches={groups.profileMatches.slice(0, 3)} onUseExistingCode={onUseExistingCode} />
          </ConflictWarningSection>
        ) : null}

        <ConflictReviewAcknowledgement
          choice={conflictReviewChoice}
          onChoiceChange={onConflictReviewChoiceChange}
          subject={clientCode}
          matches={matches}
          onUseExistingCode={onUseExistingCode}
        />
      </ConflictWarningCard>
    );
  }

  if (check && clientCodeCheckBlocksCreate(check) === false) {
    return (
      <ConflictWarningCard
        variant="clear"
        eyebrow="Conflict check"
        title="Conflict check clear"
        subtitle="No blocking code conflict found for this client/case."
      />
    );
  }

  return null;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {hint ? <p className="field-hint">{hint}</p> : null}
      {children}
    </div>
  );
}
