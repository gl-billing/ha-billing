"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { Skeleton } from "@/components/Skeleton";

type StaffMessage = {
  id: string;
  sentAt: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  readAt: string | null;
  whatsAppSent: boolean;
};

type RecipientOption = {
  name: string;
  email: string;
  phone: string;
  firm?: string;
  kind?: "staff" | "counsel";
};

type Props = {
  compact?: boolean;
};

type PanelPosition = {
  top: number;
  right: number;
};

type PanelTab = "inbox" | "compose" | "sent";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function StaffMessagesCenter({ compact = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [inbox, setInbox] = useState<StaffMessage[]>([]);
  const [sent, setSent] = useState<StaffMessage[]>([]);
  const [employees, setEmployees] = useState<RecipientOption[]>([]);
  const [counsel, setCounsel] = useState<RecipientOption[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tab, setTab] = useState<PanelTab>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [lastWhatsAppUrl, setLastWhatsAppUrl] = useState<string | null>(null);
  const [lastMailtoUrl, setLastMailtoUrl] = useState<string | null>(null);
  const [whatsAppMissingPhone, setWhatsAppMissingPhone] = useState(false);

  const selectedRecipient = useMemo(() => {
    const email = recipientEmail.trim().toLowerCase();
    return (
      employees.find((row) => row.email === email) ||
      counsel.find((row) => row.email === email) ||
      null
    );
  }, [counsel, employees, recipientEmail]);

  const selectedMessage = useMemo(() => {
    const pool = tab === "sent" ? sent : inbox;
    return pool.find((message) => message.id === selectedId) ?? null;
  }, [inbox, sent, selectedId, tab]);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPanelPosition({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right)
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/staff-messages");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInbox([]);
        setSent([]);
        setEmployees([]);
        setCounsel([]);
        setUnreadCount(0);
        setLoadError(typeof json.error === "string" ? json.error : "Could not load staff messages.");
        return;
      }
      setInbox(Array.isArray(json.inbox) ? json.inbox : []);
      setSent(Array.isArray(json.sent) ? json.sent : []);
      setEmployees(Array.isArray(json.employees) ? json.employees : []);
      setCounsel(Array.isArray(json.counsel) ? json.counsel : []);
      const nextUnread = typeof json.unreadCount === "number" ? json.unreadCount : 0;
      setUnreadCount(nextUnread);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ha-staff-messages-unread", { detail: { unreadCount: nextUnread } })
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (message: StaffMessage) => {
    if (message.readAt) return;
    const res = await fetch(`/api/staff-messages/${encodeURIComponent(message.id)}/read`, {
      method: "POST"
    });
    if (!res.ok) return;
    setInbox((rows) =>
      rows.map((row) =>
        row.id === message.id ? { ...row, readAt: row.readAt || new Date().toISOString() } : row
      )
    );
    setUnreadCount((count) => {
      const next = Math.max(0, count - 1);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ha-staff-messages-unread", { detail: { unreadCount: next } })
        );
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [load, open]);

  useEffect(() => {
    if (!open) return;
    if (selectedMessage && tab === "inbox" && !selectedMessage.readAt) {
      void markRead(selectedMessage);
    }
  }, [markRead, open, selectedMessage, tab]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();

    function onScrollOrResize() {
      updatePanelPosition();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, updatePanelPosition]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setSendError("");
    setLastWhatsAppUrl(null);
    setLastMailtoUrl(null);
    setWhatsAppMissingPhone(false);
    try {
      const res = await fetch("/api/staff-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail,
          subject,
          body,
          sendWhatsApp
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(typeof json.error === "string" ? json.error : "Could not send message.");
        return;
      }
      setSubject("");
      setBody("");
      setSendWhatsApp(false);
      if (typeof json.whatsAppUrl === "string") {
        setLastWhatsAppUrl(json.whatsAppUrl);
        window.open(json.whatsAppUrl, "_blank", "noopener,noreferrer");
      }
      if (typeof json.mailtoUrl === "string") {
        setLastMailtoUrl(json.mailtoUrl);
        window.location.href = json.mailtoUrl;
      }
      setWhatsAppMissingPhone(json.whatsAppMissingPhone === true);
      setTab("sent");
      setSelectedId(json.message?.id || null);
      await load();
    } finally {
      setSending(false);
    }
  }

  const list = tab === "sent" ? sent : inbox;

  const panel =
    open && panelPosition && mounted ? (
      <div
        ref={panelRef}
        className="staff-messages-center__panel staff-messages-center__panel--floating"
        style={{ top: panelPosition.top, right: panelPosition.right }}
        role="dialog"
        aria-label="Staff messages"
      >
        <div className="staff-messages-center__head">
          <p className="staff-messages-center__title font-display text-base font-semibold text-ink">Staff messages</p>
          <button type="button" className="text-xs text-muted" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>

        <div className="staff-messages-center__tabs">
          <button
            type="button"
            className={`staff-messages-center__tab ${tab === "inbox" ? "staff-messages-center__tab--active" : ""}`.trim()}
            onClick={() => {
              setTab("inbox");
              setSelectedId(null);
            }}
          >
            Inbox{unreadCount ? ` (${unreadCount})` : ""}
          </button>
          <button
            type="button"
            className={`staff-messages-center__tab ${tab === "compose" ? "staff-messages-center__tab--active" : ""}`.trim()}
            onClick={() => {
              setTab("compose");
              setSelectedId(null);
              setSendError("");
              setLastWhatsAppUrl(null);
              setLastMailtoUrl(null);
            }}
          >
            Send
          </button>
          <button
            type="button"
            className={`staff-messages-center__tab ${tab === "sent" ? "staff-messages-center__tab--active" : ""}`.trim()}
            onClick={() => {
              setTab("sent");
              setSelectedId(null);
            }}
          >
            Sent
          </button>
        </div>

        {loading ? (
          <div className="px-3 py-4">
            <Skeleton lines={3} />
          </div>
        ) : null}

        {!loading && loadError ? (
          <div className="px-3 py-2">
            <EmptyState message={loadError} />
            <button type="button" className="btn-secondary mt-2 w-full text-xs" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !loadError && tab === "compose" ? (
          <form className="staff-messages-center__compose" onSubmit={(event) => void handleSend(event)}>
            <label className="staff-messages-center__field">
              <span>To</span>
              <select
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                required
              >
                <option value="">Choose recipient…</option>
                {employees.length ? (
                  <optgroup label="Staff">
                    {employees.map((employee) => (
                      <option key={`staff:${employee.email}`} value={employee.email}>
                        {employee.name}
                        {employee.phone ? "" : " (no phone on file)"}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {counsel.length ? (
                  <optgroup label="Collaborating counsel">
                    {counsel.map((row) => (
                      <option key={`counsel:${row.email}`} value={row.email}>
                        {row.name}
                        {row.firm ? ` — ${row.firm}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            {selectedRecipient && counsel.some((row) => row.email === selectedRecipient.email) ? (
              <p className="staff-messages-center__hint">
                Counsel messages are saved here and open in your email app (mailto).
              </p>
            ) : null}
            <label className="staff-messages-center__field">
              <span>Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label className="staff-messages-center__field">
              <span>Message</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                maxLength={2000}
                required
              />
            </label>
            <label className="staff-messages-center__checkbox">
              <input
                type="checkbox"
                checked={sendWhatsApp}
                onChange={(event) => setSendWhatsApp(event.target.checked)}
              />
              <span>Also open WhatsApp to send this message</span>
            </label>
            {sendError ? <p className="staff-messages-center__error">{sendError}</p> : null}
            {lastWhatsAppUrl ? (
              <a
                href={lastWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="staff-messages-center__whatsapp-link"
              >
                Open WhatsApp
              </a>
            ) : null}
            {lastMailtoUrl ? (
              <a href={lastMailtoUrl} className="staff-messages-center__whatsapp-link">
                Open email draft
              </a>
            ) : null}
            {whatsAppMissingPhone ? (
              <p className="staff-messages-center__hint">
                Saved in-app, but no phone number on file for WhatsApp.
              </p>
            ) : null}
            <button type="submit" className="btn-primary w-full text-sm" disabled={sending}>
              {sending ? "Sending…" : "Send message"}
            </button>
          </form>
        ) : null}

        {!loading && !loadError && tab !== "compose" ? (
          <div className="staff-messages-center__body">
            {selectedMessage ? (
              <div className="staff-messages-center__detail">
                <button
                  type="button"
                  className="staff-messages-center__back"
                  onClick={() => setSelectedId(null)}
                >
                  ← Back
                </button>
                <p className="staff-messages-center__detail-meta">
                  {tab === "sent"
                    ? `To ${selectedMessage.toName} · ${formatWhen(selectedMessage.sentAt)}`
                    : `From ${selectedMessage.fromName} · ${formatWhen(selectedMessage.sentAt)}`}
                </p>
                <h3 className="staff-messages-center__detail-subject">{selectedMessage.subject}</h3>
                <p className="staff-messages-center__detail-body">{selectedMessage.body}</p>
                {selectedMessage.whatsAppSent ? (
                  <p className="staff-messages-center__hint">Also sent via WhatsApp.</p>
                ) : null}
              </div>
            ) : list.length === 0 ? (
              <div className="px-3 py-3">
                <EmptyState
                  message={
                    tab === "sent"
                      ? "No sent messages yet."
                      : "No messages in your inbox."
                  }
                />
              </div>
            ) : (
              <ul className="staff-messages-center__list">
                {list.map((message) => {
                  const unread = tab === "inbox" && !message.readAt;
                  return (
                    <li key={message.id}>
                      <button
                        type="button"
                        className={`staff-messages-center__row ${unread ? "staff-messages-center__row--unread" : ""}`.trim()}
                        onClick={() => setSelectedId(message.id)}
                      >
                        <span className="staff-messages-center__row-subject">{message.subject}</span>
                        <span className="staff-messages-center__row-meta">
                          {tab === "sent" ? message.toName : message.fromName} · {formatWhen(message.sentAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={`staff-messages-center no-print ${compact ? "staff-messages-center--compact" : ""}`.trim()}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`staff-messages-center__trigger ${compact ? "staff-messages-center__trigger--compact" : ""}`.trim()}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Staff messages${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        onClick={() => setOpen((value) => !value)}
      >
        ✉️
        {unreadCount ? (
          <span className="staff-messages-center__badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        ) : null}
      </button>

      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </div>
  );
}
