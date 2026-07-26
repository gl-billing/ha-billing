"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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

type ListTab = "chats" | "sent";

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

/**
 * Bitrix-style Messenger desk — chat list + conversation pane.
 */
export function SpaceMessengerDesk() {
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLUListElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [inbox, setInbox] = useState<StaffMessage[]>([]);
  const [sent, setSent] = useState<StaffMessage[]>([]);
  const [employees, setEmployees] = useState<RecipientOption[]>([]);
  const [counsel, setCounsel] = useState<RecipientOption[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [listTab, setListTab] = useState<ListTab>("chats");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);

  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [lastWhatsAppUrl, setLastWhatsAppUrl] = useState<string | null>(null);
  const [lastMailtoUrl, setLastMailtoUrl] = useState<string | null>(null);

  const selectedRecipient = useMemo(() => {
    const email = recipientEmail.trim().toLowerCase();
    return (
      employees.find((row) => row.email === email) ||
      counsel.find((row) => row.email === email) ||
      null
    );
  }, [counsel, employees, recipientEmail]);

  const publishUnread = useCallback((count: number) => {
    setUnreadCount(count);
    window.dispatchEvent(
      new CustomEvent("ha-staff-messages-unread", { detail: { unreadCount: count } })
    );
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
        publishUnread(0);
        setLoadError(typeof json.error === "string" ? json.error : "Could not load messages.");
        return;
      }
      setInbox(Array.isArray(json.inbox) ? json.inbox : []);
      setSent(Array.isArray(json.sent) ? json.sent : []);
      setEmployees(Array.isArray(json.employees) ? json.employees : []);
      setCounsel(Array.isArray(json.counsel) ? json.counsel : []);
      publishUnread(typeof json.unreadCount === "number" ? json.unreadCount : 0);
    } finally {
      setLoading(false);
    }
  }, [publishUnread]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams?.get("compose") === "1") {
      setComposing(true);
      setSelectedId(null);
    }
    const to = searchParams?.get("to")?.trim() || "";
    if (to) setRecipientEmail(to);
  }, [searchParams]);

  const markRead = useCallback(
    async (message: StaffMessage) => {
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
      publishUnread(Math.max(0, unreadCount - 1));
    },
    [publishUnread, unreadCount]
  );

  const list = listTab === "sent" ? sent : inbox;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((message) =>
      [message.subject, message.body, message.fromName, message.toName, message.fromEmail, message.toEmail]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [list, query]);

  const selected = useMemo(
    () => list.find((message) => message.id === selectedId) ?? null,
    [list, selectedId]
  );

  useEffect(() => {
    if (selected && listTab === "chats" && !selected.readAt) {
      void markRead(selected);
    }
  }, [listTab, markRead, selected]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (composing) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      ) {
        return;
      }
      if (!filtered.length) return;
      const index = selectedId ? filtered.findIndex((m) => m.id === selectedId) : -1;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = filtered[Math.min(filtered.length - 1, Math.max(0, index + 1))];
        if (next) {
          setComposing(false);
          setSelectedId(next.id);
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = filtered[Math.max(0, index <= 0 ? 0 : index - 1)];
        if (prev) {
          setComposing(false);
          setSelectedId(prev.id);
        }
      } else if (event.key.toLowerCase() === "n" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setComposing(true);
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composing, filtered, selectedId]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setSendError("");
    setLastWhatsAppUrl(null);
    setLastMailtoUrl(null);
    try {
      const res = await fetch("/api/staff-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail, subject, body, sendWhatsApp })
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
      setComposing(false);
      setListTab("sent");
      setSelectedId(json.message?.id || null);
      await load();
    } finally {
      setSending(false);
    }
  }

  function openCompose() {
    setComposing(true);
    setSelectedId(null);
    setSendError("");
    setLastMailtoUrl(null);
  }

  return (
    <div
      className={`space-messenger${composing || selectedId ? " space-messenger--thread-open" : ""}`}
      id="space-messenger"
    >
      <div className="space-messenger__sidebar">
        <div className="space-messenger__sidebar-head">
          <div className="space-messenger__tabs">
            <button
              type="button"
              className={`space-messenger__tab${listTab === "chats" ? " space-messenger__tab--active" : ""}`}
              onClick={() => {
                setListTab("chats");
                setComposing(false);
                setSelectedId(null);
              }}
            >
              Chats{unreadCount ? ` (${unreadCount})` : ""}
            </button>
            <button
              type="button"
              className={`space-messenger__tab${listTab === "sent" ? " space-messenger__tab--active" : ""}`}
              onClick={() => {
                setListTab("sent");
                setComposing(false);
                setSelectedId(null);
              }}
            >
              Sent
            </button>
          </div>
          <div className="space-messenger__find">
            <input
              type="search"
              className="space-messenger__find-input"
              placeholder="Find staff, counsel, or chat"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="space-messenger__compose-btn"
              aria-label="Compose message"
              onClick={openCompose}
            >
              ✎
            </button>
          </div>
        </div>

        <div className="space-messenger__list-wrap">
          {loading ? (
            <div className="p-3">
              <Skeleton lines={4} />
            </div>
          ) : null}
          {!loading && loadError ? (
            <div className="p-3">
              <EmptyState message={loadError} compact />
              <button type="button" className="btn-secondary mt-2 w-full text-xs" onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : null}
          {!loading && !loadError && filtered.length === 0 ? (
            <div className="p-3">
              <EmptyState
                title={listTab === "sent" ? "No sent chats" : "No chats yet"}
                message={
                  listTab === "sent"
                    ? "Messages you send will appear here."
                    : "Message staff or collaborating counsel to start a chat."
                }
                action={
                  listTab === "chats" ? (
                    <button type="button" className="btn-primary text-xs" onClick={openCompose}>
                      + New message
                    </button>
                  ) : undefined
                }
                compact
              />
            </div>
          ) : null}
          {!loading && !loadError && filtered.length > 0 ? (
            <ul className="space-messenger__list" ref={listRef} role="listbox" aria-label="Message list">
              {filtered.map((message) => {
                const unread = listTab === "chats" && !message.readAt;
                const peer = listTab === "sent" ? message.toName : message.fromName;
                return (
                  <li key={message.id} role="option" aria-selected={selectedId === message.id}>
                    <button
                      type="button"
                      className={`space-messenger__row${
                        selectedId === message.id ? " space-messenger__row--active" : ""
                      }${unread ? " space-messenger__row--unread" : ""}`}
                      onClick={() => {
                        setComposing(false);
                        setSelectedId(message.id);
                      }}
                    >
                      <span className="space-messenger__avatar" aria-hidden>
                        {initials(peer)}
                      </span>
                      <span className="space-messenger__row-main">
                        <span className="space-messenger__row-top">
                          <span className="space-messenger__row-title">{message.subject || peer}</span>
                          <span className="space-messenger__row-time">{formatWhen(message.sentAt)}</span>
                        </span>
                        <span className="space-messenger__row-preview">
                          {peer} · {message.body}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="space-messenger__pane">
        {composing || selected ? (
          <button
            type="button"
            className="space-messenger__back"
            onClick={() => {
              setComposing(false);
              setSelectedId(null);
            }}
          >
            ← Chats
          </button>
        ) : null}
        {composing ? (
          <form className="space-messenger__compose" onSubmit={(event) => void handleSend(event)}>
            <h3 className="space-messenger__pane-title">New message</h3>
            <label className="space-messenger__field">
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
            {selectedRecipient?.kind === "counsel" ||
            (selectedRecipient && counsel.some((row) => row.email === selectedRecipient.email)) ? (
              <p className="space-messenger__hint">
                Counsel messages are saved here and open in your email app (mailto).
              </p>
            ) : null}
            <label className="space-messenger__field">
              <span>Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label className="space-messenger__field">
              <span>Message</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={8}
                maxLength={2000}
                required
              />
            </label>
            <label className="space-messenger__checkbox">
              <input
                type="checkbox"
                checked={sendWhatsApp}
                onChange={(event) => setSendWhatsApp(event.target.checked)}
              />
              <span>Also open WhatsApp</span>
            </label>
            {sendError ? <p className="space-messenger__error">{sendError}</p> : null}
            {lastWhatsAppUrl ? (
              <a
                href={lastWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="space-messenger__whatsapp"
              >
                Open WhatsApp
              </a>
            ) : null}
            {lastMailtoUrl ? (
              <a href={lastMailtoUrl} className="space-messenger__whatsapp">
                Open email draft
              </a>
            ) : null}
            <div className="space-messenger__compose-actions">
              <button type="button" className="btn-secondary" onClick={() => setComposing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={sending}>
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        ) : selected ? (
          <div className="space-messenger__detail">
            <p className="space-messenger__detail-meta">
              {listTab === "sent"
                ? `To ${selected.toName} · ${formatWhen(selected.sentAt)}`
                : `From ${selected.fromName} · ${formatWhen(selected.sentAt)}`}
            </p>
            <h3 className="space-messenger__detail-subject">{selected.subject}</h3>
            <p className="space-messenger__detail-body">{selected.body}</p>
            {selected.whatsAppSent ? (
              <p className="space-messenger__hint">Also sent via WhatsApp.</p>
            ) : null}
          </div>
        ) : (
          <div className="space-messenger__empty">
            <p className="space-messenger__empty-title">Select a chat to start communicating</p>
            <p className="space-messenger__empty-lede">or</p>
            <button type="button" className="bitrix-space-btn bitrix-space-btn--create" onClick={openCompose}>
              + New message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
