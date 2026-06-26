"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientMatter } from "@/components/office-tasks/ClientMatterPanel";
import { useMatterNavigation } from "@/hooks/useMatterNavigation";
import type { FirmSearchResult } from "@/lib/firm-search";
import { getPinnedMatters, getRecentMatters, type MatterPrefEntry } from "@/lib/matter-prefs";
import { VoiceQuickAddButton } from "@/components/VoiceQuickAddButton";
import { readJsonResponse } from "@/lib/fetch-json";

export const DEFAULT_SEARCH_PLACEHOLDER =
  "Try searching for a client code, hearing date, task, assignee, or lawyer name…";

type Props = {
  className?: string;
  placeholder?: string;
  /** Tasks app: controlled query synced with All items tab */
  value?: string;
  onChange?: (query: string) => void;
  onSubmit?: (query: string) => void;
  busy?: boolean;
  billingAccess?: boolean;
};

const KIND_LABELS: Record<FirmSearchResult["kind"], string> = {
  client: "Client",
  task: "Task",
  event: "Hearing / event"
};

export function GlobalSearchBar({
  className = "",
  placeholder = DEFAULT_SEARCH_PLACEHOLDER,
  value: controlledValue,
  onChange,
  onSubmit,
  busy = false,
  billingAccess = true
}: Props) {
  const router = useRouter();
  const matter = useClientMatter();
  const { goTo, withReturn } = useMatterNavigation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalQuery, setInternalQuery] = useState("");
  const [results, setResults] = useState<FirmSearchResult[]>([]);
  const [intentLabel, setIntentLabel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const controlled = controlledValue !== undefined;
  const query = controlled ? controlledValue : internalQuery;

  const setQuery = useCallback(
    (next: string) => {
      if (controlled) onChange?.(next);
      else setInternalQuery(next);
    },
    [controlled, onChange]
  );

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIntentLabel(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const json = await readJsonResponse<{ results?: FirmSearchResult[]; intentLabel?: string | null }>(res);
      if (res.ok && json) {
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
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void runSearch(query), 280);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("gl-open-command-palette"));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function clearSearch() {
    setQuery("");
    setResults([]);
    setIntentLabel(null);
    setOpen(false);
  }

  function openMatter(entry: MatterPrefEntry) {
    if (matter) {
      matter.openClientCode(entry.code);
      clearSearch();
      return;
    }
    setOpen(false);
    setQuery("");
    setResults([]);
    goTo(entry.code);
  }

  function matterMatchesQuery(entry: MatterPrefEntry, q: string): boolean {
    const needle = q.trim().toLowerCase();
    if (!needle) return false;
    return (
      entry.code.toLowerCase().includes(needle) ||
      (entry.label?.toLowerCase().includes(needle) ?? false)
    );
  }

  const matterSuggestions = useMemo(() => {
    if (!open || !query.trim()) return { pinned: [] as MatterPrefEntry[], recent: [] as MatterPrefEntry[] };
    const pinned = getPinnedMatters().filter((entry) => matterMatchesQuery(entry, query));
    const pinnedCodes = new Set(pinned.map((entry) => entry.code));
    const recent = getRecentMatters()
      .filter((entry) => matterMatchesQuery(entry, query) && !pinnedCodes.has(entry.code))
      .slice(0, 6);
    return { pinned, recent };
  }, [open, query, matter?.prefsVersion]);

  function renderMatterSuggestion(entry: MatterPrefEntry, pinned?: boolean) {
    return (
      <button
        key={`${pinned ? "pin" : "recent"}-${entry.code}-${entry.at}`}
        type="button"
        className="unified-search-dropdown__item"
        onMouseDown={() => openMatter(entry)}
      >
        <p className="text-sm font-bold text-ink">
          {entry.code}
          {pinned ? <span className="ml-1.5 text-[10px] font-extrabold text-gold-dark">★</span> : null}
        </p>
        {entry.label ? <p className="truncate text-[11px] text-muted">{entry.label}</p> : null}
      </button>
    );
  }

  function navigate(result: FirmSearchResult) {
    if (result.kind === "client" && matter) {
      matter.openClientCode(result.clientCode, result.title);
      clearSearch();
      return;
    }

    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(withReturn(result.href));
  }

  function handleEnter() {
    const q = query.trim();
    if (!q) return;
    setOpen(false);

    if (onSubmit) {
      onSubmit(q);
      return;
    }

    router.push(`/app?tab=${billingAccess ? "all-items" : "today"}&q=${encodeURIComponent(q)}`);
  }

  const grouped = {
    client: results.filter((r) => r.kind === "client"),
    task: results.filter((r) => r.kind === "task"),
    event: results.filter((r) => r.kind === "event")
  };

  return (
    <section className={`tasks-search-bar search-hero search-jewel card no-print ${className}`.trim()}>
      <div className="search-bar-wrap">
        <span className="search-icon tasks-search-bar__icon" aria-hidden>
          ⌕
        </span>
        <input
          ref={inputRef}
          type="search"
          className="search-hero-input tasks-search-bar__input"
          value={query}
          placeholder={placeholder}
          disabled={busy}
          aria-label="Firm-wide search"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleEnter();
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
        />
        <VoiceQuickAddButton
          disabled={busy}
          className="search-voice-btn"
          onTranscript={(text) => {
            setQuery(text);
            setOpen(true);
            void runSearch(text);
          }}
        />
        {query ? (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            disabled={busy}
            onClick={clearSearch}
          >
            ×
          </button>
        ) : null}

        {open && query.trim() ? (
          <div className="unified-search-dropdown">
            {matterSuggestions.pinned.length ? (
              <div className="unified-search-dropdown__group">
                <p className="unified-search-dropdown__group-label">Pinned</p>
                {matterSuggestions.pinned.map((entry) => renderMatterSuggestion(entry, true))}
              </div>
            ) : null}
            {matterSuggestions.recent.length ? (
              <div className="unified-search-dropdown__group">
                <p className="unified-search-dropdown__group-label">Recent</p>
                {matterSuggestions.recent.map((entry) => renderMatterSuggestion(entry))}
              </div>
            ) : null}
            {intentLabel ? (
              <p className="unified-search-dropdown__intent px-3 py-2 text-xs text-muted">
                Showing: <span className="font-semibold text-ink">{intentLabel}</span>
              </p>
            ) : null}
            {loading ? <p className="px-3 py-3 text-xs text-muted">Searching…</p> : null}
            {!loading &&
            results.length === 0 &&
            !matterSuggestions.pinned.length &&
            !matterSuggestions.recent.length ? (
              <p className="px-3 py-3 text-xs text-muted">No matches.</p>
            ) : null}
            {(["client", "task", "event"] as const).map((kind) => {
              const list = grouped[kind];
              if (!list.length) return null;
              return (
                <div key={kind} className="unified-search-dropdown__group">
                  <p className="unified-search-dropdown__group-label">{KIND_LABELS[kind]}</p>
                  {list.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="unified-search-dropdown__item"
                      onMouseDown={() => navigate(result)}
                    >
                      <p className="text-sm font-bold text-ink">{result.title}</p>
                      <p className="truncate text-[11px] text-muted">{result.subtitle}</p>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
