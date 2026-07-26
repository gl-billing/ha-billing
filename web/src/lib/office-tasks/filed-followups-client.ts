/** Fire Serving + client-notice follow-ups after Mark filed; toast failures without blocking. */

export type FiledFollowUpPayload = {
  source: string;
  rowNumber: number;
  itemId?: string;
  clientCase?: string;
};

export async function notifyFiledFollowUpFailures(
  item: FiledFollowUpPayload,
  reportWarn: (message: string) => void
): Promise<void> {
  try {
    const res = await fetch("/api/tasks/items/filed-followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: item.source,
        rowNumber: item.rowNumber,
        itemId: item.itemId,
        clientCase: item.clientCase
      })
    });
    const json = (await res.json().catch(() => ({}))) as {
      warn?: string;
      error?: string;
      serving?: { ok?: boolean };
      notice?: { ok?: boolean };
    };

    if (!res.ok) {
      reportWarn(json.warn || json.error || "Filed — Serving task / client notice failed.");
      return;
    }

    if (typeof json.warn === "string" && json.warn.trim()) {
      reportWarn(json.warn.trim());
    }
  } catch {
    reportWarn("Filed — could not confirm Serving task / client notice.");
  }
}
