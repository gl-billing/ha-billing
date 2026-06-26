"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SameWindowLink } from "@/components/SameWindowLink";
import { MatterLink } from "@/components/MatterLink";
import { ClientBirthdayCake } from "@/components/ClientBirthdayCake";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { isBirthdayToday } from "@/lib/birthday-greeting";
import {
  formatClientCaseTypeLabel,
  showPsychologistFields
} from "@/lib/client-case-type";
import type { ClientDetail } from "@/lib/gl-config";
import { formatClientCaseLabel, formatPeso } from "@/lib/gl-config";
import {
  CLIENT_MATTER_TYPE_LABELS,
  formatMatterCaseCaption,
  formatMatterDirectoryCaseLabel,
  resolveClientMatterType
} from "@/lib/client-matter-type";

type Props = {
  clientCode: string | null;
  onClose: () => void;
};

function display(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return String(value);
  return value.trim();
}

type DetailRow = { label: string; value: string };

function buildRows(detail: ClientDetail): DetailRow[] {
  const rows: DetailRow[] = [
    { label: "Client name", value: display(detail.name) },
    { label: "Phone", value: display(detail.phone) },
    { label: "Email", value: display(detail.email) },
    { label: "Address", value: display(detail.address) }
  ];

  const greeting = display(detail.preferredGreeting);
  if (greeting && greeting.toLowerCase() !== detail.name.trim().toLowerCase()) {
    rows.push({ label: "Contact / greeting name", value: greeting });
  }

  rows.push(
    { label: "File type", value: CLIENT_MATTER_TYPE_LABELS[resolveClientMatterType(detail)] },
    { label: "Case / matter", value: formatMatterDirectoryCaseLabel(detail) }
  );

  if (formatMatterCaseCaption(detail)) {
    rows.push({ label: "Re:", value: formatMatterCaseCaption(detail) || "" });
  }

  const caseTypeLabel = formatClientCaseTypeLabel(detail.caseType, detail.caseTypeOther);
  if (caseTypeLabel) {
    rows.push({ label: "Case type", value: caseTypeLabel });
  }

  rows.push(
    { label: "Role in case", value: display(detail.caseRole) },
    { label: "Case number", value: display(detail.caseNumber) },
    { label: "Court", value: display(detail.courtPending) }
  );

  if (showPsychologistFields(detail)) {
    rows.push(
      { label: "Psychologist", value: display(detail.psychologistName) },
      { label: "Psychologist contact", value: display(detail.psychologistPhone) },
      { label: "Psychologist address", value: display(detail.psychologistAddress) }
    );
  }

  rows.push(
    { label: "Handling attorney", value: display(detail.assignedAttorney) },
    { label: "Account status", value: display(detail.accountStatus) },
    { label: "Client status", value: display(detail.status) },
    { label: "Balance", value: formatPeso(detail.balance) },
    { label: "Next follow-up", value: display(detail.nextFollowUp) },
    { label: "Last activity", value: display(detail.lastActivity) }
  );

  return rows.filter((row) => row.value);
}

export function ClientDirectoryPopup({ clientCode, onClose }: Props) {
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const popupRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (code: string) => {
    setLoading(true);
    setError("");
    setDetail(null);
    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(code)}/profile`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load client details.");
      if (!data.client) throw new Error("Client not found.");
      setDetail(data.client as ClientDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load client details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clientCode) {
      setDetail(null);
      setError("");
      return;
    }
    void load(clientCode);
  }, [clientCode, load]);

  useEffect(() => {
    if (!clientCode) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clientCode, onClose]);

  useEffect(() => {
    if (!clientCode || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeRef.current?.focus({ preventScroll: true });
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [clientCode]);

  if (!clientCode) return null;

  const rows = detail ? buildRows(detail) : [];
  const title = detail?.name || clientCode;

  return createPortal(
    <div className="client-directory-overlay" role="dialog" aria-modal="true" aria-labelledby="client-directory-title">
      <button type="button" className="client-directory-overlay__backdrop" aria-label="Close" onClick={onClose} />
      <div
        ref={popupRef}
        className="client-directory-popup"
        tabIndex={-1}
        aria-live="polite"
      >
        <header className="client-directory-popup__header">
          <div className="client-directory-popup__identity">
            <span className="client-directory-popup__code">{clientCode}</span>
            <h2 id="client-directory-title" className="client-directory-popup__name">
              <span className="client-name-case-label">
                <span className="client-name-case-label__name-group">
                  <span className="client-directory-popup__client-name">
                    {loading && !detail ? "Loading…" : title}
                  </span>
                  {detail && isBirthdayToday(detail.birthday) ? <ClientBirthdayCake /> : null}
                </span>
                {detail ? (
                  <>
                    <span className="client-name-case-label__sep"> — </span>
                    <span className="client-name-case-label__case">{formatMatterDirectoryCaseLabel(detail)}</span>
                  </>
                ) : null}
              </span>
            </h2>
          </div>
          <button ref={closeRef} type="button" className="client-directory-popup__close" onClick={onClose}>
            <span aria-hidden>×</span>
            <span className="client-directory-popup__close-label">Close</span>
          </button>
        </header>

        <div className="client-directory-popup__body">
          {loading && !detail ? <Skeleton lines={6} /> : null}
          {error ? <p className="client-directory-popup__error">{error}</p> : null}
          {!loading && detail && rows.length === 0 ? (
            <EmptyState compact message="No contact details on file for this client." />
          ) : null}
          {!loading && detail && rows.length > 0 ? (
            <dl className="client-directory-popup__grid">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <footer className="client-directory-popup__footer">
          <MatterLink
            code={detail?.code || clientCode}
            extra={
              detail
                ? { case: formatClientCaseLabel(detail.name, detail.caseTitle) }
                : undefined
            }
            className="btn-gold client-directory-popup__matter-link"
          >
            Open matter page →
          </MatterLink>
        </footer>
      </div>
    </div>,
    document.body
  );
}
