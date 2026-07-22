"use client";

import { useEffect, useMemo, useState } from "react";
import type { SoaStatusReportPayload } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import { buildArEmailPreview, buildSoaEmailPreview } from "@/lib/email-preview";
import { whatsAppShareUrl, viberShareUrl, soaShareMessage } from "@/lib/messenger-share";
import { resolveClientGreeting } from "@/lib/client-greeting";
import { parseApiJson } from "@/lib/parse-api-response";
import { FirmPrintLetterhead } from "@/components/FirmPrintLetterhead";
import { ReceiptCeremony, parseReceiptNumberFromMessage } from "@/components/ReceiptCeremony";
import { PaymentIncomeFields } from "@/components/PaymentIncomeFields";
import {
  buildPaymentLedgerFields,
  inferPaymentIncomeTypeFromPayment,
  inferPaymentIncomeTypeFromText,
  isGenericPaymentLabel,
  type PaymentIncomeType
} from "@/lib/payment-income";
import type { SoaDuplicateCheck } from "@/lib/soa-follow-up";
import type { AppearanceFeeOption, LedgerPaymentOption } from "@/lib/sheets/ledger-read";

type DeliveryAction = "Send Now" | "Create Gmail Draft";

type Props = {
  clientCode: string;
  clientName: string;
  caseTitle: string;
  clientEmail: string;
  clientBalance: number;
  preferredGreeting?: string;
  paymentMethods: string[];
  initialDocTab?: "soa" | "ar";
  onBusy: (busy: boolean) => void;
  onStatus: (message: string, isError?: boolean) => void;
};

