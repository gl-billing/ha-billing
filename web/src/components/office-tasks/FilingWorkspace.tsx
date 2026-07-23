"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { CivilEFilingDialog } from "@/components/office-tasks/CivilEFilingDialog";
import { FirmPrintLetterhead } from "@/components/FirmPrintLetterhead";
import { SameWindowLink } from "@/components/SameWindowLink";
import { firmLogoPublicUrl } from "@/lib/firm-logo-url";
import { todayYmd } from "@/lib/office-tasks/date-only";
import {
  assigneeMatchesStaff,
  countFilingQueues,
  countFilingStatusStrip,
  filingColumnsForQueue,
  filingRowUrgency,
  filingStatusShortLabel,
  filingUrgencyLabel,
  sortFilingRowsByDeadline,
  type FilingColumnId
} from "@/lib/office-tasks/filing-workspace-view";
import {
  FILING_PHYSICAL_MANNERS,
  FILING_QUEUE_STATUSES,
  type FilingCopyFurnishedParty,
  type FilingQueueRow
} from "@/lib/office-tasks/filing-queue-types";
import type { FilingQueueKind } from "@/lib/office-tasks/filing-queue-route";
import { parseApiJson } from "@/lib/parse-api-response";

type Props = {
  queue: FilingQueueKind;
  onQueueChange: (queue: FilingQueueKind) => void;
  onStatus?: (message: string, isError?: boolean) => void;
  sessionStaffName?: string;
  todayHref?: string;
};

type StatusFilter = "all" | (typeof FILING_QUEUE_STATUSES)[number] | "overdue";
type PrintMode = "cover" | "checklist";

