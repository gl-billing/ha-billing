"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import { ItemCard, type ItemSummary } from "@/components/office-tasks/ItemCard";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { ClientActivityTimeline } from "@/components/ClientActivityTimeline";
import { ClientCodeRenameForm } from "@/components/ClientCodeRenameForm";
import { MatterLink } from "@/components/MatterLink";
import { groupItemsByClientCode, matterClientContextFromDetail, matterItemAnchorId, parseClientCaseDisplay, resolveTaskGroupCode } from "@/lib/office-tasks/client-matter";
import { billingClientMatchesMatterCode } from "@/lib/sheets/task-code-client-match";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import type { TaskActivityEntry } from "@/lib/office-tasks/sheets/activity-log";
import { officeItemKey } from "@/lib/office-tasks/schedule";
import { formatPeso, type ActivityItem } from "@/lib/gl-config";
import {
  formatClientCaseTypeLabel,
  showPsychologistFields
} from "@/lib/client-case-type";
import {
  CLIENT_MATTER_TYPE_LABELS,
  formatMatterCaseCaption,
  resolveClientMatterType
} from "@/lib/client-matter-type";
import { mergeTaskTimelineItems } from "@/lib/task-matter-timeline";
import { resolvePrepRoleFromSession } from "@/lib/office-tasks/prep-workload-view";

type TaskBillingClient = {
  code: string;
  name: string;
  caseTitle: string;
  caseType: string;
  caseTypeOther: string;
  caseNumber: string;
  caseRole: string;
  courtPending: string;
  matterType: string;
  balance: number;
  accountStatus: string;
  status: string;
  email: string;
  phone: string;
  address: string;
  assignedAttorney: string;
  retainerBalance: number;
  lastBillingDate: string;
  nextFollowUp: string;
  lastActivity: string;
  psychologistName: string;
  psychologistPhone: string;
  psychologistAddress: string;
};

type BillingFetchState =
  | { status: "idle" | "loading" }
  | { status: "unavailable" }
  | { status: "not_found" }
  | { status: "ready"; client: TaskBillingClient; activity: ActivityItem[] }
  | { status: "error"; message: string };

export type ClientMatterOverlayProps = {
  clientCode: string;
  caseHint?: string;
  items: OfficeItem[];
  onClose: () => void;
  togglingKey?: string | null;
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onTogglePrepChecklistItem?: (item: ItemSummary, itemIndex: number, checked: boolean) => void;
  onMutatePrepChecklistItem?: (item: ItemSummary, mutation: PrepChecklistMutation) => void | Promise<void>;
  onCreatePrepChecklist?: (item: ItemSummary) => void;
  onInitializePrepChecklist?: (item: ItemSummary) => void;
  prepChecklistCreatingKey?: string | null;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  formOptions?: EntryFormOptions;
  isAdmin?: boolean;
  onClientCodeRenamed?: (newCode: string) => void;
  onNotice?: (message: string, isError?: boolean) => void;
};

function displayValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "number") return String(value);
  const trimmed = value.trim();
  return trimmed || "—";
}

function accountStatusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("overdue")) return "client-matter-panel__stat-value--warn";
  if (s.includes("closed")) return "client-matter-panel__stat-value--muted";
  return "";
}

