"use client";

export type StaffPayslipEmailPreview = {
  subject: string;
  html: string;
  text: string;
  recipientEmail: string | null;
  recipientName: string | null;
  recipientError: string | null;
};

type Props = {
  open: boolean;
  loading: boolean;
  error: string;
  preview: StaffPayslipEmailPreview | null;
  sending: boolean;
  onClose: () => void;
  onSend: () => void;
};

export function StaffPayslipEmailPreviewDialog({
  open,
  loading,
  error,
  preview,
  sending,
  onClose,
  onSend
}: Props) {
  if (!open) return null;

  const canSend = Boolean(preview?.recipientEmail && !preview.recipientError);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="payslip-preview-title">
      <div className="modal-panel schedule-email-modal max-h-[92vh] w-full max-w-4xl overflow-y-auto">
        <header className="schedule-email-modal__hero">
          <div className="schedule-email-modal__hero-copy">
            <p className="schedule-email-modal__eyebrow">Staff payslip</p>
            <h2 id="payslip-preview-title" className="schedule-email-modal__title">
              Email preview
            </h2>
            <p className="schedule-email-modal__subtitle">
              Review subject, recipient, and layout before sending. This covers this pay run only.
            </p>
          </div>
          <button
            type="button"
            className="schedule-email-modal__close btn-secondary !text-xs"
            onClick={onClose}
            disabled={sending}
          >
            Close
          </button>
        </header>

        <div className="schedule-email-modal__body">
          {loading ? (
            <p className="schedule-email-preview__loading">Loading preview…</p>
          ) : error ? (
            <div className="schedule-email-callout schedule-email-callout--banner">
              <p className="schedule-email-callout__title">Could not load preview</p>
              <p className="schedule-email-callout__text">{error}</p>
            </div>
          ) : preview ? (
            <div className="schedule-email-preview">
              <div className="schedule-email-preview__subject">
                <p className="schedule-email-preview__subject-label">To</p>
                <p className="schedule-email-preview__subject-text">
                  {preview.recipientName && preview.recipientEmail
                    ? `${preview.recipientName} · ${preview.recipientEmail}`
                    : preview.recipientEmail || "—"}
                </p>
                {preview.recipientError ? (
                  <p className="mt-2 text-xs leading-relaxed text-red-700">{preview.recipientError}</p>
                ) : null}
              </div>

              <div className="schedule-email-preview__subject">
                <p className="schedule-email-preview__subject-label">Subject</p>
                <p className="schedule-email-preview__subject-text">{preview.subject}</p>
              </div>

              <div className="schedule-email-preview__frame">
                <div className="schedule-email-preview__chrome">
                  <span className="schedule-email-preview__chrome-dot" aria-hidden />
                  <span className="schedule-email-preview__chrome-dot" aria-hidden />
                  <span className="schedule-email-preview__chrome-dot" aria-hidden />
                  <span className="schedule-email-preview__chrome-label">Message preview</span>
                </div>
                <div
                  className="schedule-email-preview__canvas max-h-[min(58vh,520px)] overflow-auto"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              </div>

              <footer className="schedule-email-footer schedule-email-footer--preview">
                <button type="button" className="btn-secondary schedule-email-footer__secondary" onClick={onClose} disabled={sending}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary schedule-email-footer__primary"
                  disabled={sending || !canSend}
                  onClick={onSend}
                >
                  {sending ? "Sending…" : "Send payslip email"}
                </button>
              </footer>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
