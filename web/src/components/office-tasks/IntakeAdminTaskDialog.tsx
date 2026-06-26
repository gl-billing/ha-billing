"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalPortal } from "@/components/ModalPortal";
import { ClientCodeWarningPanel } from "@/components/ClientCodeWarningPanel";
import { ConflictWarningCard } from "@/components/ConflictWarningCard";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useClientCodeCheck } from "@/hooks/useClientCodeCheck";
import { primaryContactEmail } from "@/lib/contact-emails";
import {
  contractAcceptanceFeeSummary,
  defaultEngagementLetterInput,
  formatLitigationAcceptanceFee,
  resolveContractAcceptanceFee,
  resolveLitigationFeeSchedule,
  type EngagementLetterInput
} from "@/lib/engagement-letter";
import {
  intakeAdminTaskActionLabel,
  isIntakeConflictCheckTask,
  isIntakeConferenceTask,
  isIntakeEngagementDocumentTask,
  parseEngagementDocumentFromTask
} from "@/lib/intake-admin-tasks";
import { clientCodeCheckCanProceed, conflictReviewBlocksProceed } from "@/lib/sheets/client-code-check";
import { clientCodeFromCase } from "@/lib/office-tasks/client-matter";

type BillingClient = {
  code: string;
  name: string;
  caseTitle?: string;
  caseNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  assignedAttorney?: string;
};

type Props = {
  item: ItemSummary;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onStatus?: (message: string, isError?: boolean) => void;
};

