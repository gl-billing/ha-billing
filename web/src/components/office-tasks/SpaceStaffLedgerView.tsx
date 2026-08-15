"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EmployeeRecord } from "@/lib/office-tasks/sheets/employees";
import { EmptyState } from "@/components/office-tasks/PremiumUI";
import { SameWindowLink } from "@/components/SameWindowLink";
import { useNativeMobileLayout } from "@/hooks/useNativeMobileLayout";
import { mobileOfficeHomeHref } from "@/lib/space-nav";

/** Space Staff desk — HA Employees sheet roster (admins can add / update). */
export function SpaceStaffLedgerView() {
  const nativeMobile = useNativeMobileLayout();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [directory, setDirectory] = useState<EmployeeRecord[]>([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tasks/employees");
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        directory?: EmployeeRecord[];
        canEdit?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not load staff roster.");
      setDirectory(json.directory || []);
      setCanEdit(Boolean(json.canEdit));
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

  function openCreate() {
    setEditing(null);
    setName("");
    setEmail("");
    setRole("");
    setPhone("");
    setActive(true);
    setShowForm(true);
    setStatus("");
  }

  function openEdit(row: EmployeeRecord) {
    setEditing(row);
    setName(row.name);
    setEmail(row.email);
    setRole(row.role || "");
    setPhone(row.phone || "");
    setActive(row.active !== false);
    setShowForm(true);
    setStatus("");
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return directory;
    return directory.filter((row) =>
      [row.name, row.email, row.role, row.phone].join(" ").toLowerCase().includes(needle)
    );
  }, [directory, query]);

  async function saveEmployee(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const res = await fetch("/api/tasks/employees", {
        method: editing?.rowNumber ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role,
          phone,
          active,
          rowNumber: editing?.rowNumber
        })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.error || "Could not save staff.");
      setStatus(json.message || "Staff saved.");
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save staff.");
    } finally {
      setSaving(false);
    }
  }

  const form = showForm && canEdit ? (
    <form
      className={nativeMobile ? "space-staff-ledger__invite" : "mt-4 grid gap-3 rounded border border-[color:var(--line)] p-4"}
      onSubmit={(e) => void saveEmployee(e)}
    >
      <p className={nativeMobile ? "space-staff-ledger__invite-title" : "text-sm font-semibold text-ink"}>
        {editing ? "Edit staff" : "Add staff"}
      </p>
      <label className={nativeMobile ? undefined : "block text-xs text-muted"}>
        {nativeMobile ? <span>Name</span> : "Name"}
        <input className={nativeMobile ? undefined : "field mt-1"} value={name} required disabled={saving} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={nativeMobile ? undefined : "block text-xs text-muted"}>
        {nativeMobile ? <span>Email</span> : "Email"}
        <input
          className={nativeMobile ? undefined : "field mt-1"}
          type="email"
          value={email}
          required
          disabled={saving}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className={nativeMobile ? undefined : "block text-xs text-muted"}>
        {nativeMobile ? <span>Role</span> : "Role"}
        <input className={nativeMobile ? undefined : "field mt-1"} value={role} disabled={saving} onChange={(e) => setRole(e.target.value)} />
      </label>
      <label className={nativeMobile ? undefined : "block text-xs text-muted"}>
        {nativeMobile ? <span>Phone</span> : "Phone (optional)"}
        <input className={nativeMobile ? undefined : "field mt-1"} value={phone} disabled={saving} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className={nativeMobile ? undefined : "flex items-center gap-2 text-sm text-ink"}>
        <input type="checkbox" checked={active} disabled={saving} onChange={(e) => setActive(e.target.checked)} />
        {nativeMobile ? <span>Active</span> : "Active"}
      </label>
      <div className={nativeMobile ? "space-staff-ledger__invite-actions" : "flex gap-2"}>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={saving}
          onClick={() => {
            setShowForm(false);
            setEditing(null);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  ) : null;

  return (
    <section className={`space-staff-ledger${nativeMobile ? " space-staff-ledger--native-mobile" : " card"}`}>
      {nativeMobile ? (
        <header className="space-staff-ledger__mobile-chrome no-print">
          <SameWindowLink href={mobileOfficeHomeHref()} className="space-staff-ledger__mobile-back" aria-label="Back">
            ←
          </SameWindowLink>
          <p className="space-staff-ledger__mobile-title">Staff</p>
          {canEdit ? (
            <button
              type="button"
              className="space-staff-ledger__mobile-add"
              aria-label="Add staff"
              disabled={loading || saving}
              onClick={openCreate}
            >
              +
            </button>
          ) : null}
        </header>
      ) : (
        <div className="space-staff-ledger__head">
          <div>
            <p className="section-label">Staff</p>
            <h2 className="text-lg font-semibold text-ink">Firm roster</h2>
            <p className="mt-1 text-sm text-muted">
              {canEdit
                ? "Active staff from the HA Employees sheet. Admins can add or update rows here."
                : "Active staff from the HA Employees sheet."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading || saving}>
              Refresh
            </button>
            {canEdit ? (
              <button type="button" className="btn-primary" onClick={openCreate} disabled={loading || saving}>
                Add staff
              </button>
            ) : null}
            <SameWindowLink href="/app?tab=tools&space=staff" className="btn-secondary">
              Tools
            </SameWindowLink>
          </div>
        </div>
      )}

      {nativeMobile ? (
        <div className="space-staff-ledger__filters">
          <input
            type="search"
            className="space-staff-ledger__search"
            placeholder="Search staff by name, email, or role"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search staff"
          />
          <span className="space-staff-ledger__count">
            {filtered.length}/{directory.length}
          </span>
        </div>
      ) : null}

      {status ? <p className="mt-3 text-sm text-[#1f6b3a]">{status}</p> : null}
      {loading ? <p className="mt-4 text-sm text-muted">Loading roster…</p> : null}
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}

      {form}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          title={directory.length ? "No staff found" : "No staff rows"}
          message={
            directory.length
              ? "Try a different search."
              : canEdit
                ? "Add a staff member here, or enter names on the Employees sheet in the HA tasks workbook."
                : "Ask an admin to add names on the Employees sheet."
          }
          action={
            canEdit && !directory.length ? (
              <button type="button" className="btn-primary text-sm" onClick={openCreate}>
                Add staff
              </button>
            ) : undefined
          }
          compact={nativeMobile}
        />
      ) : null}

      {!loading && nativeMobile && filtered.length > 0 ? (
        <ul className="space-staff-ledger__cards" aria-label="Staff roster">
          {filtered.map((row) => (
            <li key={`${row.email}-${row.name}-${row.rowNumber || ""}`}>
              <div className="space-staff-ledger__card">
                <button
                  type="button"
                  className="space-staff-ledger__card-hit"
                  onClick={() => (canEdit ? openEdit(row) : undefined)}
                >
                  <span className="space-staff-ledger__card-main">
                    <span className="space-staff-ledger__name">{row.name}</span>
                    <span className="space-staff-ledger__sub">{row.role?.trim() || "Staff"}</span>
                    {row.email?.trim() ? <span className="space-staff-ledger__email">{row.email.trim()}</span> : null}
                    <span className="space-staff-ledger__card-meta">
                      <span
                        className={`space-staff-ledger__pill${
                          row.active === false ? " space-staff-ledger__pill--muted" : " space-staff-ledger__pill--active"
                        }`}
                      >
                        {row.active === false ? "Inactive" : "Active"}
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && !nativeMobile && directory.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--line)] text-muted">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                {canEdit ? <th className="py-2 font-medium"> </th> : null}
              </tr>
            </thead>
            <tbody>
              {directory.map((row) => (
                <tr key={`${row.email}-${row.name}-${row.rowNumber || ""}`} className="border-b border-[color:var(--line)]">
                  <td className="py-2.5 pr-3 text-ink">
                    {row.name}
                    {row.active === false ? <span className="ml-2 text-xs text-muted">(inactive)</span> : null}
                  </td>
                  <td className="py-2.5 pr-3 text-muted">{row.email || "—"}</td>
                  <td className="py-2.5 pr-3 text-muted">{row.role || "—"}</td>
                  {canEdit ? (
                    <td className="py-2.5">
                      <button type="button" className="text-xs font-semibold text-gold-dark underline-offset-2 hover:underline" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