export function ClientMatterOverlay({
  clientCode,
  caseHint,
  items,
  onClose,
  togglingKey,
  onToggleDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onTogglePrepChecklistItem,
  onMutatePrepChecklistItem,
  onCreatePrepChecklist,
  onInitializePrepChecklist,
  prepChecklistCreatingKey,
  onSaveEdit,
  onCourtConfirmed,
  formOptions,
  isAdmin = false,
  onClientCodeRenamed,
  onNotice
}: ClientMatterOverlayProps) {
  const { data: session } = useSession();
  const billingAccess = session?.user?.billingAccess !== false;
  const viewerPrepRole = useMemo(
    () => resolvePrepRoleFromSession(session?.user, []),
    [session?.user]
  );
  const [renameBusy, setRenameBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [billingState, setBillingState] = useState<BillingFetchState>({ status: "idle" });

  const clientContext = useMemo(
    () =>
      billingState.status === "ready"
        ? matterClientContextFromDetail({
            code: billingState.client.code,
            name: billingState.client.name,
            caseTitle: billingState.client.caseTitle,
            caseNumber: billingState.client.caseNumber
          })
        : null,
    [billingState]
  );

  const taskGroupCode = useMemo(() => {
    if (billingState.status === "ready") {
      return resolveTaskGroupCode(billingState.client.code, billingState.client);
    }
    return resolveTaskGroupCode(clientCode, null);
  }, [billingState, clientCode]);

  const matterKey =
    billingState.status === "ready" ? billingState.client.code.trim().toUpperCase() : clientCode;

  const { tasks, events, clientLabels } = useMemo(() => {
    if (billingAccess && !clientContext) {
      return { tasks: [], events: [], clientLabels: [] as string[] };
    }
    return groupItemsByClientCode(items, matterKey, taskGroupCode, clientContext);
  }, [billingAccess, clientContext, items, matterKey, taskGroupCode]);

  const caseHintParsed = useMemo(() => parseClientCaseDisplay(caseHint), [caseHint]);
  const primaryLabelParsed = useMemo(
    () => (clientLabels[0] ? parseClientCaseDisplay(clientLabels[0]) : null),
    [clientLabels]
  );

  const matterLinkCode = clientCode.trim().toUpperCase();

  const profileTitle = useMemo(() => {
    const billingName = billingState.status === "ready" ? billingState.client.name?.trim() : "";
    if (billingName) return billingName;
    if (caseHintParsed.title && caseHintParsed.title !== "—") return caseHintParsed.title;
    if (primaryLabelParsed?.title && primaryLabelParsed.title !== "—") return primaryLabelParsed.title;
    return matterLinkCode;
  }, [billingState, caseHintParsed.title, matterLinkCode, primaryLabelParsed?.title]);

  const caseLine = useMemo(() => {
    if (billingState.status === "ready") {
      return formatMatterCaseCaption({
        matterType: billingState.client.matterType,
        caseTitle: billingState.client.caseTitle,
        retainerBalance: billingState.client.retainerBalance
      });
    }
    if (caseHintParsed.subtitle) return formatMatterCaseCaption({ matterType: "case", caseTitle: caseHintParsed.subtitle });
    if (primaryLabelParsed?.subtitle) {
      return formatMatterCaseCaption({ matterType: "case", caseTitle: primaryLabelParsed.subtitle });
    }
    if (clientLabels.length > 1) return clientLabels.slice(1).join(" · ");
    return null;
  }, [billingState, caseHintParsed.subtitle, clientLabels, primaryLabelParsed?.subtitle]);

  const matterListLabel = caseLine ? `${profileTitle} — ${caseLine}` : profileTitle;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [timeline, setTimeline] = useState<ActivityItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDetailsOpen(false);
    setTimeline([]);
    setTimelineLoading(true);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [clientCode]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useBodyScrollLock(true);

  useEffect(() => {
    if (!billingAccess) {
      setBillingState({ status: "unavailable" });
      return;
    }

    let cancelled = false;
    setBillingState({ status: "loading" });

    const params = new URLSearchParams();
    if (caseHint?.trim()) params.set("case", caseHint.trim());

    fetch(`/api/tasks/client-billing/${encodeURIComponent(clientCode)}?${params}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (!response.ok) {
          setBillingState({
            status: "error",
            message: typeof payload.error === "string" ? payload.error : "Could not load billing record."
          });
          return;
        }

        if (payload.available === false) {
          setBillingState({ status: "unavailable" });
          return;
        }

        if (!payload.found || !payload.client) {
          setBillingState({ status: "not_found" });
          return;
        }

        const client = payload.client as TaskBillingClient;
        if (!billingClientMatchesMatterCode(clientCode, client)) {
          setBillingState({ status: "not_found" });
          return;
        }

        setBillingState({
          status: "ready",
          client,
          activity: Array.isArray(payload.activity) ? payload.activity : []
        });
      })
      .catch(() => {
        if (!cancelled) {
          setBillingState({ status: "error", message: "Could not load billing record." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [billingAccess, caseHint, clientCode]);

  useEffect(() => {
    let cancelled = false;

    async function buildTimeline() {
      setTimelineLoading(true);

      const billingItems =
        billingState.status === "ready"
          ? billingState.activity.filter(
              (item) => item.kind !== "task" && item.kind !== "hearing" && item.kind !== "task-action"
            )
          : [];

      let taskActivity: TaskActivityEntry[] = [];
      try {
        const response = await fetch(
          `/api/tasks/activity?clientCode=${encodeURIComponent(clientCode)}&limit=40`
        );
        const payload = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(payload.activity)) {
          taskActivity = payload.activity as TaskActivityEntry[];
        }
      } catch {
        /* optional */
      }

      if (!cancelled) {
        setTimeline(
          mergeTaskTimelineItems(clientCode, billingItems, {
            taskItems: items,
            taskActivity,
            taskGroupCode,
            clientContext
          })
        );
        setTimelineLoading(false);
      }
    }

    if (billingState.status === "loading" || billingState.status === "idle") {
      return () => {
        cancelled = true;
      };
    }

    void buildTimeline();
    return () => {
      cancelled = true;
    };
  }, [billingState, clientCode, clientContext, items, taskGroupCode]);

  const handleMatterJump = useCallback((anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const cardProps = {
    allItems: items,
    onToggleDone,
    onSetStatus,
    onResetWithDate,
    onDeleteItem,
    onUpdateNextAction,
    onTogglePrepChecklistItem,
    onMutatePrepChecklistItem,
    onCreatePrepChecklist,
    onInitializePrepChecklist,
    onSaveEdit,
    onCourtConfirmed,
    formOptions,
    togglingKey,
    viewerPrepRole
  };

  const billingClient = billingState.status === "ready" ? billingState.client : null;
  const accountStatus = billingClient
    ? displayValue(billingClient.accountStatus || billingClient.status)
    : null;
  const openTasks = tasks.filter((t) => !t.done).length;
  const openEvents = events.filter((e) => !e.done).length;
  const matterLinkHint = caseHint?.trim() || clientLabels[0] || undefined;

  if (!mounted) return null;

  return createPortal(
    <div className="client-matter-overlay no-print" role="dialog" aria-modal="true" aria-labelledby="client-matter-title">
      <button type="button" className="client-matter-overlay__backdrop" aria-label="Close client view" onClick={onClose} />

      <div className="client-matter-panel">
        <div className="client-matter-panel__accent" aria-hidden />

        <button type="button" className="client-matter-panel__close" onClick={onClose} aria-label="Close client profile">
          <svg
            className="client-matter-panel__close-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          <span className="client-matter-panel__close-label">Close</span>
        </button>

        <div className="client-matter-panel__scroll" ref={scrollRef}>
          <header className="client-matter-panel__header">
            <div className="client-matter-panel__identity">
              <span className="client-matter-panel__code">{matterLinkCode}</span>
              <div className="client-matter-panel__title-block">
                <h2 id="client-matter-title" className="client-matter-panel__name">
                  {profileTitle}
                </h2>
                {caseLine ? <p className="client-matter-panel__case">{caseLine}</p> : null}
              </div>
            </div>

            {billingState.status === "loading" ? (
              <p className="client-matter-panel__status-line" aria-live="polite">
                Loading billing…
              </p>
            ) : null}

            {billingState.status === "error" ? (
              <p className="client-matter-panel__status-line client-matter-panel__status-line--warn">
                {billingState.message}
              </p>
            ) : null}

            {billingState.status === "not_found" && billingAccess ? (
              <p className="client-matter-panel__status-line">
                No billing record for this code — showing tasks only.
              </p>
            ) : null}

            {billingClient && billingAccess ? (
              <>
                <div className="client-matter-panel__stats">
                  <div className="client-matter-panel__stat client-matter-panel__stat--balance">
                    <span className="client-matter-panel__stat-label">Balance</span>
                    <span className="client-matter-panel__stat-value client-matter-panel__stat-value--balance">
                      {formatPeso(billingClient.balance)}
                    </span>
                  </div>
                  <div className="client-matter-panel__stat">
                    <span className="client-matter-panel__stat-label">Account</span>
                    <span
                      className={`client-matter-panel__stat-value ${accountStatusTone(accountStatus || "")}`}
                    >
                      {accountStatus}
                    </span>
                  </div>
                  <div className="client-matter-panel__stat client-matter-panel__stat--wide">
                    <span className="client-matter-panel__stat-label">Attorney</span>
                    <span className="client-matter-panel__stat-value">
                      {displayValue(billingClient.assignedAttorney)}
                    </span>
                  </div>
                </div>

                <div className="client-matter-panel__header-actions">
                  <MatterLink
                    code={matterLinkCode}
                    extra={{ case: matterLinkHint }}
                    className="client-matter-panel__billing-link"
                  >
                    Open matter page →
                  </MatterLink>
                  {isAdmin ? (
                    <ClientCodeRenameForm
                      currentCode={billingClient.code}
                      busy={renameBusy}
                      compact
                      onBusy={setRenameBusy}
                      onStatus={(message, isError) => onNotice?.(message, isError)}
                      onRenamed={(newCode) => onClientCodeRenamed?.(newCode)}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="client-matter-panel__details-toggle"
                    onClick={() => setDetailsOpen((open) => !open)}
                    aria-expanded={detailsOpen}
                    aria-controls="client-matter-more"
                  >
                    {detailsOpen ? "Less detail" : "Contact & dates"}
                  </button>
                </div>

                <div
                  id="client-matter-more"
                  className={`client-matter-panel__more ${detailsOpen ? "client-matter-panel__more--open" : ""}`}
                >
                  <dl className="client-matter-panel__more-grid">
                    <div>
                      <dt>File type</dt>
                      <dd>
                        {CLIENT_MATTER_TYPE_LABELS[
                          resolveClientMatterType({
                            matterType: billingClient.matterType,
                            caseTitle: billingClient.caseTitle,
                            retainerBalance: billingClient.retainerBalance
                          })
                        ]}
                      </dd>
                    </div>
                    {formatMatterCaseCaption(billingClient) ? (
                      <div className="client-matter-panel__more-span">
                        <dt>Case</dt>
                        <dd>{formatMatterCaseCaption(billingClient)}</dd>
                      </div>
                    ) : null}
                    {formatClientCaseTypeLabel(billingClient.caseType, billingClient.caseTypeOther) ? (
                      <div>
                        <dt>Case type</dt>
                        <dd>{formatClientCaseTypeLabel(billingClient.caseType, billingClient.caseTypeOther)}</dd>
                      </div>
                    ) : null}
                    {billingClient.caseRole.trim() ? (
                      <div>
                        <dt>Role in case</dt>
                        <dd>{displayValue(billingClient.caseRole)}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Case no.</dt>
                      <dd>{displayValue(billingClient.caseNumber)}</dd>
                    </div>
                    {billingClient.courtPending.trim() ? (
                      <div className="client-matter-panel__more-span">
                        <dt>Court</dt>
                        <dd>{billingClient.courtPending.trim()}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Last billing</dt>
                      <dd>{displayValue(billingClient.lastBillingDate)}</dd>
                    </div>
                    <div>
                      <dt>Next follow-up</dt>
                      <dd>{displayValue(billingClient.nextFollowUp)}</dd>
                    </div>
                    <div>
                      <dt>Last activity</dt>
                      <dd>{displayValue(billingClient.lastActivity)}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{displayValue(billingClient.email)}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{displayValue(billingClient.phone)}</dd>
                    </div>
                    {billingClient.retainerBalance > 0.005 ? (
                      <div>
                        <dt>Retainer</dt>
                        <dd>{formatPeso(billingClient.retainerBalance)}</dd>
                      </div>
                    ) : null}
                    {billingClient.address.trim() ? (
                      <div className="client-matter-panel__more-span">
                        <dt>Address</dt>
                        <dd>{billingClient.address.trim()}</dd>
                      </div>
                    ) : null}
                    {showPsychologistFields(billingClient) ? (
                      <>
                        <div>
                          <dt>Psychologist</dt>
                          <dd>{displayValue(billingClient.psychologistName)}</dd>
                        </div>
                        <div>
                          <dt>Psychologist contact</dt>
                          <dd>{displayValue(billingClient.psychologistPhone)}</dd>
                        </div>
                        <div className="client-matter-panel__more-span">
                          <dt>Psychologist address</dt>
                          <dd>{displayValue(billingClient.psychologistAddress)}</dd>
                        </div>
                      </>
                    ) : null}
                  </dl>
                </div>
              </>
            ) : (
              <div className="client-matter-panel__stats client-matter-panel__stats--compact">
                <div className="client-matter-panel__stat">
                  <span className="client-matter-panel__stat-label">Open tasks</span>
                  <span className="client-matter-panel__stat-value">{openTasks}</span>
                </div>
                <div className="client-matter-panel__stat">
                  <span className="client-matter-panel__stat-label">Open events</span>
                  <span className="client-matter-panel__stat-value">{openEvents}</span>
                </div>
              </div>
            )}
          </header>

          <div className="client-matter-panel__body">
            <section className="client-matter-panel__section client-matter-panel__section--timeline">
              <div className="client-matter-panel__section-head">
                <h3 className="client-matter-panel__section-title">Matter timeline</h3>
                <span className="client-matter-panel__section-count">
                  {billingAccess ? "Billing, documents, tasks & hearings" : "Tasks & hearings"}
                </span>
              </div>
              <div className="client-matter-panel__timeline">
                <ClientActivityTimeline
                  items={timeline}
                  loading={timelineLoading}
                  enableMatterJump
                  onMatterJump={handleMatterJump}
                  coloredDots
                  showDotLegend
                />
              </div>
            </section>

            <div className="client-matter-panel__columns">
              <section className="client-matter-panel__section">
                <div className="client-matter-panel__section-head">
                  <h3 className="client-matter-panel__section-title">Tasks</h3>
                  <span className="client-matter-panel__section-count">
                    {tasks.length} total · {openTasks} open
                  </span>
                </div>
                {tasks.length === 0 ? (
                  <EmptyState compact title="No tasks" message={`Nothing under ${matterListLabel} yet.`} />
                ) : (
                  <div className="client-matter-panel__items">
                    <ul className="my-work-list my-work-panel--elegant">
                    {tasks.map((item, index) => {
                      const key = officeItemKey(item, index);
                      return (
                        <ItemCard
                          key={key}
                          id={matterItemAnchorId(item)}
                          className="matter-item-anchor scroll-mt-6"
                          item={item}
                          toggling={togglingKey === key}
                          prepChecklistCreating={prepChecklistCreatingKey === key}
                          {...cardProps}
                        />
                      );
                    })}
                    </ul>
                  </div>
                )}
              </section>

              <section className="client-matter-panel__section">
                <div className="client-matter-panel__section-head">
                  <h3 className="client-matter-panel__section-title">Hearings & events</h3>
                  <span className="client-matter-panel__section-count">
                    {events.length} total · {openEvents} open
                  </span>
                </div>
                {events.length === 0 ? (
                  <EmptyState compact title="No events" message={`No hearings or filings under ${matterListLabel} yet.`} />
                ) : (
                  <div className="client-matter-panel__items">
                    <ul className="my-work-list my-work-panel--elegant">
                    {events.map((item, index) => {
                      const key = officeItemKey(item, index);
                      return (
                        <ItemCard
                          key={key}
                          id={matterItemAnchorId(item)}
                          className="matter-item-anchor scroll-mt-6"
                          item={item}
                          toggling={togglingKey === key}
                          prepChecklistCreating={prepChecklistCreatingKey === key}
                          {...cardProps}
                        />
                      );
                    })}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        <footer className="client-matter-panel__footer">
          <MatterLink
            code={matterLinkCode}
            extra={{ case: matterLinkHint }}
            className="btn-gold client-matter-panel__matter-link"
          >
            Open matter page →
          </MatterLink>
        </footer>
      </div>
    </div>,
    document.body
  );
}
