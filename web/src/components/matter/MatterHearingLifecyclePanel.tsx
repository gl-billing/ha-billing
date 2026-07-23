"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClientDetail, LedgerEntry } from "@/lib/gl-config";
import { formatPeso } from "@/lib/gl-config";
import type { AppearanceFeeOption } from "@/lib/sheets/ledger-read";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import {
  isConsultationEventCategory,
  isPleadingCategory,
  resolveEventCategory,
  splitEventCategory
} from "@/lib/office-tasks/event-form-utils";
import {
  defaultEventLedgerChargeAmount,
  findEventLedgerCharge,
  parseEventIdFromLedgerDescription,
  suggestedEventLedgerChargeDraft
} from "@/lib/event-ledger-charge";
import {
  buildAcceptanceFeePostedNotice,
  buildAppearanceFeePostedNotice,
  buildConsultationFeePostedNotice,
  buildFilingFeePostedNotice,
  buildPostedNoticeForMatterEvent,
  findIntakeAcceptanceFeeLedgerEntry
} from "@/lib/ledger-charge-notices";
import { formatLedgerEntryLabel } from "@/lib/ledger-display";
import { PostedLedgerChargeNote } from "@/components/matter/PostedLedgerChargeNote";
import {
  intakeAcceptanceFeeDescription,
  readIntakePendingAcceptanceFee,
  resolveIntakeAcceptanceFeeAmount
} from "@/lib/intake-acceptance-fee";
import {
  buildAppealElevationFeeDrafts,
  parseElevationIntakePathDetails
} from "@/lib/matter-elevate-court";
import {
  buildHearingLifecycleStates,
  hearingLifecycleOpenCount,
  suggestedAppearanceCharge
} from "@/lib/hearing-lifecycle";
import { isItemOpen } from "@/lib/office-tasks/schedule";

export type MatterChargeDraft = {
  category: string;
  description: string;
  amount?: string;
};

type Props = {
  events: OfficeItem[];
  billingEvents?: OfficeItem[];
  ledgerEntries?: LedgerEntry[];
  clientCode: string;
  matterCode?: string;
  profile?: Pick<ClientDetail, "caseTitle" | "courtPending" | "name" | "intakePathDetails"> | null;
  showAcceptanceFeeDraft?: boolean;
  busy?: boolean;
  onStatus: (message: string, isError?: boolean) => void;
  onRefresh: () => void | Promise<void>;
  onDraftCharge: (draft: MatterChargeDraft) => void;
};

function itemActionPayload(item: OfficeItem) {
  return {
    source: item.source,
    rowNumber: item.rowNumber,
    itemId: item.id,
    clientCase: item.clientCase
  };
}

