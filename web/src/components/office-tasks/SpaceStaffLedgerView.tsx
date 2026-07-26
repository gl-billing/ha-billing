"use client";

import { useCallback, useEffect, useState } from "react";
import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { SameWindowLink } from "@/components/SameWindowLink";

/** Space Staff desk — HA Employees sheet roster (read-only). */
export function SpaceStaffLedgerView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [directory, setDirectory] = useState<EmployeeRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tasks/employees");
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        directory?: EmployeeRecord[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not load staff roster.");
      setDirectory(json.directory || []);
    } catch (err) {
      setDirectory([]);
      setError(err instanceof Error ? err.message : "Could not load staff roster.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-staff-ledger card">
      <div className="space-staff-ledger__head">
        <div>
          <p className="section-label">Staff</p>
          <h2 className="text-lg font-semibold text-ink">Firm roster</h2>
          <p className="mt-1 text-sm text-muted">Active staff from the HA Employees sheet.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
          <SameWindowLink href="/app?tab=tools&space=staff" className="btn-secondary">
            Tools
          </SameWindowLink>
        </div>
      </div>

      {loading ? <p className="mt-4 text-sm text-muted">Loading roster…</p> : null}
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}
      {!loading && !error && directory.length === 0 ? (
        <EmptyState
          title="No staff rows"
          message="Add names on the Employees sheet in the HA tasks workbook."
        />
      ) : null}
      {!loading && directory.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--line)] text-muted">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {directory.map((row) => (
                <tr key={`${row.email}-${row.name}`} className="border-b border-[color:var(--line)]">
                  <td className="py-2.5 pr-3 text-ink">{row.name}</td>
                  <td className="py-2.5 pr-3 text-muted">{row.email || "—"}</td>
                  <td className="py-2.5 text-muted">{row.role || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
