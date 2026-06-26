"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { FirmPageSize } from "@/lib/firm-page-sizes";
import {
  buildCorrespondenceEmailPreview,
  buildCorrespondenceLetterHtml,
  CORRESPONDENCE_KIND_LABELS,
  defaultBodyForKind,
  defaultCorrespondenceLetterInput,
  defaultSubjectForKind,
  type CorrespondenceKind,
  type CorrespondenceLetterInput
} from "@/lib/firm-correspondence-preview";
import {
  applyCorrespondenceMergeFields,
  CORRESPONDENCE_MERGE_FIELDS,
  type CorrespondenceMergeContext
} from "@/lib/correspondence-merge-fields";
import { fetchJson } from "@/lib/fetch-json";
import { plainTextToEditorHtml } from "@/lib/rich-text";
import { matterHref } from "@/lib/matter-routes";
import { SameWindowLink } from "@/components/SameWindowLink";
import { RichTextEditor } from "@/components/RichTextEditor";

type Props = {
  clientCode?: string;
  clientName?: string;
  clientAddress?: string;
  clientEmail?: string;
  caseTitle?: string;
  assignedAttorney?: string;
  balance?: number;
  lastSoaDate?: string;
  lastBillingDate?: string;
  busy?: boolean;
  onBusy?: (busy: boolean) => void;
  onStatus?: (message: string, isError?: boolean) => void;
};

