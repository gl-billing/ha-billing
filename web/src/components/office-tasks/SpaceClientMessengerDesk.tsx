"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { Skeleton } from "@/components/Skeleton";

type ClientMessage = {
  id: string;
  sentAt: string;
  fromEmail: string;
  fromName: string;
  clientCode: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  gmailSent: boolean;
  whatsAppSent: boolean;
};

type ClientOption = {
  code: string;
  name: string;
  email: string;
  phone: string;
};

type ListTab = "clients" | "sent";

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
 * Messenger-style desk for outbound client email (firm Gmail sender).
 */
export function SpaceClientMessengerDesk() {
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLUListElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sent, setSent] = useState<ClientMessage[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [listTab, setListTab] = useState<ListTab>("clients");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedClientCode, setSelectedClientCode] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);

  const [clientCode, setClientCode] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [lastWhatsAppUrl, setLastWhatsAppUrl] = useState<string | null>(null);

  const selectedRecipient = useMemo(() => {
    const code = clientCode.trim().toUpperCase();
    return clients.find((row) => row.code === code) || null;
  }, [clients, clientCode]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/client-messages");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSent([]);
        setClients([]);
        setLoadError(typeof json.error === "string" ? json.error : "Could not load client messages.");
        return;
      }
      setSent(Array.isArray(json.sent) ? json.sent : []);
      setClients(Array.isArray(json.clients) ? json.clients : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams?.get("compose") === "1") {
      setComposing(true);
      setSelectedId(null);
      setSelectedClientCode(null);
    }
    const to = searchParams?.get("client")?.trim().toUpperCase() || "";
    if (to) setClientCode(to);
  }, [searchParams]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) =>
      [client.code, client.name, client.email].join(" ").toLowerCase().includes(q)
    );
  }, [clients, query]);

  const filteredSent = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sent;
    return sent.filter((message) =>
      [message.subject, message.body, message.toName, message.toEmail, message.clientCode]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, sent]);

  const selected = useMemo(
    () => sent.find((message) => message.id === selectedId) ?? null,
    [selectedId, sent]
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.code === selectedClientCode) ?? null,
    [clients, selectedClientCode]
  );

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setSendError("");
    setLastWhatsAppUrl(null);
    try {
      const res = await fetch("/api/client-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientCode, subject, body, sendWhatsApp })
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
      setComposing(false);
      setListTab("sent");
      setSelectedClientCode(null);
      setSelectedId(json.message?.id || null);
      await load();
    } finally {
      setSending(false);
    }
  }

  function openCompose(forClient?: ClientOption) {
    setComposing(true);
    setSelectedId(null);
    setSelectedClientCode(null);
    setSendError("");
    setLastWhatsAppUrl(null);
    if (forClient) setClientCode(forClient.code);
  }

  const threadOpen = composing || selectedId || selectedClientCode;

  return (
    <div
      className={`space-messenger${threadOpen ? " space-messenger--thread-open" : ""}`}
      id="space-client-messenger"
    >
      <div className="space-messenger__sidebar">
        <div className="space-messenger__sidebar-head">
          <div className="space-messenger__tabs">
            <button
              type="button"
              className={`space-messenger__tab${listTab === "clients" ? " space-messenger__tab--active" : ""}`}
              onClick={() => {
                setListTab("clients");
                setComposing(false);
                setSelectedId(null);
              }}
            >
              Clients
            </button>
            <button
              type="button"
              className={`space-messenger__tab${listTab === "sent" ? " space-messenger__tab--active" : ""}`}
              onClick={() => {
                setListTab("sent");
                setComposing(false);
                setSelectedClientCode(null);
              }}
            >
              Sent
            </button>
          </div>
          <div className="space-messenger__find">
            <input
              type="search"
              className="space-messenger__find-input"
              placeholder="Find client or message"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="space-messenger__compose-btn"
              aria-label="Compose message"
              onClick={() => openCompose()}
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
          {!loading && !loadError && listTab === "clients" && filteredClients.length === 0 ? (
            <div className="p-3">
              <EmptyState
                title="No clients with email"
                message="Add a contact email on the client profile to message them from here."
                compact
              />
            </div>
          ) : null}
          {!loading && !loadError && listTab === "sent" && filteredSent.length === 0 ? (
            <div className="p-3">
              <EmptyState
                title="No sent messages"
                message="Messages you send to clients via Gmail appear here."
                action={
                  <button type="button" className="btn-primary text-xs" onClick={() => openCompose()}>
                    + New message
                  </button>
                }
                compact
              />
            </div>
          ) : null}
          {!loading && !loadError && listTab === "clients" && filteredClients.length > 0 ? (
            <ul className="space-messenger__list" ref={listRef} role="listbox" aria-label="Client list">
              {filteredClients.map((client) => (
                <li key={client.code} role="option" aria-selected={selectedClientCode === client.code}>
                  <button
                    type="button"
                    className={`space-messenger__row${
                      selectedClientCode === client.code ? " space-messenger__row--active" : ""
                    }`}
                    onClick={() => {
                      setComposing(false);
                      setSelectedId(null);
                      setSelectedClientCode(client.code);
                    }}
                  >
                    <span className="space-messenger__avatar" aria-hidden>
                      {initials(client.name)}
                    </span>
                    <span className="space-messenger__row-main">
                      <span className="space-messenger__row-top">
                        <span className="space-messenger__row-title">{client.name}</span>
                        <span className="space-messenger__row-time">{client.code}</span>
                      </span>
                      <span className="space-messenger__row-preview">{client.email}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {!loading && !loadError && listTab === "sent" && filteredSent.length > 0 ? (
            <ul className="space-messenger__list" ref={listRef} role="listbox" aria-label="Sent messages">
              {filteredSent.map((message) => (
                <li key={message.id} role="option" aria-selected={selectedId === message.id}>
                  <button
                    type="button"
                    className={`space-messenger__row${
                      selectedId === message.id ? " space-messenger__row--active" : ""
                    }`}
                    onClick={() => {
                      setComposing(false);
                      setSelectedClientCode(null);
                      setSelectedId(message.id);
                    }}
                  >
                    <span className="space-messenger__avatar" aria-hidden>
                      {initials(message.toName)}
                    </span>
                    <span className="space-messenger__row-main">
                      <span className="space-messenger__row-top">
                        <span className="space-messenger__row-title">{message.subject || message.toName}</span>
                        <span className="space-messenger__row-time">{formatWhen(message.sentAt)}</span>
                      </span>
                      <span className="space-messenger__row-preview">
                        {message.toName} · {message.body}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="space-messenger__pane">
        {threadOpen ? (
          <button
            type="button"
            className="space-messenger__back"
            onClick={() => {
              setComposing(false);
              setSelectedId(null);
              setSelectedClientCode(null);
            }}
          >
            ← Clients
          </button>
        ) : null}
        {composing ? (
          <form className="space-messenger__compose" onSubmit={(event) => void handleSend(event)}>
            <h3 className="space-messenger__pane-title">Message client</h3>
            <label className="space-messenger__field">
              <span>To</span>
              <select value={clientCode} onChange={(event) => setClientCode(event.target.value)} required>
                <option value="">Choose client…</option>
                {clients.map((client) => (
                  <option key={client.code} value={client.code}>
                    {client.code} — {client.name}
                    {client.phone ? "" : " (no phone)"}
                  </option>
                ))}
              </select>
            </label>
            {selectedRecipient ? (
              <p className="space-messenger__hint">Sends via firm Gmail to {selectedRecipient.email}.</p>
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
                maxLength={4000}
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
            <div className="space-messenger__compose-actions">
              <button type="button" className="btn-secondary" onClick={() => setComposing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={sending}>
                {sending ? "Sending…" : "Send email"}
              </button>
            </div>
          </form>
        ) : selected ? (
          <div className="space-messenger__detail">
            <p className="space-messenger__detail-meta">
              To {selected.toName} ({selected.clientCode}) · {formatWhen(selected.sentAt)}
            </p>
            <h3 className="space-messenger__detail-subject">{selected.subject}</h3>
            <p className="space-messenger__detail-body">{selected.body}</p>
            {selected.gmailSent ? <p className="space-messenger__hint">Sent via Gmail.</p> : null}
            {selected.whatsAppSent ? (
              <p className="space-messenger__hint">Also opened WhatsApp.</p>
            ) : null}
          </div>
        ) : selectedClient ? (
          <div className="space-messenger__detail">
            <p className="space-messenger__detail-meta">{selectedClient.code}</p>
            <h3 className="space-messenger__detail-subject">{selectedClient.name}</h3>
            <p className="space-messenger__detail-body">{selectedClient.email}</p>
            {selectedClient.phone ? (
              <p className="space-messenger__hint">Phone: {selectedClient.phone}</p>
            ) : (
              <p className="space-messenger__hint">No phone on file for WhatsApp.</p>
            )}
            <div className="space-messenger__compose-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="btn-primary" onClick={() => openCompose(selectedClient)}>
                Message {selectedClient.name.split(/\s+/)[0] || "client"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-messenger__empty">
            <p className="space-messenger__empty-title">Select a client to message</p>
            <p className="space-messenger__empty-lede">or</p>
            <button type="button" className="bitrix-space-btn bitrix-space-btn--create" onClick={() => openCompose()}>
              + New message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