export function FilingWorkspace({
  queue,
  onQueueChange,
  onStatus,
  sessionStaffName = "",
  todayHref = "/app?tab=today"
}: Props) {
  const [allRows, setAllRows] = useState<FilingQueueRow[]>([]);
  const [staff, setStaff] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [savedPulse, setSavedPulse] = useState<number | null>(null);
  const [emailItem, setEmailItem] = useState<ItemSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [printJob, setPrintJob] = useState<{ row: FilingQueueRow; mode: PrintMode } | null>(null);
  const [cfFocusRow, setCfFocusRow] = useState<number | null>(null);

  const isElectronic = queue === "e-filing";
  const today = todayYmd();
  const emptyMessage = isElectronic ? "No for e-filing today" : "No for filing today";
  const logoSrc = firmLogoPublicUrl();

  const columns = useMemo(
    () => filingColumnsForQueue(queue, showAllColumns),
    [queue, showAllColumns]
  );

  const rows = useMemo(() => allRows.filter((row) => row.queue === queue), [allRows, queue]);
  const queueCounts = useMemo(() => countFilingQueues(allRows), [allRows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks/filing-queue");
      const { ok, data, errorMessage } = await parseApiJson<{
        rows?: FilingQueueRow[];
        staff?: string[];
        error?: string;
      }>(res);
      if (!ok) throw new Error(errorMessage || "Failed to load filing queue.");
      setAllRows(data.rows || []);
      setStaff(data.staff || []);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelected(new Set());
  }, [queue]);

  useEffect(() => {
    if (!printJob) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPrintJob(null);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [printJob]);

  function pulseSaved(sheetRow: number) {
    setSavedPulse(sheetRow);
    window.setTimeout(() => {
      setSavedPulse((prev) => (prev === sheetRow ? null : prev));
    }, 1400);
  }

  async function savePatch(sheetRow: number, patch: Record<string, unknown>) {
    setSavingRow(sheetRow);
    try {
      const res = await fetch("/api/tasks/filing-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetRow, patch })
      });
      const { ok, data, errorMessage } = await parseApiJson<{ row?: FilingQueueRow; error?: string }>(res);
      if (!ok || !data.row) throw new Error(errorMessage || "Save failed.");
      setAllRows((prev) => prev.map((r) => (r.sheetRow === sheetRow ? data.row! : r)));
      pulseSaved(sheetRow);
      return data.row;
    } catch (err) {
      onStatus?.(err instanceof Error ? err.message : "Save failed.", true);
      return null;
    } finally {
      setSavingRow(null);
    }
  }

  function updateLocal(sheetRow: number, patch: Partial<FilingQueueRow>) {
    setAllRows((prev) => prev.map((r) => (r.sheetRow === sheetRow ? { ...r, ...patch } : r)));
  }

  const sortedRows = useMemo(() => sortFilingRowsByDeadline(rows), [rows]);

  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      if (mineOnly && sessionStaffName && !assigneeMatchesStaff(row.assignedTo, sessionStaffName)) {
        return false;
      }
      if (assigneeFilter !== "all" && row.assignedTo !== assigneeFilter) return false;
      if (statusFilter === "overdue") return filingRowUrgency(row, today) === "overdue";
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      return true;
    });
  }, [sortedRows, mineOnly, sessionStaffName, assigneeFilter, statusFilter, today]);

  const stripCounts = useMemo(() => countFilingStatusStrip(rows, today), [rows, today]);
  const selectedCount = filteredRows.filter((r) => selected.has(r.sheetRow)).length;

  async function bulkSetStatus(status: "Out" | "Filed/served") {
    const targets = filteredRows.filter((r) => selected.has(r.sheetRow));
    if (!targets.length) {
      onStatus?.("Select one or more rows first.", true);
      return;
    }
    setBulkBusy(true);
    try {
      for (const row of targets) {
        updateLocal(row.sheetRow, { status });
        await savePatch(row.sheetRow, { status });
      }
      onStatus?.(`Updated ${targets.length} filing${targets.length === 1 ? "" : "s"} to ${status}.`);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleSelect(sheetRow: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sheetRow)) next.delete(sheetRow);
      else next.add(sheetRow);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const ids = filteredRows.map((r) => r.sheetRow);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function openEmailCourt(row: FilingQueueRow) {
    setEmailItem({
      source: "Event",
      id: row.eventId,
      rowNumber: row.eventRow || 0,
      date: row.deadline || null,
      eventDate: null,
      filingDeadline: row.deadline || null,
      clientCase: row.clientCaseLabel || row.clientParty,
      assignedTo: row.assignedTo,
      category: row.pleading,
      priority: "Medium",
      status: "Submitted",
      details: "",
      nextAction: "",
      venue: row.whereFiled,
      startTime: null,
      done: true,
      remarks: "",
      reminderDays: 0,
      calendarSync: false,
      platform: "",
      filingMode: "Electronic filing",
      pleadingType: "Responsive pleading",
      pleadingCaseNature: "Civil",
      receivedDate: null,
      periodToFileDays: 0,
      filingDate: row.dateFiled || null
    });
  }

  function colVisible(id: FilingColumnId): boolean {
    return columns.some((c) => c.id === id);
  }

  function stickyClassFor(id: FilingColumnId, sticky?: boolean): string | undefined {
    if (id === "pleading") return "filing-workspace__sticky filing-workspace__sticky--pleading";
    if (id === "clientParty") return "filing-workspace__sticky filing-workspace__sticky--client";
    if (id === "status") return "filing-workspace__sticky filing-workspace__sticky--status";
    return sticky ? "filing-workspace__sticky" : undefined;
  }

  return (
    <section className="filing-workspace" aria-label="Filing queues">
      <div className="filing-workspace__screen no-print">
        <header className="filing-workspace__band">
          <div className="filing-workspace__band-top">
            <div className="filing-workspace__band-copy">
              <p className="view-eyebrow">Filing</p>
              <h2 className="filing-workspace__title">
                {isElectronic ? "E-filing queue" : "Physical filing queue"}
              </h2>
            </div>
            <div className="filing-workspace__tabs" role="tablist" aria-label="Filing queue type">
              <button
                type="button"
                role="tab"
                aria-selected={isElectronic}
                className={
                  isElectronic ? "filing-workspace__tab filing-workspace__tab--active" : "filing-workspace__tab"
                }
                onClick={() => onQueueChange("e-filing")}
              >
                E-filing <span className="filing-workspace__tab-count">{queueCounts.eFiling}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isElectronic}
                className={
                  !isElectronic ? "filing-workspace__tab filing-workspace__tab--active" : "filing-workspace__tab"
                }
                onClick={() => onQueueChange("physical")}
              >
                Physical <span className="filing-workspace__tab-count">{queueCounts.physical}</span>
              </button>
            </div>
          </div>
          {!loading ? (
            <div className="filing-workspace__microstats" role="group" aria-label="Queue status">
              {(
                [
                  ["Queued", stripCounts.queued, "Queued"],
                  ["Out", stripCounts.out, "Out"],
                  ["Filed", stripCounts.filed, "Filed/served"],
                  ["Proof", stripCounts.proof, "Proof complete"],
                  ["Overdue", stripCounts.overdue, "overdue"]
                ] as const
              ).map(([label, value, filter]) => (
                <button
                  key={label}
                  type="button"
                  className={
                    statusFilter === filter
                      ? `filing-workspace__microstat filing-workspace__microstat--${label.toLowerCase()} filing-workspace__microstat--on`
                      : `filing-workspace__microstat filing-workspace__microstat--${label.toLowerCase()}`
                  }
                  onClick={() =>
                    setStatusFilter((prev) => (prev === filter ? "all" : (filter as StatusFilter)))
                  }
                >
                  <strong>{value}</strong>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {!loading && rows.length ? (
          <div className="filing-workspace__filters">
            <label className="filing-workspace__filter">
              <span className="filing-workspace__filter-icon" aria-hidden>
                ◇
              </span>
              <select
                className="field filing-workspace__filter-control"
                aria-label="Assigned to"
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
              >
                <option value="all">Everyone</option>
                {staff.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="filing-workspace__filter">
              <span className="filing-workspace__filter-icon" aria-hidden>
                ▤
              </span>
              <select
                className="field filing-workspace__filter-control"
                aria-label="Status filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="overdue">Overdue</option>
                {FILING_QUEUE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {sessionStaffName ? (
              <label className="filing-workspace__check">
                <input
                  type="checkbox"
                  checked={mineOnly}
                  onChange={(e) => setMineOnly(e.target.checked)}
                />
                Mine
              </label>
            ) : null}
            <label className="filing-workspace__check">
              <input
                type="checkbox"
                checked={showAllColumns}
                onChange={(e) => setShowAllColumns(e.target.checked)}
              />
              All columns
            </label>
          </div>
        ) : null}

        {error ? <p className="filing-workspace__error">{error}</p> : null}
        {loading ? <p className="panel-loading">Loading…</p> : null}

        {!loading && !rows.length ? (
          <div className="filing-workspace__empty">
            <img src={logoSrc} alt="" className="filing-workspace__empty-logo" width={72} height={72} />
            <p className="filing-workspace__empty-message">{emptyMessage}</p>
            <SameWindowLink href={todayHref} className="filing-workspace__empty-cta">
              Mark a pleading filed on Today to land it here.
            </SameWindowLink>
          </div>
        ) : null}

        {!loading && rows.length && !filteredRows.length ? (
          <div className="filing-workspace__empty filing-workspace__empty--compact">
            <p className="filing-workspace__empty-message">No filings match these filters.</p>
          </div>
        ) : null}

        {!loading && filteredRows.length ? (
          <div className="filing-workspace__table-wrap">
            <table className="filing-workspace__table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      scope="col"
                      className={stickyClassFor(col.id, col.sticky)}
                      style={col.sticky ? { left: col.stickyOffset } : undefined}
                    >
                      {col.id === "select" ? (
                        <input
                          type="checkbox"
                          aria-label="Select all visible"
                          checked={
                            filteredRows.length > 0 &&
                            filteredRows.every((r) => selected.has(r.sheetRow))
                          }
                          onChange={toggleSelectAllVisible}
                        />
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const busy = savingRow === row.sheetRow;
                  const urgency = filingRowUrgency(row, today);
                  const pulsed = savedPulse === row.sheetRow;
                  return (
                    <tr
                      key={row.sheetRow}
                      title={filingUrgencyLabel(urgency)}
                      className={[
                        `filing-workspace__row--${urgency}`,
                        pulsed ? "filing-workspace__row--saved" : "",
                        busy ? "filing-workspace__row--busy" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {colVisible("select") ? (
                        <td className="filing-workspace__sticky" style={{ left: "0" }}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${row.pleading || "filing"}`}
                            checked={selected.has(row.sheetRow)}
                            onChange={() => toggleSelect(row.sheetRow)}
                          />
                        </td>
                      ) : null}
                      {colVisible("created") ? (
                        <td>
                          <span className="filing-workspace__readonly">{row.created || "—"}</span>
                        </td>
                      ) : null}
                      {colVisible("eventId") ? (
                        <td>
                          <span className="filing-workspace__readonly filing-workspace__mono">
                            {row.eventId || "—"}
                          </span>
                        </td>
                      ) : null}
                      {colVisible("clientCode") ? (
                        <td>
                          <TextCell
                            label="Client code"
                            value={row.clientCode}
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { clientCode: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { clientCode: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("pleading") ? (
                        <td
                          className="filing-workspace__sticky filing-workspace__sticky--pleading"
                          style={{ left: "2.5rem" }}
                        >
                          <TextCell
                            label="Pleading"
                            value={row.pleading}
                            wide
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { pleading: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { pleading: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("clientParty") ? (
                        <td
                          className="filing-workspace__sticky filing-workspace__sticky--client"
                          style={{ left: "13.5rem" }}
                        >
                          <TextCell
                            label="Client / party"
                            value={row.clientParty}
                            wide
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { clientParty: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { clientParty: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("whereFiled") ? (
                        <td>
                          <TextCell
                            label="Where filed"
                            value={row.whereFiled}
                            wide
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { whereFiled: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { whereFiled: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("courtAddress") ? (
                        <td>
                          <TextCell
                            label="Court address"
                            value={row.courtAddress}
                            wide
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { courtAddress: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { courtAddress: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("courtEmail") ? (
                        <td>
                          <TextCell
                            label="Court email"
                            value={row.courtEmail}
                            wide
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { courtEmail: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { courtEmail: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("copyFurnished") ? (
                        <td>
                          <CopyFurnishedInline
                            parties={row.copyFurnished}
                            expanded={cfFocusRow === row.sheetRow}
                            disabled={busy}
                            onFocusRow={() => setCfFocusRow(row.sheetRow)}
                            onBlurRow={() =>
                              setCfFocusRow((prev) => (prev === row.sheetRow ? null : prev))
                            }
                            onChange={(copyFurnished) => {
                              updateLocal(row.sheetRow, { copyFurnished });
                              void savePatch(row.sheetRow, { copyFurnished });
                            }}
                          />
                        </td>
                      ) : null}
                      {colVisible("manner") ? (
                        <td>
                          <div className="filing-workspace__manner">
                            {!isElectronic ? (
                              <div className="filing-workspace__manner-chips">
                                {FILING_PHYSICAL_MANNERS.map((m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    className={
                                      row.manner === m
                                        ? "filing-workspace__chip filing-workspace__chip--on"
                                        : "filing-workspace__chip"
                                    }
                                    disabled={busy}
                                    onClick={() => {
                                      updateLocal(row.sheetRow, { manner: m });
                                      void savePatch(row.sheetRow, { manner: m });
                                    }}
                                  >
                                    {m === "Registered mail"
                                      ? "Reg mail"
                                      : m === "Personal service"
                                        ? "Personal"
                                        : "Courier"}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <select
                                className="field filing-workspace__field"
                                aria-label="Manner"
                                value={row.manner}
                                disabled={busy}
                                onChange={(e) => {
                                  updateLocal(row.sheetRow, { manner: e.target.value });
                                  void savePatch(row.sheetRow, { manner: e.target.value });
                                }}
                              >
                                <option value="">—</option>
                                {FILING_PHYSICAL_MANNERS.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                      ) : null}
                      {colVisible("assignedTo") ? (
                        <td>
                          <select
                            className="field filing-workspace__field"
                            aria-label="Assigned to"
                            value={row.assignedTo}
                            disabled={busy}
                            onChange={(e) => {
                              updateLocal(row.sheetRow, { assignedTo: e.target.value });
                              void savePatch(row.sheetRow, { assignedTo: e.target.value });
                            }}
                          >
                            <option value="">—</option>
                            {staff.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                            {row.assignedTo && !staff.includes(row.assignedTo) ? (
                              <option value={row.assignedTo}>{row.assignedTo}</option>
                            ) : null}
                          </select>
                        </td>
                      ) : null}
                      {colVisible("status") ? (
                        <td
                          className="filing-workspace__sticky filing-workspace__sticky--status"
                          style={{ left: "24.5rem" }}
                        >
                          <StatusPills
                            value={String(row.status || "Queued")}
                            disabled={busy}
                            onChange={(status) => {
                              updateLocal(row.sheetRow, { status });
                              void savePatch(row.sheetRow, { status });
                            }}
                          />
                        </td>
                      ) : null}
                      {colVisible("deadline") ? (
                        <td>
                          <TextCell
                            label="Deadline"
                            value={row.deadline}
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { deadline: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { deadline: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("dateFiled") ? (
                        <td>
                          <TextCell
                            label="Date filed"
                            value={row.dateFiled}
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { dateFiled: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { dateFiled: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("trackingOrAck") ? (
                        <td>
                          <TextCell
                            label="Tracking / ACK"
                            value={row.trackingOrAck}
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { trackingOrAck: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { trackingOrAck: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("proof") ? (
                        <td>
                          <TextCell
                            label="Proof"
                            value={row.proof}
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { proof: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { proof: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("notes") ? (
                        <td>
                          <TextCell
                            label="Notes"
                            value={row.notes}
                            wide
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { notes: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { notes: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("clientCase") ? (
                        <td>
                          <TextCell
                            label="Client case"
                            value={row.clientCaseLabel}
                            wide
                            busy={busy}
                            onLocal={(v) => updateLocal(row.sheetRow, { clientCaseLabel: v })}
                            onSave={(v) => void savePatch(row.sheetRow, { clientCaseLabel: v })}
                          />
                        </td>
                      ) : null}
                      {colVisible("actions") ? (
                        <td>
                          <div className="filing-workspace__actions">
                            {row.clientCode ? (
                              <SameWindowLink
                                href={`/matter/${encodeURIComponent(row.clientCode)}`}
                                className="filing-workspace__matter-link"
                              >
                                Open matter
                              </SameWindowLink>
                            ) : null}
                            {isElectronic ? (
                              <button
                                type="button"
                                className="btn-secondary text-xs whitespace-nowrap"
                                disabled={!row.eventId || busy}
                                onClick={() => openEmailCourt(row)}
                              >
                                Email court
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn-secondary text-xs whitespace-nowrap"
                                  disabled={busy}
                                  onClick={() => setPrintJob({ row, mode: "cover" })}
                                >
                                  Print cover
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary text-xs whitespace-nowrap"
                                  disabled={busy}
                                  onClick={() => setPrintJob({ row, mode: "checklist" })}
                                >
                                  Checklist
                                </button>
                              </>
                            )}
                            {pulsed ? <span className="filing-workspace__saved">Saved</span> : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {selectedCount > 0 ? (
          <div className="filing-workspace__selection-bar" role="status">
            <span>
              {selectedCount} selected
            </span>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={bulkBusy}
              onClick={() => void bulkSetStatus("Out")}
            >
              Mark Out
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={bulkBusy}
              onClick={() => void bulkSetStatus("Filed/served")}
            >
              Mark Filed
            </button>
            <button
              type="button"
              className="filing-workspace__selection-clear"
              disabled={bulkBusy}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        ) : null}

        <CivilEFilingDialog
          item={emailItem}
          open={Boolean(emailItem)}
          onClose={() => setEmailItem(null)}
          onStatus={onStatus}
          onSent={() => void load()}
        />
      </div>

      {printJob ? <FilingPrintSheet row={printJob.row} mode={printJob.mode} /> : null}
    </section>
  );
}

function StatusPills({
  value,
  disabled,
  onChange
}: {
  value: string;
  disabled?: boolean;
  onChange: (status: string) => void;
}) {
  return (
    <div className="filing-workspace__status-pills" role="group" aria-label="Status">
      {FILING_QUEUE_STATUSES.map((status) => {
        const slug = filingStatusShortLabel(status).toLowerCase();
        const on = value === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            className={
              on
                ? `filing-workspace__status-pill filing-workspace__status-pill--${slug} filing-workspace__status-pill--on`
                : `filing-workspace__status-pill filing-workspace__status-pill--${slug}`
            }
            aria-pressed={on}
            onClick={() => onChange(status)}
          >
            {filingStatusShortLabel(status)}
          </button>
        );
      })}
    </div>
  );
}

function TextCell({
  label,
  value,
  busy,
  wide,
  onLocal,
  onSave
}: {
  label: string;
  value: string;
  busy?: boolean;
  wide?: boolean;
  onLocal: (value: string) => void;
  onSave: (value: string) => void;
}) {
  return (
    <input
      className={`field filing-workspace__field${wide ? " filing-workspace__field--wide" : ""}`}
      aria-label={label}
      value={value}
      disabled={busy}
      onChange={(e) => onLocal(e.target.value)}
      onBlur={(e) => onSave(e.target.value)}
    />
  );
}

function CopyFurnishedInline({
  parties,
  expanded,
  disabled,
  onFocusRow,
  onBlurRow,
  onChange
}: {
  parties: FilingCopyFurnishedParty[];
  expanded: boolean;
  disabled?: boolean;
  onFocusRow: () => void;
  onBlurRow: () => void;
  onChange: (next: FilingCopyFurnishedParty[]) => void;
}) {
  const list = parties.length ? parties : [{ name: "" }];

  function setAt(index: number, patch: Partial<FilingCopyFurnishedParty>) {
    const next = list.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange(next.filter((p) => p.name.trim() || p.address?.trim() || p.email?.trim()));
  }

  return (
    <div
      className={`filing-workspace__cf ${expanded ? "filing-workspace__cf--expanded" : ""}`}
      onFocus={onFocusRow}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onBlurRow();
      }}
    >
      {list.map((party, index) => (
        <div key={index} className="filing-workspace__cf-stack">
          <input
            className="field filing-workspace__field"
            placeholder="Name"
            aria-label={`Copy furnished name ${index + 1}`}
            value={party.name}
            disabled={disabled}
            onChange={(e) => setAt(index, { name: e.target.value })}
            onBlur={() => onChange(list)}
          />
          {expanded ? (
            <>
              <input
                className="field filing-workspace__field"
                placeholder="Address"
                aria-label={`Copy furnished address ${index + 1}`}
                value={party.address || ""}
                disabled={disabled}
                onChange={(e) =>
                  setAt(index, { address: e.target.value, name: party.name || `Party ${index + 1}` })
                }
                onBlur={() => onChange(list)}
              />
              <input
                className="field filing-workspace__field"
                placeholder="Email"
                aria-label={`Copy furnished email ${index + 1}`}
                value={party.email || ""}
                disabled={disabled}
                onChange={(e) =>
                  setAt(index, { email: e.target.value, name: party.name || `Party ${index + 1}` })
                }
                onBlur={() => onChange(list)}
              />
            </>
          ) : party.address || party.email ? (
            <p className="filing-workspace__cf-preview">
              {[party.address, party.email].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        className="filing-workspace__cf-add"
        disabled={disabled}
        onClick={() => {
          onFocusRow();
          onChange([...list, { name: "" }]);
        }}
      >
        Add party
      </button>
    </div>
  );
}

function FilingPrintSheet({ row, mode }: { row: FilingQueueRow; mode: PrintMode }) {
  const title = mode === "cover" ? "Physical filing cover sheet" : "Physical filing checklist";
  return (
    <section className="filing-print only-print" aria-hidden>
      <FirmPrintLetterhead documentType={title} documentTitle={row.pleading || "Filing"} />
      <dl className="filing-print__meta">
        <div>
          <dt>Client / party</dt>
          <dd>{row.clientParty || "—"}</dd>
        </div>
        <div>
          <dt>Client case</dt>
          <dd>{row.clientCaseLabel || row.clientCode || "—"}</dd>
        </div>
        <div>
          <dt>Where filed</dt>
          <dd>{row.whereFiled || "—"}</dd>
        </div>
        <div>
          <dt>Court address</dt>
          <dd>{row.courtAddress || "—"}</dd>
        </div>
        <div>
          <dt>Manner</dt>
          <dd>{row.manner || "—"}</dd>
        </div>
        <div>
          <dt>Deadline</dt>
          <dd>{row.deadline || "—"}</dd>
        </div>
        <div>
          <dt>Assigned to</dt>
          <dd>{row.assignedTo || "—"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{row.status || "—"}</dd>
        </div>
      </dl>
      <h3 className="filing-print__heading">Copy furnished</h3>
      {row.copyFurnished.length ? (
        <ul className="filing-print__list">
          {row.copyFurnished.map((p, i) => (
            <li key={i}>
              <strong>{p.name}</strong>
              {p.address ? ` — ${p.address}` : ""}
              {p.email ? ` · ${p.email}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p>—</p>
      )}
      {mode === "checklist" ? (
        <>
          <h3 className="filing-print__heading">Desk checklist</h3>
          <ul className="filing-print__checks">
            <li>☐ Pleading packet printed and collated</li>
            <li>☐ Court address confirmed</li>
            <li>☐ Manner set (registered mail / personal / courier)</li>
            <li>☐ Copy furnished parties listed</li>
            <li>☐ Proof of service / registry form ready</li>
            <li>☐ Tracking / ACK field to complete after dispatch</li>
          </ul>
        </>
      ) : null}
      {row.notes ? (
        <>
          <h3 className="filing-print__heading">Notes</h3>
          <p>{row.notes}</p>
        </>
      ) : null}
    </section>
  );
}
