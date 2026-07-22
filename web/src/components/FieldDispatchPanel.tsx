"use client";

import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { TableSkeleton } from "@/components/Skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClientSummary, FieldDispatchEntry } from "@/lib/gl-config";
import {
  computeFieldDispatchAdvanceBreakdown,
  DEFAULT_FIELD_DISPATCH_STAFF,
  FIELD_DISPATCH_LOCATIONS,
  FIELD_DISPATCH_LOCATION_PRESETS,
  FIELD_DISPATCH_MEAL_ALLOWANCE,
  FIELD_DISPATCH_PURPOSES,
  FIELD_DISPATCH_TRAVEL_HOURS,
  fieldDispatchBillableTotal,
  fieldDispatchHasReturnedInput,
  fieldDispatchIsReconciled,
  fieldDispatchSalaryCredit,
  fieldDispatchSalaryCreditForEntry,
  fieldDispatchSpentAmount,
  formatFieldDispatchTravelHours,
  formatPeso
} from "@/lib/gl-config";
import { FieldDispatchCompanion } from "@/components/FieldDispatchCompanion";

type LocationStat = {
  location: string;
  tripCount: number;
  avgAdvance: number;
  avgExpenses: number;
  avgBillable: number;
  avgReturned: number;
  lastDate: string;
  lastAdvance: number;
};

type Props = {
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onStatus: (message: string, isError?: boolean) => void;
  clients: ClientSummary[];
  onOpenBilling?: (clientCode: string) => void;
};

function todayLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function dispatchStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "paid" || s === "closed") return "field-dispatch-panel__status--paid";
  if (s === "billed") return "field-dispatch-panel__status--billed";
  return "field-dispatch-panel__status--open";
}

type EditFormState = {
  dispatchId: string;
  reimbursementStatus: string;
  date: string;
  days: string;
  location: string;
  customLocation: string;
  staff: string;
  clientCode: string;
  purpose: string;
  advanceGiven: string;
  serviceFee: string;
  returnedToOffice: string;
  notes: string;
};

function locationFromEntry(loc: string): { location: string; customLocation: string } {
  if ((FIELD_DISPATCH_LOCATIONS as readonly string[]).includes(loc)) {
    return { location: loc, customLocation: "" };
  }
  return { location: "Other", customLocation: loc };
}

function previewSpent(advance: number, returned: string): number {
  try {
    return fieldDispatchSpentAmount(advance, returned || 0);
  } catch {
    return 0;
  }
}

function previewBillable(advance: number, returned: string, fee: number, reconciled: boolean): number {
  try {
    return fieldDispatchBillableTotal(advance, returned || 0, fee, reconciled);
  } catch {
    return Math.max(0, fee);
  }
}

function dispatchStaffPayClass(entry: FieldDispatchEntry): string {
  return entry.staffSalaryPaid
    ? "field-dispatch-panel__status--staff-paid"
    : "field-dispatch-panel__status--staff-open";
}

function canBillDispatchNow(entry: FieldDispatchEntry): boolean {
  return (
    entry.reimbursementStatus === "Open" &&
    fieldDispatchIsReconciled(entry) &&
    Boolean(entry.clientCode?.trim())
  );
}