export function IntakeAdminTaskDialog({ item, open, busy = false, onClose, onComplete, onStatus }: Props) {
  useBodyScrollLock(open);

  const description = item.details?.trim() || "";
  const isConflict = isIntakeConflictCheckTask(description);
  const isConference = isIntakeConferenceTask(description);
  const isEngagement = isIntakeEngagementDocumentTask(description);
  const actionLabel = intakeAdminTaskActionLabel(description) || "Complete task";

  const [conferenceDate, setConferenceDate] = useState("");
  const [conferenceTime, setConferenceTime] = useState("10:00");
  const [conferenceVenue, setConferenceVenue] = useState("Conference room");
  const [conferencePlatform, setConferencePlatform] = useState("");
  const [conferenceBusy, setConferenceBusy] = useState(false);

  const [loadingClient, setLoadingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [client, setClient] = useState<BillingClient | null>(null);
  const [letter, setLetter] = useState<EngagementLetterInput | null>(null);
  const [letterPreviewHtml, setLetterPreviewHtml] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; body: string } | null>(null);
  const [letterBusy, setLetterBusy] = useState(false);

  const clientCase = item.clientCase?.trim() || "";
  const taskCode = clientCase ? clientCodeFromCase(clientCase) : "";

  const conflictInput = useMemo(
    () => ({
      clientCode: client?.code || taskCode,
      clientName: client?.name || "",
      caseTitle: client?.caseTitle || "",
      caseNumber: client?.caseNumber || "",
      clientCaseLabel: client ? "" : clientCase
    }),
    [client, clientCase, taskCode]
  );

  const {
    check,
    checking,
    runCheck,
    conflictReviewChoice,
    setConflictReviewChoice,
    codeBlocked,
    hasWarnings,
    canProceed
  } = useClientCodeCheck(conflictInput);

  useEffect(() => {
    if (!open) return;

    setClientError(null);
    setClient(null);
    setLetter(null);
    setLetterPreviewHtml(null);
    setEmailPreview(null);

    if (!taskCode && !clientCase) {
      setClientError("This task has no client / case label.");
      return;
    }

    let cancelled = false;
    setLoadingClient(true);

    void (async () => {
      try {
        const params = new URLSearchParams();
        if (clientCase) params.set("case", clientCase);
        const res = await fetch(`/api/tasks/client-billing/${encodeURIComponent(taskCode)}?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load client billing record.");
        if (!json.found || !json.client) {
          throw new Error("Billing client not found for this task. Open the matter from billing first.");
        }
        if (cancelled) return;

        const detail = json.client as BillingClient;
        setClient(detail);

        if (isEngagement) {
          const parsed = parseEngagementDocumentFromTask(description);
          if (!parsed) throw new Error("Could not determine document type for this task.");

          const fee = resolveContractAcceptanceFee(detail.caseTitle || "", "");
          const schedule = resolveLitigationFeeSchedule("");
          const nextLetter: EngagementLetterInput = {
            ...defaultEngagementLetterInput({
              clientName: detail.name,
              clientCode: detail.code,
              caseTitle: detail.caseTitle || "",
              clientAddress: detail.address || "",
              caseNumber: detail.caseNumber,
              contactEmail: detail.email,
              handlingAttorney: detail.assignedAttorney
            }),
            documentType: parsed.documentType,
            feeType: parsed.feeType,
            feeAmount:
              parsed.documentType === "contract"
                ? formatLitigationAcceptanceFee(fee.acceptanceFee)
                : "To be confirmed upon signing",
            appearanceFeeAmount:
              parsed.documentType === "contract"
                ? formatLitigationAcceptanceFee(schedule.appearanceFee)
                : ""
          };
          setLetter(nextLetter);

          const previewRes = await fetch("/api/intake/engagement-letter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "preview", letter: nextLetter })
          });
          const previewJson = await previewRes.json();
          if (!previewRes.ok) throw new Error(previewJson.error || "Could not load document preview.");
          if (cancelled) return;
          setLetterPreviewHtml(previewJson.html || null);
          setEmailPreview(previewJson.email ? { subject: previewJson.email.subject, body: previewJson.email.body } : null);
        }
      } catch (error) {
        if (!cancelled) {
          setClientError(error instanceof Error ? error.message : "Could not load client details.");
        }
      } finally {
        if (!cancelled) setLoadingClient(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, taskCode, clientCase, description, isEngagement]);

  async function scheduleInitialConference() {
    if (!client) {
      onStatus?.("Load the client billing record before scheduling.", true);
      return;
    }
    if (!conferenceDate.trim()) {
      onStatus?.("Choose a conference date.", true);
      return;
    }

    setConferenceBusy(true);
    try {
      const label =
        [client.name, client.caseTitle].filter(Boolean).join(" — ") || client.name || client.code;
      const res = await fetch("/api/tasks/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCase: label,
          eventDate: conferenceDate.trim(),
          startTime: conferenceTime.trim() || "10:00",
          category: "Meeting",
          priority: "Medium",
          responsible: client.assignedAttorney || "",
          venue: conferenceVenue.trim() || "Conference room",
          platform: conferencePlatform.trim(),
          details: `Initial client conference — ${client.name}${client.caseTitle ? ` (${client.caseTitle})` : ""}`,
          status: "Scheduled",
          reminderDays: 1,
          calendarSync: true,
          createFollowUpTask: false,
          createReminderTask: false
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not schedule conference.");
      onStatus?.(json.message || "Initial client conference scheduled.");
      onComplete?.();
      onClose();
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not schedule conference.", true);
    } finally {
      setConferenceBusy(false);
    }
  }

  useEffect(() => {
    if (!open || !isConflict || loadingClient || clientError) return;
    void runCheck();
  }, [open, isConflict, loadingClient, clientError, runCheck]);

  const formBusy = busy || letterBusy || loadingClient || checking || conferenceBusy;

  async function downloadLetterPdf() {
    if (!letter) return;
    setLetterBusy(true);
    try {
      const res = await fetch("/api/intake/engagement-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pdf", letter })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "PDF download failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${letter.documentType === "contract" ? "Contract-of-Legal-Services" : "Retainership-Agreement"}-${letter.clientCode}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      onStatus?.("Document PDF downloaded.");
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "PDF download failed.", true);
    } finally {
      setLetterBusy(false);
    }
  }

  async function deliverLetter(action: "send" | "draft") {
    if (!letter) return;
    const recipient = primaryContactEmail(letter.contactEmail || client?.email || "");
    if (!recipient) {
      onStatus?.("Add a client email on the billing profile before sending.", true);
      return;
    }

    setLetterBusy(true);
    try {
      const res = await fetch("/api/intake/engagement-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, letter, recipientEmail: recipient })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not deliver document.");
      onStatus?.(json.message || (action === "draft" ? "Gmail draft saved." : "Document sent."));
      onComplete?.();
      onClose();
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not deliver document.", true);
    } finally {
      setLetterBusy(false);
    }
  }

  function completeConflictCheck() {
    if (codeBlocked) {
      onStatus?.("Resolve the blocking client code conflict before marking this task done.", true);
      return;
    }
    if (hasWarnings && !clientCodeCheckCanProceed(check, conflictReviewChoice)) {
      onStatus?.(
        conflictReviewBlocksProceed(conflictReviewChoice) ||
          "Review the possible conflict and choose same case or different case.",
        true
      );
      return;
    }
    onComplete?.();
    onClose();
  }

  if (!open) return null;

  return (
    <ModalPortal>
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="intake-admin-task-title">
        <div className="modal-panel max-h-[92vh] w-full max-w-2xl overflow-y-auto">
          <h2 id="intake-admin-task-title" className="font-display text-lg font-semibold text-ink">
            {actionLabel}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {clientCase || "—"} · {item.id || "no code"}
          </p>

          {loadingClient ? (
            <p className="mt-4 text-sm text-muted">Loading client details…</p>
          ) : clientError ? (
            <p className="mt-4 text-sm text-red-800">{clientError}</p>
          ) : isEngagement && letter ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted">
                Review the {letter.documentType === "contract" ? "contract of legal services" : "retainership agreement"}{" "}
                for <strong className="text-ink">{letter.clientName}</strong>, then download or email the PDF to the client.
              </p>
              {letter.documentType === "contract" ? (
                <p className="text-[11px] text-muted">
                  Acceptance fee: <strong className="text-ink">{contractAcceptanceFeeSummary(letter.caseTitle, letter.courtPending || "")}</strong>
                </p>
              ) : null}
              {letterPreviewHtml ? (
                <div className="max-h-72 overflow-auto rounded-lg border border-line bg-white p-2">
                  <iframe title="Document preview" className="h-[22rem] w-full border-0" srcDoc={letterPreviewHtml} />
                </div>
              ) : null}
              {emailPreview ? (
                <div className="rounded-md border border-line/70 bg-soft/40 p-3 text-xs">
                  <p className="font-bold text-ink">Email preview</p>
                  <p className="mt-1 text-muted">Subject: {emailPreview.subject}</p>
                  <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
                    {emailPreview.body}
                  </pre>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary !text-xs" disabled={formBusy} onClick={() => void downloadLetterPdf()}>
                  Download PDF
                </button>
                <button
                  type="button"
                  className="btn-primary !text-xs"
                  disabled={formBusy || !primaryContactEmail(letter.contactEmail || client?.email || "")}
                  onClick={() => void deliverLetter("send")}
                >
                  Send email with PDF
                </button>
                <button
                  type="button"
                  className="btn-secondary !text-xs"
                  disabled={formBusy || !primaryContactEmail(letter.contactEmail || client?.email || "")}
                  onClick={() => void deliverLetter("draft")}
                >
                  Save Gmail draft
                </button>
                <button type="button" className="btn-secondary !text-xs" disabled={formBusy} onClick={onComplete ? () => { onComplete(); onClose(); } : onClose}>
                  Mark done without sending
                </button>
              </div>
            </div>
          ) : isConference && client ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted">
                Schedule the initial client conference for <strong className="text-ink">{client.name}</strong>. A
                calendar event will be created; send a schedule confirmation from My Work after saving if needed.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="mb-1 block text-muted">Date</span>
                  <input
                    className="field"
                    type="date"
                    value={conferenceDate}
                    disabled={formBusy}
                    onChange={(e) => setConferenceDate(e.target.value)}
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-muted">Start time</span>
                  <input
                    className="field"
                    type="time"
                    value={conferenceTime}
                    disabled={formBusy}
                    onChange={(e) => setConferenceTime(e.target.value)}
                  />
                </label>
              </div>
              <label className="block text-xs">
                <span className="mb-1 block text-muted">Venue</span>
                <input
                  className="field"
                  value={conferenceVenue}
                  disabled={formBusy}
                  onChange={(e) => setConferenceVenue(e.target.value)}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-muted">Platform (optional)</span>
                <input
                  className="field"
                  value={conferencePlatform}
                  disabled={formBusy}
                  placeholder="Google Meet, Zoom, etc."
                  onChange={(e) => setConferencePlatform(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary !text-xs"
                  disabled={formBusy}
                  onClick={() => void scheduleInitialConference()}
                >
                  Schedule conference
                </button>
                <button
                  type="button"
                  className="btn-secondary !text-xs"
                  disabled={formBusy}
                  onClick={onComplete ? () => { onComplete(); onClose(); } : onClose}
                >
                  Mark done without scheduling
                </button>
              </div>
            </div>
          ) : isConflict ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted">
                Review whether this matter duplicates an existing client or shares a task prefix with another case. Confirm
                same case or different case, then mark the task done.
              </p>
              {!checking && check && !codeBlocked && !hasWarnings ? (
                <ConflictWarningCard
                  variant="clear"
                  eyebrow="Conflict review"
                  title="No blocking conflicts found"
                  subtitle="You can mark this conflict check complete."
                />
              ) : null}
              <ClientCodeWarningPanel
                check={check}
                checking={checking}
                clientCode={client?.code || taskCode}
                clientCaseLabel={clientCase}
                context="intake"
                conflictReviewChoice={conflictReviewChoice}
                onConflictReviewChoiceChange={setConflictReviewChoice}
                onUseExistingCode={() => undefined}
              />
              <button
                type="button"
                className="btn-primary !text-xs"
                disabled={formBusy || (hasWarnings && !canProceed) || codeBlocked}
                onClick={completeConflictCheck}
              >
                Mark conflict check done
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">This task does not have a guided workflow yet.</p>
          )}

          <div className="mt-4 flex justify-end">
            <button type="button" className="btn-secondary !text-xs" disabled={formBusy} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
