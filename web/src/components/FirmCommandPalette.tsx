"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useClientMatter } from "@/components/office-tasks/ClientMatterPanel";
import { useMatterNavigation } from "@/hooks/useMatterNavigation";
import type { FirmSearchResult } from "@/lib/firm-search";
import { saveBillingPage } from "@/lib/staff-prefs";

type Props = {
  workspace: "billing" | "tasks";
  billingAccess?: boolean;
};

const KIND_LABELS: Record<FirmSearchResult["kind"], string> = {
  client: "Client",
  task: "Task",
  event: "Hearing / event"
};

type QuickAction = {
  id: string;
  label: string;
  hint: string;
  run: () => void;
};

export function FirmCommandPalette({ workspace, billingAccess = true }: Props) {
  const router = useRouter();
  const matter = useClientMatter();
  const { goTo, withReturn } = useMatterNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FirmSearchResult[]>([]);
  const [intentLabel, setIntentLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    void fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setIsAdmin(Boolean(json.isAdmin));
      })
      .catch(() => undefined);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setIntentLabel(null);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIntentLabel(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      if (res.ok) {
        setResults(json.results || []);
        setIntentLabel(json.intentLabel || null);
      }
    } catch {
      setResults([]);
      setIntentLabel(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void runSearch(query), 220);
    return () => window.clearTimeout(timer);
  }, [open, query, runSearch]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") close();
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("gl-open-command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("gl-open-command-palette", onOpenEvent);
    };
  }, [close]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const quickActions = useMemo(() => {
    const now = new Date();
    const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const actions: QuickAction[] = [
      {
        id: "tasks-today",
        label: "My work today",
        hint: "Tasks",
        run: () => {
          close();
          router.push("/app");
        }
      }
    ];
    if (billingAccess) {
      actions.unshift(
        {
          id: "billing-home",
          label: "Billing dashboard",
          hint: "Firm numbers & documents",
          run: () => {
            saveBillingPage("home");
            close();
            router.push("/billing");
          }
        },
        {
          id: "billing-clients",
          label: "Client directory",
          hint: "Search every client",
          run: () => {
            saveBillingPage("clients");
            close();
            router.push("/billing");
          }
        },
        {
          id: "billing-walkins",
          label: "Walk-ins",
          hint: "Consultations & promote",
          run: () => {
            saveBillingPage("walkIns");
            close();
            router.push("/billing");
          }
        }
      );
    }
    if (workspace === "billing" && billingAccess) {
      actions.push({
        id: "billing-intake",
        label: "New matter intake",
        hint: "Register retained client",
        run: () => {
          saveBillingPage("newClient");
          close();
          router.push("/billing");
        }
      });
    }
    if (isAdmin && billingAccess) {
      actions.unshift({
        id: "billing-firm-finances",
        label: `Firm finances · ${monthLabel.split(" ")[0]}`,
        hint: "Firm income & lawyer fee sharing",
        run: () => {
          saveBillingPage("firmFinances");
          close();
          router.push("/billing");
        }
      });
    }
    return actions;
  }, [billingAccess, close, isAdmin, router, workspace]);

  function navigate(result: FirmSearchResult) {
    if (result.kind === "client" && matter) {
      matter.openClientCode(result.clientCode, result.title);
      close();
      return;
    }
    close();
    router.push(withReturn(result.href));
  }

  function handleEnter() {
    const q = query.trim();
    if (!q) return;
    close();
    router.push(`/app?tab=all-items&q=${encodeURIComponent(q)}`);
  }

  const grouped = {
    client: results.filter((r) => r.kind === "client"),
    task: results.filter((r) => r.kind === "task"),
    event: results.filter((r) => r.kind === "event")
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="firm-command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" className="firm-command-palette__backdrop" aria-label="Close" onClick={close} />
      <div className="firm-command-palette__panel">
        <div className="firm-command-palette__search-wrap">
          <span className="firm-command-palette__icon" aria-hidden>
            ⌕
          </span>
          <input
            ref={inputRef}
            type="search"
            className="firm-command-palette__input"
            value={query}
            placeholder="Jump to a client, task, or action…"
            aria-label="Command palette search"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0]) navigate(results[0]);
                else handleEnter();
              }
            }}
          />
          <kbd className="firm-command-palette__kbd">Esc</kbd>
        </div>

        <div className="firm-command-palette__actions">
          {quickActions.map((action) => (
            <button key={action.id} type="button" className="firm-command-palette__action" onClick={action.run}>
              <span className="firm-command-palette__action-label">{action.label}</span>
              <span className="firm-command-palette__action-hint">{action.hint}</span>
            </button>
          ))}
        </div>

        <div className="firm-command-palette__results">
          {intentLabel ? (
            <p className="firm-command-palette__intent">
              Showing: <strong>{intentLabel}</strong>
            </p>
          ) : null}
          {loading ? <p className="firm-command-palette__empty">Searching…</p> : null}
          {!loading && query.trim() && results.length === 0 ? (
            <p className="firm-command-palette__empty">No matches — press Enter to search all items.</p>
          ) : null}
          {(["client", "task", "event"] as const).map((kind) => {
            const list = grouped[kind];
            if (!list.length) return null;
            return (
              <div key={kind} className="firm-command-palette__group">
                <p className="firm-command-palette__group-label">{KIND_LABELS[kind]}</p>
                {list.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="firm-command-palette__result"
                    onClick={() => navigate(result)}
                  >
                    <span className="firm-command-palette__result-title">{result.title}</span>
                    <span className="firm-command-palette__result-sub">{result.subtitle}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
