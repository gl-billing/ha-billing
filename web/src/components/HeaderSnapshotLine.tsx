"use client";

import { useEffect, useState } from "react";
import type { FirmWorkspace } from "@/components/FirmWorkspaceShell";
import { formatPeso } from "@/lib/gl-config";

type Props = {
  workspace: FirmWorkspace;
};

export function HeaderSnapshotLine({ workspace }: Props) {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (workspace === "billing") {
          const res = await fetch("/api/home");
          if (!res.ok) return;
          const data = await res.json();
          if (cancelled) return;

          const parts: string[] = [];
          if (Number(data.overdueClients) > 0) {
            parts.push(
              `${data.overdueClients} overdue matter${data.overdueClients === 1 ? "" : "s"}`
            );
          }
          if (Number(data.clientsWithBalance) > 0) {
            parts.push(`${data.clientsWithBalance} with balance`);
          }
          if (Number(data.totalCollectibles) > 0) {
            parts.push(`${formatPeso(data.totalCollectibles)} outstanding`);
          }
          if (Number(data.pendingArCount) > 0) {
            parts.push(
              `${data.pendingArCount} pending receipt${data.pendingArCount === 1 ? "" : "s"}`
            );
          }
          setLine(parts.length ? parts.join(" · ") : "All clear — no outstanding balances today");
          return;
        }

        const res = await fetch("/api/tasks/home");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const overdue = (data.lists?.overdue || []).length;
        const today = (data.lists?.today || []).length;
        if (overdue > 0 && today > 0) {
          setLine(`${overdue} overdue · ${today} due today`);
        } else if (overdue > 0) {
          setLine(`${overdue} overdue item${overdue === 1 ? "" : "s"} need attention`);
        } else if (today > 0) {
          setLine(`${today} item${today === 1 ? "" : "s"} due today`);
        } else {
          setLine("On track — nothing overdue today");
        }
      } catch {
        /* quiet */
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  if (!line) return null;

  return <p className="brand-header__snapshot">{line}</p>;
}
