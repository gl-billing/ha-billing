"use client";

import { Skeleton } from "@/components/Skeleton";
import { useCallback, useEffect, useState } from "react";
import type { TaxDeadlineView } from "@/lib/tax-deadlines";
import { resolveFirmOwnerAssignee } from "@/lib/staff-assignee";

type Props = {
  employees: string[];
  busy: boolean;
  isAdmin?: boolean;
  onAdded: () => void;
  onStatus: (msg: string) => void;
};

export function TaxDeadlinesPanel({ employees, busy, isAdmin, onAdded, onStatus }: Props) {
  const [taxFilter, setTaxFilter] = useState<"Monthly" | "Quarterly" | "Annual">("Monthly");
  const [deadlines, setDeadlines] = useState<TaxDeadlineView[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientCase, setClientCase] = useState("Tax Compliance");
  const [responsible, setResponsible] = useState("");
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/tax-deadlines");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setDeadlines(json.deadlines || []);
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Could not load tax deadlines.");
    } finally {
      setLoading(false);
    }
  }, [onStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!employees.length) return;
    setResponsible((current) => current || resolveFirmOwnerAssignee(employees) || "");
  }, [employees]);

  const filtered = deadlines.filter((d) => d.group === taxFilter);

  async function addDeadline(index: number, filingDate: string, reminderDays: number, calendarSync: boolean) {
    if (!filingDate) {
      onStatus("Choose a filing date first.");
      return;
    }
    setSavingIndex(index);
    onStatus("Adding tax filing deadline…");
    try {
      const res = await fetch("/api/tasks/tax-deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deadlineIndex: index,
          filingDate,
          clientCase,
          responsible,
          priority: "High",
          reminderDays,
          calendarSync
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      onStatus(json.message || "Added to Hearings & Events.");
      onAdded();
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSavingIndex(null);
    }
  }

  async function seedAutopilot() {
    setSeeding(true);
    onStatus("Seeding upcoming BIR deadlines…");
    try {
      const res = await fetch("/api/tasks/tax-deadlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "seedAutopilot",
          responsible: responsible || undefined,
          horizonDays: 120
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Seed failed");
      onStatus(json.message || "BIR deadlines seeded.");
      onAdded();
    } catch (e) {
      onStatus(e instanceof Error ? e.message : "Seed failed.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <section className="card tools-panel__section">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold">BIR compliance</p>
      <h2 className="font-display mt-1 text-base font-semibold text-ink sm:text-lg">Tax filing deadline tracker</h2>
      <p className="tools-panel__section-desc">
        Add a form as a filing deadline in Hearings & Events. Confirm dates against the current BIR calendar before filing.
      </p>

      {isAdmin ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-gold text-xs"
            disabled={busy || seeding}
            onClick={() => void seedAutopilot()}
          >
            {seeding ? "Seeding…" : "Seed upcoming BIR deadlines"}
          </button>
          <span className="text-xs text-muted">Adds deduped filing events for the next ~4 months.</span>
        </div>
      ) : null}

      <div className="tools-panel__form-grid">
        <label className="form-field">
          <span className="form-field__label">Client / matter</span>
          <input
            className="field-input"
            value={clientCase}
            onChange={(e) => setClientCase(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span className="form-field__label">Responsible</span>
          <input
            className="field-input"
            list="tax-employees"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            placeholder="Assignee"
          />
        </label>
      </div>

      <datalist id="tax-employees">
        {employees.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="refine-segment tools-panel__segment" role="tablist" aria-label="Tax form period">
        {(["Monthly", "Quarterly", "Annual"] as const).map((g) => {
          const active = taxFilter === g;
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={active}
              className={`refine-segment__btn min-h-[44px] ${active ? "refine-segment__btn--active" : ""}`}
              onClick={() => setTaxFilter(g)}
            >
              {g}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Skeleton lines={4} className="tools-panel__template-list" />
      ) : (
        <div className="tools-panel__template-list">
          {filtered.map((item) => (
            <TaxCard
              key={item.index}
              item={item}
              disabled={busy || savingIndex !== null}
              saving={savingIndex === item.index}
              onAdd={(date, reminder, sync) => addDeadline(item.index, date, reminder, sync)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TaxCard({
  item,
  disabled,
  saving,
  onAdd
}: {
  item: TaxDeadlineView;
  disabled: boolean;
  saving: boolean;
  onAdd: (filingDate: string, reminderDays: number, calendarSync: boolean) => void;
}) {
  const [date, setDate] = useState(item.nextDate);
  const [reminder, setReminder] = useState(1);
  const [sync, setSync] = useState(false);

  useEffect(() => {
    setDate(item.nextDate);
  }, [item.nextDate]);

  return (
    <div className="tools-panel__template-card">
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-900">
        {item.group} · {item.form}
      </span>
      <h3 className="mt-2 text-sm font-bold leading-snug text-ink sm:text-[15px]">{item.filing}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
        <span className="font-semibold text-ink/80">When:</span> {item.whenToFile}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">
        <span className="font-semibold text-ink/80">Suggested:</span> {item.nextDateLabel}
      </p>
      <p className="mt-1 text-[11px] italic leading-relaxed text-muted sm:text-xs">{item.notes}</p>

      <div className="form-grid-pair mt-3">
        <label className="text-[10px] font-bold uppercase text-muted">
          Filing date
          <input type="date" className="field-input mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="text-[10px] font-bold uppercase text-muted">
          Reminder (days)
          <input
            type="number"
            min={0}
            max={30}
            className="field-input mt-1"
            value={reminder}
            onChange={(e) => setReminder(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs font-medium">
        <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} />
        Sync to Google Calendar
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdd(date, reminder, sync)}
        className="btn-primary mt-3 text-xs"
      >
        {saving ? "Adding…" : "Add as filing deadline"}
      </button>
    </div>
  );
}