function todayLocal(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function CorrespondenceDraftPanel({
  clientCode = "",
  clientName = "",
  clientAddress = "",
  clientEmail = "",
  caseTitle = "",
  assignedAttorney = "",
  balance,
  lastSoaDate = "",
  lastBillingDate = "",
  busy = false,
  onBusy,
  onStatus
}: Props) {
  const matterReference = useMemo(() => caseTitle.trim() || clientCode.trim(), [caseTitle, clientCode]);

  const [letter, setLetter] = useState<CorrespondenceLetterInput>(() =>
    defaultCorrespondenceLetterInput({
      recipientName: clientName,
      recipientAddress: clientAddress,
      recipientEmail: clientEmail,
      matterReference,
      clientCode,
      signatoryName: assignedAttorney
    })
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [lastDeliveredCode, setLastDeliveredCode] = useState("");
  const bodyEditorId = useId();

  const mergeContext = useMemo<CorrespondenceMergeContext>(
    () => ({
      clientName: letter.recipientName || clientName,
      clientCode: letter.clientCode || clientCode,
      caseTitle: letter.matterReference || caseTitle,
      balance,
      lastSoaDate,
      lastBillingDate,
      assignedAttorney: letter.signatoryName || assignedAttorney,
      letterDate: letter.letterDate
    }),
    [
      assignedAttorney,
      balance,
      caseTitle,
      clientCode,
      clientName,
      lastBillingDate,
      lastSoaDate,
      letter.clientCode,
      letter.letterDate,
      letter.matterReference,
      letter.recipientName,
      letter.signatoryName
    ]
  );

  const resolvedLetter = useMemo(
    () => applyCorrespondenceMergeFields(letter, mergeContext),
    [letter, mergeContext]
  );

  const previewHtml = useMemo(() => buildCorrespondenceLetterHtml(resolvedLetter), [resolvedLetter]);
  const emailPreview = useMemo(() => {
    const email = buildCorrespondenceEmailPreview(resolvedLetter);
    return { subject: email.subject, body: email.body };
  }, [resolvedLetter]);

  const setBusy = useCallback(
    (next: boolean) => {
      setActionBusy(next);
      onBusy?.(next);
    },
    [onBusy]
  );

  useEffect(() => {
    setLetter((current) => ({
      ...current,
      recipientName: clientName || current.recipientName,
      recipientAddress: clientAddress || current.recipientAddress,
      recipientEmail: clientEmail || current.recipientEmail,
      clientCode: clientCode || current.clientCode,
      matterReference: matterReference || current.matterReference,
      signatoryName: assignedAttorney || current.signatoryName
    }));
  }, [clientName, clientAddress, clientEmail, clientCode, matterReference, assignedAttorney]);

  const updateLetter = useCallback((patch: Partial<CorrespondenceLetterInput>) => {
    setLetter((current) => ({ ...current, ...patch }));
  }, []);

  const insertMergeField = useCallback(
    (token: string) => {
      updateLetter({ body: `${letter.body}${letter.body ? " " : ""}${token}` });
    },
    [letter.body, updateLetter]
  );

  const applyKindTemplate = useCallback(
    (kind: CorrespondenceKind) => {
      const matter = matterReference || letter.matterReference || letter.clientCode;
      const body = defaultBodyForKind(kind, matter);
      updateLetter({
        kind,
        subjectLine: defaultSubjectForKind(kind, matter),
        body: body ? plainTextToEditorHtml(body) : "",
        documentTitle: kind === "other" ? "" : letter.documentTitle
      });
    },
    [letter.clientCode, letter.documentTitle, letter.matterReference, matterReference, updateLetter]
  );

  async function downloadPdf() {
    setBusy(true);
    try {
      const response = await fetch("/api/correspondence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pdf", letter: resolvedLetter })
      });
      if (!response.ok) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error || "Could not generate PDF.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || "Letter.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      onStatus?.(`Downloaded ${filename}.`);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "PDF download failed.", true);
    } finally {
      setBusy(false);
    }
  }

  async function deliver(action: "send" | "draft") {
    const recipient = letter.recipientEmail?.trim();
    if (!recipient) {
      onStatus?.("Enter a recipient email before sending.", true);
      return;
    }

    setBusy(true);
    try {
      const { ok, data } = await fetchJson<{ ok?: boolean; message?: string; error?: string }>("/api/correspondence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          letter: resolvedLetter,
          recipientEmail: recipient
        })
      });
      if (!ok) throw new Error(data.error || "Delivery failed.");
      onStatus?.(data.message || (action === "draft" ? "Gmail draft saved." : "Letter sent."));
      const code = letter.clientCode?.trim().toUpperCase();
      if (code) setLastDeliveredCode(code);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Delivery failed.", true);
    } finally {
      setBusy(false);
    }
  }

  const inputsDisabled = actionBusy;
  const actionsDisabled = actionBusy || busy;
  const canSend = Boolean(letter.recipientEmail?.trim());

  return (
    <div className="space-y-3">
      <section className="card space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Letter type</span>
            <select
              className="field"
              value={letter.kind}
              disabled={inputsDisabled}
              onChange={(event) => applyKindTemplate(event.target.value as CorrespondenceKind)}
            >
              {(Object.keys(CORRESPONDENCE_KIND_LABELS) as CorrespondenceKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {CORRESPONDENCE_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Paper size</span>
            <select
              className="field"
              value={letter.pageSize || "legal"}
              disabled={inputsDisabled}
              onChange={(event) => updateLetter({ pageSize: event.target.value as FirmPageSize })}
            >
              <option value="legal">Legal (8.5 × 13 in)</option>
              <option value="letter">Letter (8.5 × 11 in)</option>
              <option value="a4">A4</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Letter date</span>
            <input
              type="date"
              className="field"
              value={letter.letterDate || todayLocal()}
              disabled={inputsDisabled}
              onChange={(event) => updateLetter({ letterDate: event.target.value })}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Matter reference</span>
            <input
              className="field"
              value={letter.matterReference || ""}
              disabled={inputsDisabled}
              placeholder={caseTitle || "Case title or internal reference"}
              onChange={(event) => updateLetter({ matterReference: event.target.value })}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Recipient name</span>
            <input
              className="field"
              value={letter.recipientName}
              disabled={inputsDisabled}
              onChange={(event) => updateLetter({ recipientName: event.target.value })}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Recipient email</span>
            <input
              type="email"
              className="field"
              value={letter.recipientEmail || ""}
              disabled={inputsDisabled}
              placeholder="For Gmail send / draft"
              onChange={(event) => updateLetter({ recipientEmail: event.target.value })}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Recipient address</span>
          <textarea
            className="field min-h-[72px]"
            value={letter.recipientAddress}
            disabled={inputsDisabled}
            onChange={(event) => updateLetter({ recipientAddress: event.target.value })}
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Re / subject line</span>
            <input
              className="field"
              value={letter.subjectLine || ""}
              disabled={inputsDisabled}
              onChange={(event) => updateLetter({ subjectLine: event.target.value })}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Document title (optional)</span>
            <input
              className="field"
              value={letter.documentTitle || ""}
              disabled={inputsDisabled}
              placeholder={CORRESPONDENCE_KIND_LABELS[letter.kind]}
              onChange={(event) => updateLetter({ documentTitle: event.target.value })}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Salutation (optional)</span>
          <input
            className="field"
            value={letter.salutation || ""}
            disabled={inputsDisabled}
            placeholder="Dear Sir/Ma'am [name]"
            onChange={(event) => updateLetter({ salutation: event.target.value })}
          />
        </label>

        <div className="block">
          <label htmlFor={bodyEditorId} className="mb-1.5 block text-xs font-bold text-[#4a4339]">
            Body
          </label>
          <RichTextEditor
            id={bodyEditorId}
            value={letter.body}
            disabled={inputsDisabled}
            placeholder="Write the letter body…"
            onChange={(body) => updateLetter({ body })}
          />
          <p className="mt-1 text-[11px] text-muted">
            Use the toolbar for font size, style, color, alignment, bullets, and numbering. Smart fields fill in from
            the selected client when you preview or send.
          </p>
          <div className="correspondence-merge-fields mt-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gold-dark">Insert smart field</p>
            <div className="flex flex-wrap gap-1.5">
              {CORRESPONDENCE_MERGE_FIELDS.map((field) => (
                <button
                  key={field.token}
                  type="button"
                  className="correspondence-merge-fields__chip"
                  disabled={inputsDisabled}
                  title={field.description}
                  onClick={() => insertMergeField(field.token)}
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Closing</span>
            <input
              className="field"
              value={letter.closing || ""}
              disabled={inputsDisabled}
              placeholder="Very truly yours,"
              onChange={(event) => updateLetter({ closing: event.target.value })}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Signatory</span>
            <input
              className="field"
              value={letter.signatoryName}
              disabled={inputsDisabled}
              onChange={(event) => updateLetter({ signatoryName: event.target.value })}
            />
          </label>
        </div>

        <label className="block md:max-w-md">
          <span className="mb-1.5 block text-xs font-bold text-[#4a4339]">Signatory title</span>
          <input
            className="field"
            value={letter.signatoryTitle || ""}
            disabled={inputsDisabled}
            placeholder="Attorney-at-Law"
            onChange={(event) => updateLetter({ signatoryTitle: event.target.value })}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={actionsDisabled}
            onClick={() => applyKindTemplate(letter.kind)}
          >
            Reload starter text
          </button>
        </div>
      </section>

      <section className="card">
          <p className="mb-2 text-xs font-bold text-ink">Letter preview</p>
          <p className="mb-2 text-[11px] text-muted">
            Shows the full letter (date, recipient, Re line, salutation, body, closing, and signature). The Body
            editor above is only the main paragraphs — smart fields like {"{{balance}}"} fill in here and in the PDF.
          </p>
          <div className="max-h-[32rem] overflow-auto rounded-lg border border-line bg-white p-2">
            <iframe
              title="Correspondence preview"
              className="h-[28rem] w-full border-0"
              tabIndex={-1}
              srcDoc={previewHtml}
            />
          </div>
        </section>

      <section className="card">
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-gold-dark">Email preview</p>
          <p className="mt-2 text-xs font-bold text-ink">Subject: {emailPreview.subject}</p>
          <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md border border-line/60 bg-white p-2 text-[11px] leading-relaxed text-muted">
            {emailPreview.body}
          </pre>
          <p className="mt-2 text-[11px] text-muted">The PDF will be attached to this email.</p>
        </section>

      <section className="card space-y-2">
        <button type="button" className="btn-secondary w-full" disabled={actionsDisabled} onClick={() => void downloadPdf()}>
          Download PDF
        </button>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={actionsDisabled || !canSend}
          onClick={() => void deliver("send")}
        >
          Send email with PDF
        </button>
        <button
          type="button"
          className="w-full min-h-[42px] rounded-md border border-line bg-gradient-to-b from-white to-[#f4f1eb] text-xs font-extrabold text-ink disabled:opacity-50"
          disabled={actionsDisabled || !canSend}
          onClick={() => void deliver("draft")}
        >
          Save as Gmail draft instead
        </button>
        {lastDeliveredCode ? (
          <SameWindowLink href={matterHref(lastDeliveredCode)} className="correspondence-matter-link">
            Open matter {lastDeliveredCode} →
          </SameWindowLink>
        ) : letter.clientCode?.trim() ? (
          <SameWindowLink href={matterHref(letter.clientCode.trim())} className="correspondence-matter-link">
            Open matter {letter.clientCode.trim().toUpperCase()} →
          </SameWindowLink>
        ) : null}
      </section>
    </div>
  );
}