export function FieldDispatchPanel({ busy, onBusy, onStatus, clients, onOpenBilling }: Props) {
  const [dispatches, setDispatches] = useState<FieldDispatchEntry[]>([]);
  const [locationStats, setLocationStats] = useState<LocationStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "billed">("all");
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);

  const [date, setDate] = useState(todayLocal());
  const [days, setDays] = useState("1");
  const [location, setLocation] = useState(FIELD_DISPATCH_LOCATIONS[0] || "Tagum");
  const [customLocation, setCustomLocation] = useState("");
  const [staff, setStaff] = useState(DEFAULT_FIELD_DISPATCH_STAFF);
  const [clientCode, setClientCode] = useState("");
  const [purpose, setPurpose] = useState<string>(FIELD_DISPATCH_PURPOSES[0]);
  const [advanceGiven, setAdvanceGiven] = useState("");
  const [serviceFee, setServiceFee] = useState("");
  const [notes, setNotes] = useState("");
  const [newReturned, setNewReturned] = useState("");
  const [reconcileReturned, setReconcileReturned] = useState("");
  const [payStaffOnCreate, setPayStaffOnCreate] = useState(false);
  const [payStaffOnReconcile, setPayStaffOnReconcile] = useState(false);

  const resolvedLocation = location === "Other" ? customLocation.trim() : location;
  const advanceBreakdown = computeFieldDispatchAdvanceBreakdown(
    location === "Other" ? "Other" : resolvedLocation || location,
    days
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/field-dispatch");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load field dispatches.");
      setDispatches(json.dispatches || []);
      setLocationStats(json.locationStats || []);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not load field dispatches.", true);
    } finally {
      setLoading(false);
    }
  }, [onStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const locKey = location === "Other" ? "Other" : location;
    const breakdown = computeFieldDispatchAdvanceBreakdown(locKey, days);
    setAdvanceGiven(String(breakdown.totalAdvance));
    const preset = FIELD_DISPATCH_LOCATION_PRESETS[location];
    if (preset && location !== "Other") {
      setServiceFee(String(preset.serviceFee));
    }
  }, [location, days]);

  const filtered = useMemo(() => {
    if (filter === "open") {
      return dispatches.filter((d) => d.reimbursementStatus === "Open");
    }
    if (filter === "billed") {
      return dispatches.filter((d) => d.reimbursementStatus === "Billed");
    }
    return dispatches;
  }, [dispatches, filter]);

  const openCount = dispatches.filter((d) => d.reimbursementStatus === "Open").length;

  function resetForm() {
    setDate(todayLocal());
    setDays("1");
    setLocation(FIELD_DISPATCH_LOCATIONS[0] || "Tagum");
    setCustomLocation("");
    setStaff(DEFAULT_FIELD_DISPATCH_STAFF);
    setClientCode("");
    setPurpose(FIELD_DISPATCH_PURPOSES[0]);
    setNotes("");
    setNewReturned("");
    const preset = FIELD_DISPATCH_LOCATION_PRESETS[FIELD_DISPATCH_LOCATIONS[0] || "Tagum"];
    setAdvanceGiven(String(preset?.defaultAdvance ?? ""));
    setServiceFee(String(preset?.serviceFee ?? ""));
  }

  function openReconcile(entry: FieldDispatchEntry) {
    setReconcileId(entry.dispatchId);
    setReconcileReturned(
      fieldDispatchIsReconciled(entry) ? String(entry.returnedToOffice) : ""
    );
    setNotes(entry.notes || "");
    setPayStaffOnReconcile(entry.staffSalaryPaid);
  }

  function openEdit(entry: FieldDispatchEntry) {
    const { location: loc, customLocation: custom } = locationFromEntry(entry.location);
    const purpose = (FIELD_DISPATCH_PURPOSES as readonly string[]).includes(entry.purpose)
      ? entry.purpose
      : FIELD_DISPATCH_PURPOSES[FIELD_DISPATCH_PURPOSES.length - 1];
    setEditForm({
      dispatchId: entry.dispatchId,
      reimbursementStatus: entry.reimbursementStatus,
      date: entry.date,
      days: String(entry.days),
      location: loc,
      customLocation: custom,
      staff: entry.staff,
      clientCode: entry.clientCode,
      purpose,
      advanceGiven: entry.advanceGiven ? String(entry.advanceGiven) : "",
      serviceFee: entry.serviceFee ? String(entry.serviceFee) : "",
      returnedToOffice: fieldDispatchIsReconciled(entry) ? String(entry.returnedToOffice) : "",
      notes: entry.notes || ""
    });
  }

  function patchEditForm<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function submitEdit() {
    if (!editForm) return;
    const resolvedLocation =
      editForm.location === "Other" ? editForm.customLocation.trim() : editForm.location;
    if (!resolvedLocation) {
      onStatus("Enter a location.", true);
      return;
    }
    onBusy(true);
    try {
      const res = await fetch(`/api/field-dispatch/${encodeURIComponent(editForm.dispatchId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          date: editForm.date,
          days: editForm.days,
          location: resolvedLocation,
          staff: editForm.staff,
          clientCode: editForm.clientCode.trim().toUpperCase(),
          purpose: editForm.purpose,
          advanceGiven: editForm.advanceGiven,
          serviceFee: editForm.serviceFee,
          returnedToOffice: editForm.returnedToOffice,
          notes: editForm.notes
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save changes.");
      onStatus(json.message || "Dispatch updated.");
      setEditForm(null);
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not save changes.", true);
    } finally {
      onBusy(false);
    }
  }

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedLocation) {
      onStatus("Enter a location.", true);
      return;
    }
    onBusy(true);
    try {
      const res = await fetch("/api/field-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          days,
          location: resolvedLocation,
          staff,
          clientCode: clientCode.trim().toUpperCase(),
          purpose,
          advanceGiven,
          serviceFee,
          returnedToOffice: fieldDispatchHasReturnedInput(newReturned) ? newReturned : undefined,
          notes,
          staffSalaryPaid: payStaffOnCreate
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not record dispatch.");
      onStatus(json.message || "Dispatch recorded.");
      resetForm();
      setPayStaffOnCreate(false);
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not record dispatch.", true);
    } finally {
      onBusy(false);
    }
  }

  async function patchDispatch(
    dispatchId: string,
    action: "reconcile" | "bill" | "markPaid" | "markStaffSalaryPaid" | "unmarkStaffSalaryPaid",
    extra?: { returnedToOffice?: string; notes?: string; clientCode?: string; staffSalaryPaid?: boolean }
  ) {
    onBusy(true);
    try {
      const res = await fetch(`/api/field-dispatch/${encodeURIComponent(dispatchId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          returnedToOffice: extra?.returnedToOffice ?? reconcileReturned,
          notes: extra?.notes ?? notes,
          staffSalaryPaid: extra?.staffSalaryPaid
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed.");
      onStatus(json.message || "Updated.");
      setReconcileId(null);
      setPayStaffOnReconcile(false);
      const billedClient = extra?.clientCode?.trim().toUpperCase() || json.dispatch?.clientCode?.trim();
      if (action === "bill" && billedClient && onOpenBilling) {
        onOpenBilling(billedClient);
      }
      await load();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Update failed.", true);
    } finally {
      onBusy(false);
    }
  }

  const reconcileEntry = reconcileId
    ? dispatches.find((d) => d.dispatchId === reconcileId) ?? null
    : null;
  const newHasReturned = fieldDispatchHasReturnedInput(newReturned);
  const newSpent = newHasReturned ? previewSpent(Number(advanceGiven) || 0, newReturned) : 0;
  const newBillable = newHasReturned
    ? previewBillable(Number(advanceGiven) || 0, newReturned, Number(serviceFee) || 0, true)
    : Math.max(0, Number(serviceFee) || 0);
  const reconcileSpent = reconcileEntry
    ? previewSpent(reconcileEntry.advanceGiven, reconcileReturned)
    : 0;
  const reconcileBillable = reconcileEntry
    ? previewBillable(reconcileEntry.advanceGiven, reconcileReturned, reconcileEntry.serviceFee, true)
    : 0;
  const reconcileSalaryCredit =
    reconcileEntry && fieldDispatchHasReturnedInput(reconcileReturned)
      ? fieldDispatchSalaryCredit(reconcileEntry.serviceFee, reconcileReturned, true)
      : 0;
  const editAmountsLocked = editForm?.reimbursementStatus === "Billed";
  const editHasReturned = Boolean(editForm && editForm.returnedToOffice !== "");
  const editSpent =
    editForm && !editAmountsLocked && editHasReturned
      ? previewSpent(Number(editForm.advanceGiven), editForm.returnedToOffice)
      : 0;
  const editBillable =
    editForm && !editAmountsLocked
      ? previewBillable(
          Number(editForm.advanceGiven),
          editForm.returnedToOffice,
          Number(editForm.serviceFee),
          editHasReturned || editForm.reimbursementStatus !== "Open"
        )
      : 0;
  const editResolvedLocation =
    editForm?.location === "Other" ? editForm.customLocation.trim() : editForm?.location || "";
  const editAdvanceBreakdown = editForm
    ? computeFieldDispatchAdvanceBreakdown(
        editForm.location === "Other" ? "Other" : editResolvedLocation || editForm.location,
        editForm.days
      )
    : null;

  const locationGuide = FIELD_DISPATCH_LOCATIONS.filter((l) => l !== "Other")
    .map((name) => {
      const preset = FIELD_DISPATCH_LOCATION_PRESETS[name];
      const breakdown = computeFieldDispatchAdvanceBreakdown(name);
      const stat = locationStats.find((s) => s.location === name);
      const hours = FIELD_DISPATCH_TRAVEL_HOURS[name] ?? 0;
      return { name, preset, breakdown, stat, hours };
    })
    .sort((a, b) => a.hours - b.hours);

  return (
    <div className="walk-in-panel field-dispatch-panel">
      <div className="walk-in-panel__head">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Out-of-town liaison tracking</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted">
            Admin only. Suggested <strong>advance</strong> = round-trip bus from Davao + ₱{FIELD_DISPATCH_MEAL_ALLOWANCE}/meal
            + tricycle/jeep at destination (meals and local fare scale with <strong>days</strong> when Jas stays overnight).
            <strong>Service fee</strong> (liaison pay) is separate and scales with travel time.
          </p>
        </div>
        {openCount > 0 && (
          <span className="owner-reminder-badge">{openCount} open for billing</span>
        )}
      </div>

      <FieldDispatchCompanion
        dispatches={dispatches}
        busy={busy}
        onBusy={onBusy}
        onStatus={onStatus}
        onReconciled={load}
      />

      <section className="card mb-4">
        <p className="field-dispatch-panel__section-title">Location guide (1-day trip)</p>
        <div className="field-dispatch-panel__table-wrap firm-ledger-table-wrap">
          <table className="field-dispatch-panel__table field-dispatch-panel__table--guide firm-ledger-table firm-ledger-table--responsive-stack">
            <thead>
              <tr>
                <th>Area</th>
                <th>Drive</th>
                <th className="field-dispatch-panel__col-money">Bus (RT)</th>
                <th className="field-dispatch-panel__col-money">Meals</th>
                <th className="field-dispatch-panel__col-money">Local</th>
                <th className="field-dispatch-panel__col-money">Advance</th>
                <th className="field-dispatch-panel__col-money">Fee</th>
                <th className="field-dispatch-panel__col-money" title="Average spent + fee on reconciled trips">
                  Avg billable
                </th>
              </tr>
            </thead>
            <tbody>
              {locationGuide.map(({ name, preset, breakdown, stat, hours }) => (
                <tr key={name}>
                  <td data-label="Area" className="field-dispatch-panel__col-area">{name}</td>
                  <td data-label="Drive" className="field-dispatch-panel__col-time">{formatFieldDispatchTravelHours(hours)}</td>
                  <td data-label="Bus (RT)" className="field-dispatch-panel__col-money">{formatPeso(breakdown.busRoundTrip)}</td>
                  <td data-label="Meals" className="field-dispatch-panel__col-money" title={`${breakdown.mealCount} × ₱${FIELD_DISPATCH_MEAL_ALLOWANCE}`}>
                    {breakdown.mealCount ? formatPeso(breakdown.mealTotal) : "—"}
                  </td>
                  <td data-label="Local" className="field-dispatch-panel__col-money">{formatPeso(breakdown.tricycleLocal)}</td>
                  <td data-label="Advance" className="field-dispatch-panel__col-money">{formatPeso(preset.defaultAdvance)}</td>
                  <td data-label="Fee" className="field-dispatch-panel__col-money">{formatPeso(preset.serviceFee)}</td>
                  <td data-label="Avg billable" className="field-dispatch-panel__col-money">
                    {stat && stat.avgBillable > 0 ? formatPeso(stat.avgBillable) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <form className="card mb-4" onSubmit={submitNew}>
        <p className="mb-3 text-xs font-bold text-ink">New trip / advance</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-muted">Date</span>
            <input className="field" type="date" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-muted">Days away</span>
            <input
              className="field"
              type="number"
              min={1}
              max={14}
              step={1}
              value={days}
              disabled={busy}
              onChange={(e) => setDays(e.target.value)}
              title="1 = same-day trip; 2+ = overnight (3 meals per day)"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-muted">Location</span>
            <select className="field" value={location} disabled={busy} onChange={(e) => setLocation(e.target.value)}>
              {FIELD_DISPATCH_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
          {location === "Other" && (
            <label className="block text-xs">
              <span className="mb-1 block font-semibold text-muted">Custom location</span>
              <input
                className="field"
                value={customLocation}
                disabled={busy}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Town / court"
              />
            </label>
          )}
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-muted">Staff</span>
            <input className="field" value={staff} disabled={busy} onChange={(e) => setStaff(e.target.value)} />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-muted">Client (for reimbursement)</span>
            <select className="field" value={clientCode} disabled={busy} onChange={(e) => setClientCode(e.target.value)}>
              <option value="">— Optional for now —</option>
              {clients.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name || "Unnamed"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-muted">Purpose</span>
            <select className="field" value={purpose} disabled={busy} onChange={(e) => setPurpose(e.target.value)}>
              {FIELD_DISPATCH_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-muted">Advance given (food &amp; fare)</span>
            <input
              className="field"
              inputMode="decimal"
              value={advanceGiven}
              disabled={busy}
              onChange={(e) => setAdvanceGiven(e.target.value)}
              placeholder="e.g. 1500"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-muted">Service fee (liaison pay)</span>
            <input
              className="field"
              inputMode="decimal"
              value={serviceFee}
              disabled={busy}
              onChange={(e) => setServiceFee(e.target.value)}
              placeholder="e.g. 1000"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-muted">Returned to office</span>
            <input
              className="field"
              inputMode="decimal"
              value={newReturned}
              disabled={busy}
              onChange={(e) => setNewReturned(e.target.value)}
              placeholder="Optional — 0 if all advance spent"
            />
          </label>
          <label className="block text-xs sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block font-semibold text-muted">Notes</span>
            <textarea
              className="field min-h-[72px] resize-y"
              value={notes}
              disabled={busy}
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {Number(serviceFee) > 0 ? (
            <label className="form-check sm:col-span-2 lg:col-span-3">
              <input
                type="checkbox"
                checked={payStaffOnCreate}
                disabled={busy}
                onChange={(e) => setPayStaffOnCreate(e.target.checked)}
              />
              <span className="text-xs text-ink">
                Service fee already paid to Jas — deduct from payroll when salary is calculated
              </span>
            </label>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Record advance
          </button>
          <p className="self-center text-xs text-muted">
            Suggested advance ({advanceBreakdown.days} day{advanceBreakdown.days > 1 ? "s" : ""}):{" "}
            {formatPeso(advanceBreakdown.totalAdvance)} (bus {formatPeso(advanceBreakdown.busRoundTrip)}
            {advanceBreakdown.mealCount > 0 ? ` + ${advanceBreakdown.mealCount} meals ${formatPeso(advanceBreakdown.mealTotal)}` : ""}
            {advanceBreakdown.tricycleLocal > 0 ? ` + local ${formatPeso(advanceBreakdown.tricycleLocal)}` : ""}).
            {newHasReturned ? (
              <>
                {" "}
                Spent: {formatPeso(newSpent)} · Billable: {formatPeso(newBillable)}.
              </>
            ) : (
              <> Leave returned blank until Jas is back, or enter now if already reconciled.</>
            )}
          </p>
        </div>
      </form>

      <section className="card field-dispatch-panel__register">
        <div className="field-dispatch-panel__register-head">
          <p className="field-dispatch-panel__section-title mb-0">Dispatch register</p>
          <div className="field-dispatch-panel__filters">
            {(["all", "open", "billed"] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={`field-dispatch-panel__filter-btn ${filter === id ? "field-dispatch-panel__filter-btn--active" : ""}`}
                disabled={busy}
                onClick={() => setFilter(id)}
              >
                {id === "all" ? "All" : id === "open" ? "Open" : "Billed"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState message="No field dispatches yet — register Jas's next out-of-town trip here." />
        ) : (
          <div className="field-dispatch-panel__table-wrap field-dispatch-panel__table-wrap--register firm-ledger-table-wrap">
            <table className="field-dispatch-panel__table field-dispatch-panel__table--register firm-ledger-table firm-ledger-table--responsive-stack">
              <colgroup>
                <col className="field-dispatch-panel__col-w-id" />
                <col className="field-dispatch-panel__col-w-date" />
                <col className="field-dispatch-panel__col-w-days" />
                <col className="field-dispatch-panel__col-w-location" />
                <col className="field-dispatch-panel__col-w-client" />
                <col className="field-dispatch-panel__col-w-purpose" />
                <col className="field-dispatch-panel__col-w-money" />
                <col className="field-dispatch-panel__col-w-money" />
                <col className="field-dispatch-panel__col-w-money" />
                <col className="field-dispatch-panel__col-w-money" />
                <col className="field-dispatch-panel__col-w-money" />
                <col className="field-dispatch-panel__col-w-status" />
                <col className="field-dispatch-panel__col-w-status" />
                <col className="field-dispatch-panel__col-w-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th className="field-dispatch-panel__col-days">Days</th>
                  <th>Location</th>
                  <th className="field-dispatch-panel__col-client">Client</th>
                  <th>Purpose</th>
                  <th className="field-dispatch-panel__col-money">Advance</th>
                  <th className="field-dispatch-panel__col-money">Spent</th>
                  <th className="field-dispatch-panel__col-money">Returned</th>
                  <th className="field-dispatch-panel__col-money">Fee</th>
                  <th className="field-dispatch-panel__col-money">Billable</th>
                  <th>Status</th>
                  <th>Jas pay</th>
                  <th className="field-dispatch-panel__col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.dispatchId}>
                    <td data-label="ID" className="field-dispatch-panel__col-id">{entry.dispatchId}</td>
                    <td data-label="Date" className="field-dispatch-panel__col-time">{entry.date}</td>
                    <td data-label="Days" className="field-dispatch-panel__col-days">{entry.days}</td>
                    <td data-label="Location" className="field-dispatch-panel__col-area">{entry.location}</td>
                    <td data-label="Client" className="field-dispatch-panel__col-client">
                      {entry.clientCode ? (
                        onOpenBilling ? (
                          <button
                            type="button"
                            className="field-dispatch-panel__client-link"
                            onClick={() => onOpenBilling(entry.clientCode)}
                          >
                            {entry.clientCode}
                          </button>
                        ) : (
                          entry.clientCode
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label="Purpose" className="field-dispatch-panel__col-purpose" title={entry.purpose}>
                      {entry.purpose}
                    </td>
                    <td data-label="Advance" className="field-dispatch-panel__col-money">{formatPeso(entry.advanceGiven)}</td>
                    <td data-label="Spent" className="field-dispatch-panel__col-money">
                      {fieldDispatchIsReconciled(entry) ? formatPeso(entry.actualExpenses) : "—"}
                    </td>
                    <td data-label="Returned" className="field-dispatch-panel__col-money">
                      {entry.returnedToOffice ? formatPeso(entry.returnedToOffice) : "—"}
                    </td>
                    <td data-label="Fee" className="field-dispatch-panel__col-money">{formatPeso(entry.serviceFee)}</td>
                    <td
                      data-label="Billable"
                      className="field-dispatch-panel__col-money field-dispatch-panel__col-billable"
                      title={
                        fieldDispatchIsReconciled(entry)
                          ? `${formatPeso(entry.actualExpenses)} spent + ${formatPeso(entry.serviceFee)} fee`
                          : `${formatPeso(entry.serviceFee)} fee (reconcile to add spent)`
                      }
                    >
                      {formatPeso(entry.billableTotal)}
                    </td>
                    <td data-label="Status">
                      <span className={`field-dispatch-panel__status ${dispatchStatusClass(entry.reimbursementStatus)}`}>
                        {entry.reimbursementStatus}
                      </span>
                    </td>
                    <td data-label="Jas pay">
                      {fieldDispatchSalaryCreditForEntry(entry) > 0 ? (
                        <span
                          className={`field-dispatch-panel__status ${dispatchStaffPayClass(entry)}`}
                          title={
                            entry.staffSalaryPaid
                              ? `Paid to Jas ${entry.staffSalaryPaidDate || ""} · credit ${formatPeso(fieldDispatchSalaryCreditForEntry(entry))}`
                              : `Due on payroll · credit ${formatPeso(fieldDispatchSalaryCreditForEntry(entry))}`
                          }
                        >
                          {entry.staffSalaryPaid ? "Paid Jas" : "Payroll"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td data-label="Actions" className="field-dispatch-panel__col-actions">
                      <div className="field-dispatch-panel__row-actions">
                        {entry.reimbursementStatus !== "Paid" && entry.status !== "Closed" && (
                          <button
                            type="button"
                            className="field-dispatch-panel__register-btn field-dispatch-panel__register-btn--edit"
                            disabled={busy}
                            onClick={() => openEdit(entry)}
                          >
                            Edit
                          </button>
                        )}
                        {canBillDispatchNow(entry) ? (
                          <button
                            type="button"
                            className="field-dispatch-panel__register-btn field-dispatch-panel__register-btn--primary"
                            disabled={busy}
                            title={`Post ${formatPeso(entry.billableTotal)} to ${entry.clientCode} ledger`}
                            onClick={() =>
                              patchDispatch(entry.dispatchId, "bill", {
                                returnedToOffice: String(entry.returnedToOffice),
                                notes: entry.notes,
                                clientCode: entry.clientCode
                              })
                            }
                          >
                            Bill client
                          </button>
                        ) : entry.reimbursementStatus === "Open" ? (
                          <button
                            type="button"
                            className="field-dispatch-panel__register-btn field-dispatch-panel__register-btn--primary"
                            disabled={busy}
                            onClick={() => openReconcile(entry)}
                          >
                            {entry.clientCode ? "Reconcile & bill" : "Reconcile"}
                          </button>
                        ) : null}
                        {entry.reimbursementStatus === "Billed" && (
                          <button
                            type="button"
                            className="field-dispatch-panel__register-btn field-dispatch-panel__register-btn--gold"
                            disabled={busy}
                            onClick={() => patchDispatch(entry.dispatchId, "markPaid")}
                          >
                            Mark paid
                          </button>
                        )}
                        {fieldDispatchSalaryCreditForEntry(entry) > 0 &&
                          (entry.staffSalaryPaid ? (
                            <button
                              type="button"
                              className="field-dispatch-panel__register-btn field-dispatch-panel__register-btn--edit"
                              disabled={busy}
                              onClick={() => patchDispatch(entry.dispatchId, "unmarkStaffSalaryPaid")}
                            >
                              Undo Jas pay
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="field-dispatch-panel__register-btn field-dispatch-panel__register-btn--gold"
                              disabled={busy}
                              title={`Mark ${formatPeso(fieldDispatchSalaryCreditForEntry(entry))} paid to Jas now`}
                              onClick={() => patchDispatch(entry.dispatchId, "markStaffSalaryPaid")}
                            >
                              Paid Jas
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editForm && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setEditForm(null)}>
          <div
            className="dialog card max-w-2xl"
            role="dialog"
            aria-labelledby="edit-dispatch-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-dispatch-title" className="font-display text-lg font-semibold text-ink">
              Edit {editForm.dispatchId}
            </h3>
            {editAmountsLocked && (
              <p className="mt-1 text-xs text-muted">
                Already billed — trip details and notes can be updated; amounts are locked (ledger entries were posted).
              </p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">Date</span>
                <input
                  className="field"
                  type="date"
                  value={editForm.date}
                  disabled={busy}
                  onChange={(e) => patchEditForm("date", e.target.value)}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">Days away</span>
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={14}
                  step={1}
                  value={editForm.days}
                  disabled={busy}
                  onChange={(e) => patchEditForm("days", e.target.value)}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">Location</span>
                <select
                  className="field"
                  value={editForm.location}
                  disabled={busy}
                  onChange={(e) => patchEditForm("location", e.target.value)}
                >
                  {FIELD_DISPATCH_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
              {editForm.location === "Other" && (
                <label className="block text-xs">
                  <span className="mb-1 block font-semibold text-muted">Custom location</span>
                  <input
                    className="field"
                    value={editForm.customLocation}
                    disabled={busy}
                    onChange={(e) => patchEditForm("customLocation", e.target.value)}
                    placeholder="Town / court"
                  />
                </label>
              )}
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">Staff</span>
                <input
                  className="field"
                  value={editForm.staff}
                  disabled={busy}
                  onChange={(e) => patchEditForm("staff", e.target.value)}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">Client</span>
                <select
                  className="field"
                  value={editForm.clientCode}
                  disabled={busy}
                  onChange={(e) => patchEditForm("clientCode", e.target.value)}
                >
                  <option value="">— None —</option>
                  {clients.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name || "Unnamed"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="mb-1 block font-semibold text-muted">Purpose</span>
                <select
                  className="field"
                  value={editForm.purpose}
                  disabled={busy}
                  onChange={(e) => patchEditForm("purpose", e.target.value)}
                >
                  {FIELD_DISPATCH_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">Advance given</span>
                <input
                  className="field"
                  inputMode="decimal"
                  value={editForm.advanceGiven}
                  disabled={busy || editAmountsLocked}
                  onChange={(e) => patchEditForm("advanceGiven", e.target.value)}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">Service fee</span>
                <input
                  className="field"
                  inputMode="decimal"
                  value={editForm.serviceFee}
                  disabled={busy || editAmountsLocked}
                  onChange={(e) => patchEditForm("serviceFee", e.target.value)}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">Returned to office</span>
                <input
                  className="field"
                  inputMode="decimal"
                  value={editForm.returnedToOffice}
                  disabled={busy || editAmountsLocked}
                  onChange={(e) => patchEditForm("returnedToOffice", e.target.value)}
                />
              </label>
              {!editAmountsLocked && editHasReturned && (
                <p className="text-xs text-muted sm:col-span-2">
                  Spent (advance − returned): {formatPeso(editSpent)} · Billable: {formatPeso(editBillable)}
                </p>
              )}
              <label className="block text-xs sm:col-span-2">
                <span className="mb-1 block font-semibold text-muted">Notes</span>
                <textarea
                  className="field min-h-[72px] resize-y"
                  value={editForm.notes}
                  disabled={busy}
                  rows={3}
                  onChange={(e) => patchEditForm("notes", e.target.value)}
                />
              </label>
            </div>
            {!editAmountsLocked && editAdvanceBreakdown && (
              <p className="mt-3 text-xs text-muted">
                Suggested advance ({editAdvanceBreakdown.days} day{editAdvanceBreakdown.days > 1 ? "s" : ""}):{" "}
                {formatPeso(editAdvanceBreakdown.totalAdvance)}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submitEdit()}>
                Save changes
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setEditForm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {reconcileId && (
        <div className="reset-dialog-backdrop" role="presentation" onClick={() => setReconcileId(null)}>
          <div
            className="card field-dispatch-panel__reconcile-dialog"
            role="dialog"
            aria-labelledby="reconcile-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reconcile-title" className="font-display text-lg font-semibold text-ink">
              Reconcile {reconcileId}
            </h3>
            <p className="mt-1 text-xs text-muted">
              Enter how much change Jas returned. Spent is computed as advance minus returned; billable = spent + service fee.
            </p>
            <div className="mt-3 grid gap-3">
              {reconcileEntry && (
                <p className="text-xs text-muted">
                  Advance given: {formatPeso(reconcileEntry.advanceGiven)} · Service fee:{" "}
                  {formatPeso(reconcileEntry.serviceFee)}
                </p>
              )}
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">Returned to office</span>
                <input
                  className="field"
                  inputMode="decimal"
                  value={reconcileReturned}
                  disabled={busy}
                  onChange={(e) => setReconcileReturned(e.target.value)}
                  placeholder="0 if all advance was spent"
                />
              </label>
              {reconcileEntry && (
                <p className="text-xs font-semibold text-ink">
                  Spent: {formatPeso(reconcileSpent)} · Billable: {formatPeso(reconcileBillable)}
                  {fieldDispatchHasReturnedInput(reconcileReturned) ? (
                    <>
                      {" "}
                      · Salary credit: {formatPeso(reconcileSalaryCredit)} (fee − returned)
                    </>
                  ) : null}
                </p>
              )}
              <label className="block text-xs">
                <span className="mb-1 block font-semibold text-muted">Notes</span>
                <textarea
                  className="field min-h-[72px] resize-y"
                  value={notes}
                  disabled={busy}
                  rows={3}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              {reconcileEntry && fieldDispatchSalaryCreditForEntry(reconcileEntry) > 0 ? (
                <label className="form-check">
                  <input
                    type="checkbox"
                    checked={payStaffOnReconcile}
                    disabled={busy}
                    onChange={(e) => setPayStaffOnReconcile(e.target.checked)}
                  />
                  <span className="text-xs text-ink">
                    Service fee already paid to Jas ({formatPeso(reconcileSalaryCredit || fieldDispatchSalaryCreditForEntry(reconcileEntry))})
                  </span>
                </label>
              ) : null}
            </div>
            <div className="field-dispatch-panel__dialog-actions field-dispatch-panel__dialog-actions--reconcile">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !reconcileEntry?.clientCode}
                title={reconcileEntry?.clientCode ? undefined : "Add a client code on the dispatch first"}
                onClick={() =>
                  patchDispatch(reconcileId, "bill", {
                    clientCode: reconcileEntry?.clientCode
                  })
                }
              >
                Bill client now
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  patchDispatch(reconcileId, "reconcile", {
                    staffSalaryPaid: payStaffOnReconcile
                  })
                }
              >
                Save only
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setReconcileId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
