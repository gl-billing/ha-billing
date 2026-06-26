"use client";

import { useState } from "react";

type Props = {
  currentCode: string;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onStatus: (message: string, isError?: boolean) => void;
  onRenamed: (newCode: string) => void;
  compact?: boolean;
};

export function ClientCodeRenameForm({
  currentCode,
  busy,
  onBusy,
  onStatus,
  onRenamed,
  compact = false
}: Props) {
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [open, setOpen] = useState(false);

  async function submitRename() {
    const next = newCode.trim();
    if (!next) {
      onStatus("Enter the new client code.", true);
      return;
    }
    if (confirmCode.trim() !== currentCode) {
      onStatus(`Type ${currentCode} to confirm the rename.`, true);
      return;
    }

    onBusy(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(currentCode)}/rename-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newCode: next, confirmCode: confirmCode.trim() })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to rename client code.");

      onStatus(json.message || `Client code renamed to ${json.newCode}.`);
      setNewCode("");
      setConfirmCode("");
      setOpen(false);
      onRenamed(json.newCode || next);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Failed to rename client code.", true);
    } finally {
      onBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={
          compact
            ? "btn-secondary min-h-[46px] w-full px-4 py-2.5 text-sm sm:w-auto"
            : "rounded-md border-2 border-[#8b6914]/50 bg-white px-4 py-2.5 text-sm font-extrabold text-[#6b5210] hover:bg-[#faf8f4] disabled:cursor-not-allowed disabled:opacity-50"
        }
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        Edit client code…
      </button>
    );
  }

  return (
    <div className={compact ? "mt-3 space-y-2" : "space-y-3"}>
      <p className="text-xs leading-relaxed text-muted">
        Renames the Master List code and ledger tab. Task and event IDs with prefix{" "}
        <strong>{currentCode}</strong> are updated too.
      </p>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase text-muted">New client code</span>
        <input
          className="field"
          value={newCode}
          disabled={busy}
          autoComplete="off"
          placeholder="e.g. EVA"
          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase text-muted">
          Type {currentCode} to confirm
        </span>
        <input
          className="field"
          value={confirmCode}
          disabled={busy}
          autoComplete="off"
          placeholder={currentCode}
          onChange={(e) => setConfirmCode(e.target.value)}
        />
      </label>
      <div className={compact ? "matter-client-admin__form-actions" : "flex flex-wrap gap-2.5"}>
        <button
          type="button"
          className={compact ? "btn-gold" : "btn-gold text-xs"}
          disabled={busy || !newCode.trim() || confirmCode.trim() !== currentCode}
          onClick={() => void submitRename()}
        >
          Save new code
        </button>
        <button
          type="button"
          className={compact ? "btn-secondary" : "btn-secondary text-xs"}
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setNewCode("");
            setConfirmCode("");
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