export function DocumentsPanel({
  clientCode,
  clientName,
  caseTitle,
  clientEmail,
  clientBalance,
  preferredGreeting = "",
  paymentMethods,
  initialDocTab = "soa",
  onBusy,
  onStatus
}: Props) {
  const [docTab, setDocTab] = useState<"soa" | "ar">(initialDocTab);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [appearanceFees, setAppearanceFees] = useState<AppearanceFeeOption[]>([]);
  const [includeStatusReport, setIncludeStatusReport] = useState(false);
  const [selectedAppearance, setSelectedAppearance] = useState<number | "">("");
  const [statusReport, setStatusReport] = useState<SoaStatusReportPayload>({
    caseTitle: "",
    hearingDate: "",
    hearingTime: "",
    incident: "",
    handlingLawyer: "",
    summary: ""
  });

  const [payments, setPayments] = useState<LedgerPaymentOption[]>([]);
  const [selectedPaymentRow, setSelectedPaymentRow] = useState<number | "">("");
  const [arMethod, setArMethod] = useState("Cash");
  const [arDetails, setArDetails] = useState("");
  const [arDescription, setArDescription] = useState("");
  const [arIncomeType, setArIncomeType] = useState<PaymentIncomeType>("Professional Fee");
  const [arNote, setArNote] = useState("");
  const [pendingOnly, setPendingOnly] = useState(true);
  const [greeting, setGreeting] = useState(preferredGreeting);
  const [soaCheck, setSoaCheck] = useState<SoaDuplicateCheck | null>(null);
  const [arCeremony, setArCeremony] = useState<{ receiptNumber: string; amount: number } | null>(null);
    
  useEffect(() => {
    setGreeting(preferredGreeting);
  }, [preferredGreeting]);

  useEffect(() => {
    if (!clientCode) {
      setSoaCheck(null);
      return;
    }
    void fetch(`/api/clients/${encodeURIComponent(clientCode)}/soa-check`)
      .then((r) => parseApiJson<SoaDuplicateCheck & { error?: string }>(r))
      .then(({ ok, data }) => {
        if (ok) setSoaCheck(data);
        else setSoaCheck(null);
      })
      .catch(() => setSoaCheck(null));
  }, [clientCode, clientBalance]);

  useEffect(() => {
    if (!clientCode) return;
    void fetch(`/api/clients/${encodeURIComponent(clientCode)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.client) {
          setGreeting(resolveClientGreeting(d.client.preferredGreeting, d.client.name));
        }
      })
      .catch(() => undefined);
  }, [clientCode]);

  useEffect(() => {
    setDocTab(initialDocTab);
  }, [initialDocTab, clientCode]);

  useEffect(() => {
    setReviewOpen(false);
    setArCeremony(null);
  }, [clientCode, docTab]);

  useEffect(() => {
    if (!clientCode) return;
    setStatusReport((s) => ({ ...s, caseTitle: caseTitle || clientName }));

    void fetch(`/api/clients/${encodeURIComponent(clientCode)}/appearance-fees`)
      .then((r) => r.json())
      .then((d) => setAppearanceFees(d.appearanceFees || []))
      .catch(() => setAppearanceFees([]));
  }, [clientCode, caseTitle, clientName]);

  useEffect(() => {
    if (!clientCode) return;
    const url = `/api/clients/${encodeURIComponent(clientCode)}/payments?pending=${pendingOnly ? "1" : "0"}`;
    void fetch(url)
      .then((r) => r.json())
      .then((d) => setPayments(d.payments || []))
      .catch(() => setPayments([]));
  }, [clientCode, pendingOnly]);

  useEffect(() => {
    if (!selectedPaymentRow) return;
    const p = payments.find((x) => x.sheetRow === selectedPaymentRow);
    if (!p) return;
    setArMethod(p.method || paymentMethods[0] || "Cash");
    setArDetails(p.details);
    setArDescription(p.description);
    setArIncomeType(inferPaymentIncomeTypeFromPayment(p.category, p.description));
  }, [selectedPaymentRow, payments, paymentMethods]);

  useEffect(() => {
    if (docTab !== "ar" || !selectedPaymentRow) return;
    const p = payments.find((x) => x.sheetRow === selectedPaymentRow);
    setArIncomeType(() => {
      if (p && !isGenericPaymentLabel(p.category, p.description)) {
        return inferPaymentIncomeTypeFromPayment(p.category, p.description);
      }
      return inferPaymentIncomeTypeFromText(arDescription, arDetails, p?.description);
    });
  }, [arDescription, arDetails, docTab, selectedPaymentRow, payments]);

  function applyAppearanceFee(row: number) {
    const fee = appearanceFees.find((f) => f.sheetRow === row);
    if (!fee) return;
    setStatusReport((s) => ({
      ...s,
      hearingDate: fee.date,
      incident: fee.description || fee.category
    }));
  }

  function validateSoa(): SoaStatusReportPayload | null | false {
    if (!clientCode) {
      onStatus("Choose a client first.", true);
      return false;
    }
    if (includeStatusReport) {
      if (!statusReport.hearingDate.trim() || !statusReport.summary.trim()) {
        onStatus("Complete status report fields or disable status report.", true);
        return false;
      }
      return statusReport;
    }
    return null;
  }

  function validateAr(): boolean {
    if (!clientCode || !selectedPaymentRow) {
      onStatus("Select a payment to receipt.", true);
      return false;
    }
    return true;
  }

  function openSoaReview() {
    const report = validateSoa();
    if (report === false) return;
    void report;
    setReviewOpen(true);
  }

  function openArReview() {
    if (!validateAr()) return;
    setReviewOpen(true);
  }

  function confirmDuplicateSoa(): boolean {
    if (!soaCheck?.shouldWarnDuplicate) return true;
    return window.confirm(
      `${soaCheck.warningMessage || "A SOA was already issued for this same balance."}\n\nSend another SOA anyway?`
    );
  }

  async function submitSOA(deliveryAction: DeliveryAction) {
    const report = validateSoa();
    if (report === false) return;
    if (!confirmDuplicateSoa()) return;

    setReviewOpen(false);
    setSubmitting(true);
    onBusy(true);
    onStatus(
      deliveryAction === "Send Now"
        ? "Generating SOA and sending email..."
        : "Generating SOA and saving Gmail draft..."
    );

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generateSOAHeadless",
          clientCode,
          statusReport: report,
          preferredGreeting: greeting,
          deliveryAction
        })
      });
      const { ok, data: result, errorMessage } = await parseApiJson<{
        message?: string;
        error?: string;
      }>(response);
      if (!ok) throw new Error(errorMessage || "SOA failed.");
      onStatus(result.message || "SOA completed.");
      void fetch(`/api/clients/${encodeURIComponent(clientCode)}/soa-check`)
        .then((r) => parseApiJson<SoaDuplicateCheck>(r))
        .then(({ ok: checkOk, data }) => {
          if (checkOk) setSoaCheck(data);
        })
        .catch(() => undefined);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "SOA failed.", true);
    } finally {
      setSubmitting(false);
      onBusy(false);
    }
  }

  async function submitAR(deliveryAction: DeliveryAction) {
    if (!validateAr()) return;

    setReviewOpen(false);
    setSubmitting(true);
    onBusy(true);
    onStatus(
      deliveryAction === "Send Now"
        ? "Generating receipt and sending email..."
        : "Generating receipt and saving Gmail draft..."
    );

    try {
      const paymentFields = buildPaymentLedgerFields(arIncomeType, arDescription);
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generateARHeadless",
          clientCode,
          sheetRow: selectedPaymentRow,
          method: arMethod,
          details: arDetails,
          description: paymentFields.description,
          extraNote: arNote,
          preferredGreeting: greeting,
          deliveryAction
        })
      });
      const { ok, data: result, errorMessage } = await parseApiJson<{
        message?: string;
        error?: string;
        receiptNumber?: string;
      }>(response);
      if (!ok) throw new Error(errorMessage || "AR failed.");
      const amount = selectedPayment?.amount || 0;

      if (
        selectedPayment &&
        isGenericPaymentLabel(selectedPayment.category, selectedPayment.description)
      ) {
        await fetch("/api/ledger", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientCode,
            sheetRow: selectedPaymentRow,
            category: paymentFields.category,
            description: paymentFields.description,
            reclassifyIncome: true
          })
        }).catch(() => undefined);
      }

      setArCeremony({
        receiptNumber: parseReceiptNumberFromMessage(
          result.receiptNumber || result.message || "",
          "Receipt issued"
        ),
        amount
      });
      onStatus(result.message || "Receipt completed.");
      setSelectedPaymentRow("");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "AR failed.", true);
    } finally {
      setSubmitting(false);
      onBusy(false);
    }
  }

  const selectedPayment = payments.find((p) => p.sheetRow === selectedPaymentRow);

  const emailPreview = useMemo(() => {
    if (docTab === "soa") {
      return buildSoaEmailPreview({
        clientCode,
        preferredGreeting: greeting,
        clientName,
        totalDue: clientBalance,
        includeStatusReport,
        statusReport: includeStatusReport ? statusReport : null
      });
    }
    if (!selectedPayment) return null;
    const paymentFields = buildPaymentLedgerFields(arIncomeType, arDescription);
    return buildArEmailPreview({
      clientCode,
      preferredGreeting: greeting,
      clientName,
      paymentDate: selectedPayment.date,
      amount: selectedPayment.amount,
      method: arMethod,
      details: arDetails,
      paymentFor: paymentFields.description,
      balance: selectedPayment.balance,
      extraNote: arNote
    });
  }, [
    docTab,
    clientCode,
    greeting,
    clientName,
    clientBalance,
    includeStatusReport,
    statusReport,
    selectedPayment,
    arMethod,
    arDetails,
    arIncomeType,
    arDescription,
    arNote
  ]);

  if (arCeremony) {
    return (
      <ReceiptCeremony
        receiptNumber={arCeremony.receiptNumber}
        amount={arCeremony.amount}
        onDismiss={() => setArCeremony(null)}
      />
    );
  }

  if (reviewOpen) {
    return (
      <div className="relative z-10 space-y-3">
        <section className="card document-review-card p-4">
          <p className="mb-3 text-sm font-extrabold text-ink">
            Review before {docTab === "soa" ? "sending SOA" : "sending receipt"}
          </p>

          <div className="document-review-letterhead mb-4 overflow-hidden rounded-xl border border-line/70 bg-white">
            <FirmPrintLetterhead
              documentType={docTab === "soa" ? "Statement of account" : "Acknowledgment receipt"}
              documentTitle={clientName}
              documentSubtitle={`${clientCode}${caseTitle ? ` · ${caseTitle}` : ""}`}
            />
          </div>

          <dl className="space-y-2 text-xs">
            <ReviewRow label="Client" value={`${clientCode} — ${clientName}`} />
            <ReviewRow label="Case" value={caseTitle || "—"} />
            <ReviewRow
              label="Email to"
              value={clientEmail || "(uses firm email from Settings)"}
            />
            {docTab === "soa" && (
              <>
                <ReviewRow label="Total due" value={formatPeso(clientBalance)} />
                {soaCheck?.shouldWarnDuplicate ? (
                  <div className="rounded-md border border-amber-300/80 bg-amber-50/90 p-2 text-[11px] leading-relaxed text-amber-950">
                    <strong className="block text-xs">Duplicate SOA warning</strong>
                    {soaCheck.warningMessage}
                  </div>
                ) : soaCheck?.infoMessage ? (
                  <div className="rounded-md border border-line/80 bg-[#faf8f4] p-2 text-[11px] leading-relaxed text-muted">
                    {soaCheck.infoMessage}
                  </div>
                ) : null}
                <ReviewRow
                  label="Status report"
                  value={includeStatusReport ? "Included in email" : "Not included"}
                />
                {includeStatusReport && (
                  <div className="mt-2 rounded-md border border-line/80 bg-white p-2 text-[11px] leading-relaxed text-muted">
                    <strong className="text-ink">Hearing:</strong> {statusReport.hearingDate}{" "}
                    {statusReport.hearingTime && `at ${statusReport.hearingTime}`}
                    <br />
                    <strong className="text-ink">Lawyer:</strong> {statusReport.handlingLawyer || "—"}
                    <br />
                    <strong className="text-ink">Summary:</strong> {statusReport.summary}
                  </div>
                )}
              </>
            )}
            {docTab === "ar" && selectedPayment && (
              <>
                <ReviewRow label="Payment" value={selectedPayment.display} />
                <ReviewRow label="Method" value={arMethod} />
                <ReviewRow label="For" value={arDescription || "Payment Received"} />
              </>
            )}
          </dl>

          {emailPreview && (
            <div className="mt-4 rounded-lg border border-gold/30 bg-[#fffef9] p-3">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-gold-dark">
                Email preview
              </p>
              <p className="text-xs font-bold text-ink">Subject: {emailPreview.subject}</p>
              <div
                className="mt-2 max-h-72 overflow-auto rounded-md border border-line/60 bg-white p-3 text-[11px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: emailPreview.html }}
              />
            </div>
          )}

          <p className="mt-4 text-[11px] text-muted">
            PDF is saved to your HA Billing Drive folder. Choose how to deliver the email:
          </p>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void (docTab === "soa" ? submitSOA("Send Now") : submitAR("Send Now"))}
            className="btn-primary mt-3"
          >
            {submitting ? "Working..." : "Send email now"}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              void (docTab === "soa" ? submitSOA("Create Gmail Draft") : submitAR("Create Gmail Draft"))
            }
            className="letterhead-action-btn mt-2 w-full disabled:opacity-50"
          >
            Save as Gmail draft instead
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => setReviewOpen(false)}
            className="mt-2 w-full min-h-[36px] text-xs font-bold text-muted underline"
          >
            ← Back to edit
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-line/90 bg-white/80 p-3 text-xs text-muted shadow-sm">
        Client: <strong className="text-ink">{clientCode || "—"}</strong>
        {clientName ? ` · ${clientName}` : ""}
        {clientEmail ? (
          <>
            <br />
            Email: <strong className="text-ink">{clientEmail}</strong>
          </>
        ) : null}
      </section>

      <div className="nav-tabs matter-doc-tabs mb-0 !grid-cols-2">
        <button
          type="button"
          className={`nav-tab ${docTab === "soa" ? "nav-tab-active" : "nav-tab-idle"}`}
          onClick={() => setDocTab("soa")}
          disabled={submitting}
        >
          SOA
        </button>
        <button
          type="button"
          className={`nav-tab ${docTab === "ar" ? "nav-tab-active" : "nav-tab-idle"}`}
          onClick={() => setDocTab("ar")}
          disabled={submitting}
        >
          Receipt
        </button>
      </div>

      {docTab === "soa" ? (
        <section className="rounded-lg border border-line/90 bg-white/80 p-3 shadow-sm">
          {soaCheck?.infoMessage ? (
            <p className="mb-3 rounded-md border border-line/70 bg-[#faf8f4] px-2.5 py-2 text-[11px] leading-relaxed text-muted">
              {soaCheck.infoMessage}
              {soaCheck.shouldWarnDuplicate
                ? " Sending again will show a confirmation because the balance has not changed."
                : soaCheck.hasPriorSoa
                  ? " The balance changed since the last SOA — this will be treated as a new statement."
                  : null}
            </p>
          ) : null}
          <label className="flex items-center gap-2 text-xs font-bold text-[#4a4339]">
            <input
              type="checkbox"
              checked={includeStatusReport}
              onChange={(e) => setIncludeStatusReport(e.target.checked)}
              disabled={submitting || appearanceFees.length === 0}
            />
            Include appearance / hearing status report
          </label>
          {appearanceFees.length === 0 && (
            <p className="mt-2 text-[11px] text-muted">No appearance fee charges found for this client.</p>
          )}

          {includeStatusReport && appearanceFees.length > 0 && (
            <>
              <Field label="Link to appearance fee charge">
                <select
                  className="field"
                  value={selectedAppearance}
                  disabled={submitting}
                  onChange={(e) => {
                    const row = Number(e.target.value);
                    setSelectedAppearance(row);
                    applyAppearanceFee(row);
                  }}
                >
                  <option value="">Select charge...</option>
                  {appearanceFees.map((f) => (
                    <option key={f.sheetRow} value={f.sheetRow}>
                      {f.display}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Case title">
                <input className="field" value={statusReport.caseTitle} disabled={submitting} onChange={(e) => setStatusReport({ ...statusReport, caseTitle: e.target.value })} />
              </Field>
              <Field label="Hearing / appearance date">
                <input className="field" value={statusReport.hearingDate} disabled={submitting} onChange={(e) => setStatusReport({ ...statusReport, hearingDate: e.target.value })} />
              </Field>
              <Field label="Time">
                <input className="field" value={statusReport.hearingTime} disabled={submitting} onChange={(e) => setStatusReport({ ...statusReport, hearingTime: e.target.value })} />
              </Field>
              <Field label="Incident / purpose">
                <input className="field" value={statusReport.incident} disabled={submitting} onChange={(e) => setStatusReport({ ...statusReport, incident: e.target.value })} />
              </Field>
              <Field label="Handling lawyer">
                <input className="field" value={statusReport.handlingLawyer} disabled={submitting} onChange={(e) => setStatusReport({ ...statusReport, handlingLawyer: e.target.value })} />
              </Field>
              <Field label="Summary">
                <textarea className="field min-h-[80px]" value={statusReport.summary} disabled={submitting} onChange={(e) => setStatusReport({ ...statusReport, summary: e.target.value })} />
              </Field>
            </>
          )}

          <button type="button" disabled={submitting || !clientCode} onClick={openSoaReview} className="btn-primary mt-3">
            Review SOA →
          </button>
          {docTab === "soa" && clientCode ? (
            <div className="messenger-share-row mt-3">
              <p className="messenger-share-row__label">Share balance via messenger</p>
              <div className="messenger-share-row__actions">
                <a
                  className="messenger-share-btn messenger-share-btn--wa"
                  href={whatsAppShareUrl(
                    soaShareMessage({
                      clientName: clientName || clientCode,
                      clientCode,
                      balanceLabel: formatPeso(clientBalance)
                    })
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
                <a
                  className="messenger-share-btn messenger-share-btn--viber"
                  href={viberShareUrl(
                    soaShareMessage({
                      clientName: clientName || clientCode,
                      clientCode,
                      balanceLabel: formatPeso(clientBalance)
                    })
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Viber
                </a>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-lg border border-line/90 bg-white/80 p-3 shadow-sm">
          <label className="mb-2 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} disabled={submitting} />
            Show only payments without AR
          </label>

          <Field label="Select payment">
            <select
              className="field"
              value={selectedPaymentRow}
              disabled={submitting}
              onChange={(e) => setSelectedPaymentRow(Number(e.target.value))}
            >
              <option value="">Choose payment...</option>
              {payments.map((p) => (
                <option key={p.sheetRow} value={p.sheetRow}>
                  {p.display}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Payment method">
            <select className="field" value={arMethod} disabled={submitting} onChange={(e) => setArMethod(e.target.value)}>
              {paymentMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment details / reference">
            <input className="field" value={arDetails} disabled={submitting} onChange={(e) => setArDetails(e.target.value)} />
          </Field>
          <div className="mt-2.5">
            <PaymentIncomeFields
              incomeType={arIncomeType}
              onIncomeTypeChange={setArIncomeType}
              description={arDescription}
              onDescriptionChange={setArDescription}
              disabled={submitting}
              hint={
                selectedPayment && isGenericPaymentLabel(selectedPayment.category, selectedPayment.description)
                  ? "Receipt will label this payment for Firm finances"
                  : undefined
              }
            />
          </div>
          <Field label="Email note (optional)">
            <textarea className="field min-h-[60px]" value={arNote} disabled={submitting} onChange={(e) => setArNote(e.target.value)} />
          </Field>

          <button type="button" disabled={submitting || !clientCode} onClick={openArReview} className="btn-primary mt-3">
            Review receipt →
          </button>
        </section>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#4a4339] sm:w-24 sm:text-xs sm:normal-case sm:tracking-normal">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-ink">{value}</dd>
    </div>
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