export function MatterHearingLifecyclePanel({
  events,
  billingEvents,
  ledgerEntries = [],
  clientCode,
  matterCode = "",
  profile = null,
  showAcceptanceFeeDraft = false,
  busy,
  onStatus,
  onRefresh,
  onDraftCharge
}: Props) {
  const [appearanceFees, setAppearanceFees] = useState<AppearanceFeeOption[]>([]);
  const [confirmingKey, setConfirmingKey] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/clients/${encodeURIComponent(clientCode)}/appearance-fees`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.appearanceFees) {
          setAppearanceFees(json.appearanceFees as AppearanceFeeOption[]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clientCode]);

  const activeEvents = useMemo(() => events.filter(isItemOpen), [events]);

  const states = useMemo(
    () => buildHearingLifecycleStates(activeEvents, appearanceFees, ledgerEntries),
    [activeEvents, appearanceFees, ledgerEntries]
  );

  const openCount = hearingLifecycleOpenCount(states);
  const upcoming = states;

  const filingEvents = useMemo(
    () =>
      activeEvents
        .filter((item) => {
          const { category, categoryOther } = splitEventCategory(item.category);
          return isPleadingCategory(resolveEventCategory(category, categoryOther));
        })
        .sort((a, b) =>
          (a.filingDeadline || a.date || "9999").localeCompare(b.filingDeadline || b.date || "9999")
        ),
    [activeEvents]
  );

  const consultationEvents = useMemo(() => {
    const pool = new Map<string, OfficeItem>();

    for (const item of activeEvents) {
      const { category, categoryOther } = splitEventCategory(item.category);
      if (isConsultationEventCategory(resolveEventCategory(category, categoryOther))) {
        pool.set(`${item.source}-${item.rowNumber}`, item);
      }
    }

    for (const item of billingEvents || []) {
      const { category, categoryOther } = splitEventCategory(item.category);
      if (!isConsultationEventCategory(resolveEventCategory(category, categoryOther))) continue;
      if (!findEventLedgerCharge(item.id, ledgerEntries)) continue;
      pool.set(`${item.source}-${item.rowNumber}`, item);
    }

    return Array.from(pool.values()).sort((a, b) =>
      (a.eventDate || a.date || "9999").localeCompare(b.eventDate || b.date || "9999")
    );
  }, [activeEvents, billingEvents, ledgerEntries]);

  const linkedEventChargeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const state of states) ids.add(state.item.id);
    for (const item of filingEvents) ids.add(item.id);
    for (const item of consultationEvents) ids.add(item.id);
    return ids;
  }, [consultationEvents, filingEvents, states]);

  const orphanEventCharges = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{ eventId: string; item?: OfficeItem; charge: NonNullable<ReturnType<typeof findEventLedgerCharge>> }> =
      [];
    const eventsById = new Map(
      [...events, ...(billingEvents || [])].map((item) => [item.id.toUpperCase(), item])
    );

    for (const entry of ledgerEntries) {
      if (entry.type.toLowerCase() !== "charge" || entry.charge <= 0) continue;
      const eventId = parseEventIdFromLedgerDescription(entry.description);
      if (!eventId || linkedEventChargeIds.has(eventId) || seen.has(eventId)) continue;
      seen.add(eventId);
      rows.push({
        eventId,
        item: eventsById.get(eventId),
        charge: {
          sheetRow: entry.sheetRow,
          date: entry.date,
          amount: entry.charge,
          charge: entry.charge,
          category: entry.category,
          description: entry.description
        }
      });
    }

    return rows;
  }, [billingEvents, events, ledgerEntries, linkedEventChargeIds]);

  const acceptanceFeeDraft = useMemo((): MatterChargeDraft | null => {
    if (findIntakeAcceptanceFeeLedgerEntry(ledgerEntries)) return null;

    const pending = readIntakePendingAcceptanceFee(clientCode, matterCode);
    if (pending) {
      return {
        category: pending.category,
        description: pending.description,
        amount: pending.amount
      };
    }

    if (!showAcceptanceFeeDraft || !profile) return null;

    const amount = resolveIntakeAcceptanceFeeAmount({
      caseTitle: profile.caseTitle,
      courtPending: profile.courtPending
    });
    if (!amount || amount <= 0) return null;

    return {
      category: "Acceptance Fee",
      description: intakeAcceptanceFeeDescription(),
      amount: String(amount)
    };
  }, [clientCode, ledgerEntries, matterCode, profile, showAcceptanceFeeDraft]);

  const appealFeeDrafts = useMemo(() => {
    if (!profile) return { acceptance: null, deposit: null };
    const elevation = parseElevationIntakePathDetails(profile.intakePathDetails);
    if (!elevation) return { acceptance: null, deposit: null };
    return buildAppealElevationFeeDrafts({
      caseTitle: profile.caseTitle || elevation.fromCaseTitle || "",
      higherCourt: elevation.higherCourt || profile.courtPending || "",
      ledgerEntries
    });
  }, [ledgerEntries, profile]);

  const acceptanceFeePosted = useMemo(() => {
    const entry = findIntakeAcceptanceFeeLedgerEntry(ledgerEntries);
    if (!entry) return null;
    const matterLabel = profile?.name
      ? profile.caseTitle
        ? `${profile.name} — ${profile.caseTitle}`
        : profile.name
      : undefined;
    return buildAcceptanceFeePostedNotice({
      clientCode,
      clientCase: matterLabel,
      amount: entry.charge,
      postedDate: entry.date
    });
  }, [clientCode, ledgerEntries, profile]);

  const markCourtConfirmed = useCallback(
    async (item: OfficeItem) => {
      const key = `${item.source}-${item.rowNumber}`;
      setConfirmingKey(key);
      try {
        const res = await fetch("/api/tasks/items/court-confirmed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemActionPayload(item))
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Update failed.");
        onStatus(json.message || "Court confirmed.");
        await onRefresh();
      } catch (error) {
        onStatus(error instanceof Error ? error.message : "Update failed.", true);
      } finally {
        setConfirmingKey("");
      }
    },
    [onRefresh, onStatus]
  );

  if (
    !upcoming.length &&
    !filingEvents.length &&
    !consultationEvents.length &&
    !orphanEventCharges.length &&
    !acceptanceFeeDraft &&
    !acceptanceFeePosted &&
    !appealFeeDrafts.acceptance &&
    !appealFeeDrafts.deposit
  ) {
    return null;
  }

  return (
    <section className="matter-hearing-lifecycle card no-print" aria-label="Event billing">
      <div className="matter-hearing-lifecycle__head">
        <div>
          <p className="matter-hearing-lifecycle__eyebrow">Billing</p>
          <h2 className="matter-hearing-lifecycle__title font-display">Hearing &amp; filing charges</h2>
          <p className="matter-hearing-lifecycle__lede">
            Calendar events with fees already on the client ledger, or still waiting to be drafted.
          </p>
        </div>
        {openCount > 0 ? (
          <span className="matter-hearing-lifecycle__badge">
            {openCount} need{openCount === 1 ? "s" : ""} court confirm
          </span>
        ) : null}
      </div>

      {acceptanceFeePosted ? (
        <>
          <h3 className="matter-hearing-lifecycle__subtitle">Acceptance fee</h3>
          <ul className="matter-hearing-lifecycle__list">
            <li className="matter-hearing-lifecycle__item matter-hearing-lifecycle__item--posted">
              <div className="matter-hearing-lifecycle__item-main">
                <p className="matter-hearing-lifecycle__item-title">Matter acceptance fee</p>
                <PostedLedgerChargeNote
                  notice={acceptanceFeePosted}
                  linkToBilling={false}
                  variant="compact"
                />
              </div>
            </li>
          </ul>
        </>
      ) : acceptanceFeeDraft ? (
        <>
          <h3 className="matter-hearing-lifecycle__subtitle">Acceptance fee</h3>
          <ul className="matter-hearing-lifecycle__list">
            <li className="matter-hearing-lifecycle__item">
              <div className="matter-hearing-lifecycle__item-main">
                <p className="matter-hearing-lifecycle__item-title">Matter acceptance fee</p>
                <p className="matter-hearing-lifecycle__item-meta">
                  Not on ledger yet — post when the client signs the contract.
                </p>
              </div>
              <div className="matter-hearing-lifecycle__actions">
                <button
                  type="button"
                  className="btn-secondary matter-hearing-lifecycle__btn"
                  disabled={busy}
                  onClick={() => onDraftCharge(acceptanceFeeDraft)}
                >
                  Draft acceptance fee
                  {acceptanceFeeDraft.amount ? ` · ${formatPeso(Number(acceptanceFeeDraft.amount))}` : ""}
                </button>
              </div>
            </li>
          </ul>
        </>
      ) : null}

      {appealFeeDrafts.acceptance || appealFeeDrafts.deposit ? (
        <>
          <h3 className="matter-hearing-lifecycle__subtitle">Appeal fees</h3>
          <p className="matter-hearing-lifecycle__lede mb-2">
            Same client engagement, elevated forum — post the appeal acceptance fee and expense deposit on this
            matter (not the trial file).
          </p>
          <ul className="matter-hearing-lifecycle__list">
            {appealFeeDrafts.acceptance ? (
              <li className="matter-hearing-lifecycle__item">
                <div className="matter-hearing-lifecycle__item-main">
                  <p className="matter-hearing-lifecycle__item-title">Appeal acceptance fee</p>
                  <p className="matter-hearing-lifecycle__item-meta">
                    New engagement for the elevated court — separate from the trial-court acceptance fee.
                  </p>
                </div>
                <div className="matter-hearing-lifecycle__actions">
                  <button
                    type="button"
                    className="btn-secondary matter-hearing-lifecycle__btn"
                    disabled={busy}
                    onClick={() => onDraftCharge(appealFeeDrafts.acceptance!)}
                  >
                    Draft appeal fee
                    {appealFeeDrafts.acceptance.amount
                      ? ` · ${formatPeso(Number(appealFeeDrafts.acceptance.amount))}`
                      : ""}
                  </button>
                </div>
              </li>
            ) : null}
            {appealFeeDrafts.deposit ? (
              <li className="matter-hearing-lifecycle__item">
                <div className="matter-hearing-lifecycle__item-main">
                  <p className="matter-hearing-lifecycle__item-title">Expense deposit</p>
                  <p className="matter-hearing-lifecycle__item-meta">
                    Fresh deposit for appellate filing and out-of-pocket costs (adjust amount if needed).
                  </p>
                </div>
                <div className="matter-hearing-lifecycle__actions">
                  <button
                    type="button"
                    className="btn-secondary matter-hearing-lifecycle__btn"
                    disabled={busy}
                    onClick={() => onDraftCharge(appealFeeDrafts.deposit!)}
                  >
                    Draft deposit
                    {appealFeeDrafts.deposit.amount
                      ? ` · ${formatPeso(Number(appealFeeDrafts.deposit.amount))}`
                      : ""}
                  </button>
                </div>
              </li>
            ) : null}
          </ul>
        </>
      ) : null}

      {upcoming.length ? (
        <>
          <h3 className="matter-hearing-lifecycle__subtitle">Hearings</h3>
          <ul className="matter-hearing-lifecycle__list">
            {upcoming.map((state) => {
          const item = state.item;
          const key = `${item.source}-${item.rowNumber}`;
          const draft = suggestedAppearanceCharge(item);
          const linked =
            findEventLedgerCharge(item.id, ledgerEntries) ||
            (state.linkedAppearanceFee
              ? {
                  amount: state.linkedAppearanceFee.amount,
                  category: state.linkedAppearanceFee.category,
                  date: state.linkedAppearanceFee.date
                }
              : null);
          const suggestedAppearanceAmount = defaultEventLedgerChargeAmount({
            category: "Hearing",
            venue: item.venue
          });
          const confirming = confirmingKey === key;

          return (
            <li key={key} className={`matter-hearing-lifecycle__item${linked ? " matter-hearing-lifecycle__item--posted" : ""}`}>
              <div className="matter-hearing-lifecycle__item-main">
                <p className="matter-hearing-lifecycle__item-title">{item.details.trim() || "Hearing"}</p>
                <p className="matter-hearing-lifecycle__item-meta">
                  {item.date || item.eventDate || "Date TBD"}
                  {item.venue?.trim() ? ` · ${item.venue.trim()}` : ""}
                  {item.startTime?.trim() ? ` · ${item.startTime.trim()}` : ""}
                </p>
                <ul className="matter-hearing-lifecycle__prep">
                  {state.prepItems.slice(0, 3).map((prep) => (
                    <li key={prep}>{prep}</li>
                  ))}
                </ul>
                {linked ? (
                  <PostedLedgerChargeNote
                    notice={buildAppearanceFeePostedNotice({
                      clientCode,
                      clientCase: item.clientCase,
                      amount: linked.amount,
                      postedDate: linked.date,
                      hearingDate: item.eventDate || item.date || undefined,
                      hearingLabel: item.details
                    })}
                    linkToBilling={false}
                    variant="compact"
                  />
                ) : null}
              </div>

              <div className="matter-hearing-lifecycle__actions">
                {state.needsCourtConfirmation ? (
                  <button
                    type="button"
                    className="btn-gold matter-hearing-lifecycle__btn"
                    disabled={busy || confirming}
                    onClick={() => void markCourtConfirmed(item)}
                  >
                    {confirming ? "Saving…" : "Court confirmed"}
                  </button>
                ) : state.courtConfirmed ? (
                  <span className="matter-hearing-lifecycle__confirmed">Court confirmed</span>
                ) : null}

                {!linked ? (
                  <button
                    type="button"
                    className="btn-secondary matter-hearing-lifecycle__btn"
                    disabled={busy}
                    onClick={() =>
                      onDraftCharge({
                        category: draft.category,
                        description: draft.description,
                        amount:
                          suggestedAppearanceAmount > 0 ? String(suggestedAppearanceAmount) : undefined
                      })
                    }
                  >
                    Draft appearance fee
                    {suggestedAppearanceAmount > 0 ? ` · ${formatPeso(suggestedAppearanceAmount)}` : ""}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
          </ul>
        </>
      ) : null}

      {filingEvents.length ? (
        <>
          <h3 className="matter-hearing-lifecycle__subtitle">Filing & deadline charges</h3>
          <ul className="matter-hearing-lifecycle__list">
            {filingEvents.map((item) => {
              const key = `${item.source}-${item.rowNumber}`;
              const draft = suggestedEventLedgerChargeDraft(item);
              const linked = findEventLedgerCharge(item.id, ledgerEntries);
              return (
                <li key={key} className={`matter-hearing-lifecycle__item${linked ? " matter-hearing-lifecycle__item--posted" : ""}`}>
                  <div className="matter-hearing-lifecycle__item-main">
                    <p className="matter-hearing-lifecycle__item-title">{item.details.trim() || item.category}</p>
                    <p className="matter-hearing-lifecycle__item-meta">
                      {item.filingDeadline || item.date || item.eventDate || "Deadline TBD"}
                      {item.venue?.trim() ? ` · ${item.venue.trim()}` : ""}
                    </p>
                    {linked ? (
                      <PostedLedgerChargeNote
                        notice={buildFilingFeePostedNotice({
                          clientCode,
                          clientCase: item.clientCase,
                          amount: linked.amount,
                          postedDate: linked.date,
                          pleadingLabel: item.details
                        })}
                        linkToBilling={false}
                        variant="compact"
                      />
                    ) : null}
                  </div>
                  {!linked ? (
                    <div className="matter-hearing-lifecycle__actions">
                      <button
                        type="button"
                        className="btn-secondary matter-hearing-lifecycle__btn"
                        disabled={busy}
                        onClick={() =>
                          onDraftCharge({
                            category: draft.category,
                            description: draft.description
                          })
                        }
                      >
                        Draft filing charge
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {consultationEvents.length ? (
        <>
          <h3 className="matter-hearing-lifecycle__subtitle">Consultations</h3>
          <ul className="matter-hearing-lifecycle__list">
            {consultationEvents.map((item) => {
              const key = `${item.source}-${item.rowNumber}`;
              const draft = suggestedEventLedgerChargeDraft(item);
              const linked = findEventLedgerCharge(item.id, ledgerEntries);
              return (
                <li key={key} className={`matter-hearing-lifecycle__item${linked ? " matter-hearing-lifecycle__item--posted" : ""}`}>
                  <div className="matter-hearing-lifecycle__item-main">
                    <p className="matter-hearing-lifecycle__item-title">{item.details.trim() || "Consultation"}</p>
                    <p className="matter-hearing-lifecycle__item-meta">
                      {item.eventDate || item.date || "Date TBD"}
                      {item.venue?.trim() ? ` · ${item.venue.trim()}` : ""}
                    </p>
                    {linked ? (
                      <PostedLedgerChargeNote
                        notice={buildConsultationFeePostedNotice({
                          clientCode,
                          clientCase: item.clientCase,
                          amount: linked.amount,
                          postedDate: linked.date,
                          consultationDate: item.eventDate || item.date || undefined,
                          consultationLabel: item.details
                        })}
                        linkToBilling={false}
                        variant="compact"
                      />
                    ) : null}
                  </div>
                  {!linked ? (
                    <div className="matter-hearing-lifecycle__actions">
                      <button
                        type="button"
                        className="btn-secondary matter-hearing-lifecycle__btn"
                        disabled={busy}
                        onClick={() =>
                          onDraftCharge({
                            category: draft.category,
                            description: draft.description
                          })
                        }
                      >
                        Draft consultation fee
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {orphanEventCharges.length ? (
        <>
          <h3 className="matter-hearing-lifecycle__subtitle">Posted from + Event</h3>
          <ul className="matter-hearing-lifecycle__list">
            {orphanEventCharges.map(({ eventId, item, charge }) => {
              const key = item ? `${item.source}-${item.rowNumber}` : eventId;
              const title =
                item?.details?.trim() ||
                formatLedgerEntryLabel({ type: "charge", category: "", description: charge.description }).trim() ||
                "Event charge";
              const notice = item
                ? buildPostedNoticeForMatterEvent({
                    clientCode,
                    item,
                    amount: charge.amount,
                    postedDate: charge.date
                  })
                : buildConsultationFeePostedNotice({
                    clientCode,
                    amount: charge.amount,
                    postedDate: charge.date,
                    consultationLabel: title
                  });

              return (
                <li key={key} className="matter-hearing-lifecycle__item matter-hearing-lifecycle__item--posted">
                  <div className="matter-hearing-lifecycle__item-main">
                    <p className="matter-hearing-lifecycle__item-title">{title}</p>
                    {item ? (
                      <p className="matter-hearing-lifecycle__item-meta">
                        {item.eventDate || item.date || item.filingDeadline || "Date TBD"}
                      </p>
                    ) : null}
                    <PostedLedgerChargeNote
                      notice={notice}
                      linkToBilling={false}
                      variant="compact"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
