"use client";

import { useCallback, useEffect, useState } from "react";
import { notifyBirthdaysRefresh } from "@/components/TodayBirthdaysProvider";
import { birthdayGreetingSentYear } from "@/lib/birthday-greeting";
import { parseApiJson } from "@/lib/parse-api-response";

type Props = {
  open: boolean;
  onClose: () => void;
  clientCode: string;
  clientName: string;
  clientEmail?: string;
  birthdayGreetingSent?: string;
  isAdmin?: boolean;
  busy?: boolean;
  onBusy?: (busy: boolean) => void;
  onSent?: () => void;
  onStatus?: (msg: string, isError?: boolean) => void;
};

export function BirthdayGreetingDialog({
  open,
  onClose,
  clientCode,
  clientName,
  clientEmail,
  birthdayGreetingSent,
  isAdmin: isAdminProp,
  busy = false,
  onBusy,
  onSent,
  onStatus
}: Props) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [isAdmin, setIsAdmin] = useState(Boolean(isAdminProp));

  useEffect(() => {
    if (isAdminProp !== undefined) {
      setIsAdmin(isAdminProp);
      return;
    }
    void fetch("/api/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.isAdmin) setIsAdmin(true);
      })
      .catch(() => {
        /* optional */
      });
  }, [isAdminProp]);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(clientCode)}/birthday-greeting`, {
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
      setPreviewSubject(String(result.subject || ""));
      setPreviewHtml(String(result.html || ""));
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not load greeting preview.", true);
    } finally {
      setPreviewLoading(false);
    }
  }, [clientCode, onStatus]);

  useEffect(() => {
    if (!open) return;
    void loadPreview();
  }, [open, loadPreview]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function sendGreeting(force = false) {
    onBusy?.(true);
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(clientCode)}/birthday-greeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", force })
      });
      const { ok, data: result, errorMessage } = await parseApiJson<{
        message?: string;
        error?: string;
      }>(response);
      if (!ok) throw new Error(errorMessage || "Could not send birthday greeting.");
      onStatus?.(result.message || "Birthday greeting sent.");
      notifyBirthdaysRefresh();
      onSent?.();
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not send birthday greeting.", true);
    } finally {
      onBusy?.(false);
    }
  }

  if (!open) return null;

  const sentThisYear =
    Boolean(birthdayGreetingSent) &&
    birthdayGreetingSentYear(birthdayGreetingSent) === new Date().getFullYear();
  const canSend = Boolean(clientEmail?.trim());
  const actionBusy = busy || previewLoading;

  return (
    <div
      className="birthday-greeting-dialog-backdrop no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="birthday-greeting-dialog-title"
      onClick={onClose}
    >
      <div className="birthday-greeting-dialog card" onClick={(event) => event.stopPropagation()}>
        <div className="birthday-greeting-dialog__head">
          <div>
            <p className="birthday-greeting-dialog__eyebrow">Happy birthday</p>
            <h2 id="birthday-greeting-dialog-title" className="birthday-greeting-dialog__title">
              {clientName}
            </h2>
            <p className="birthday-greeting-dialog__subtitle">
              Warm wishes from Hernandez &amp; Associates Law Office
              {sentThisYear ? (
                <span className="birthday-greeting-dialog__sent-badge">Greeting sent this year</span>
              ) : null}
            </p>
          </div>
          <button type="button" className="birthday-greeting-dialog__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="birthday-greeting-dialog__preview matter-birthday-greeting__preview">
          <p className="matter-birthday-greeting__preview-label">Email preview</p>
          {previewLoading ? (
            <p className="text-sm text-muted">Loading preview…</p>
          ) : (
            <>
              {previewSubject ? (
                <p className="matter-birthday-greeting__preview-subject">
                  <span>Subject</span> {previewSubject}
                </p>
              ) : null}
              {previewHtml ? (
                <div className="matter-birthday-greeting__preview-frame">
                  <iframe
                    title="Birthday greeting preview"
                    className="matter-birthday-greeting__preview-iframe birthday-greeting-dialog__iframe"
                    srcDoc={previewHtml}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>

        {!canSend ? (
          <p className="birthday-greeting-dialog__hint text-sm text-muted">
            Add a valid contact email on the client profile before sending.
          </p>
        ) : null}

        <div className="birthday-greeting-dialog__actions matter-birthday-greeting__actions">
          <button
            type="button"
            className="btn-secondary matter-birthday-greeting__action-btn"
            disabled={actionBusy}
            onClick={() => void loadPreview()}
          >
            {previewLoading ? "Refreshing…" : "Refresh preview"}
          </button>
          <button
            type="button"
            className="btn-primary matter-birthday-greeting__action-btn"
            disabled={actionBusy || !canSend || sentThisYear}
            onClick={() => void sendGreeting(false)}
          >
            Send today
          </button>
          {isAdmin ? (
            <button
              type="button"
              className="btn-secondary matter-birthday-greeting__action-btn matter-birthday-greeting__action-btn--test"
              disabled={actionBusy || !canSend}
              onClick={() => void sendGreeting(true)}
            >
              Force send (test)
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
