"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { ModalPortal } from "@/components/ModalPortal";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  buildCivilEFilingAnnexFilename,
  buildCivilEFilingMainFilename,
  formatAnnexDisplayLabel,
  nextPrimaryAnnexLabel,
  nextSubAnnexLabel,
  resolveCivilEFilingAnnexStyle,
  type CivilEFilingAnnexStyle,
  type CivilEFilingAttachmentSpec
} from "@/lib/civil-e-filing";
import { parseApiJson } from "@/lib/parse-api-response";

type PreviewPayload = {
  subject: string;
  plain: string;
  html: string;
  to: string;
  cc: string;
  initiatory: boolean;
  initiatoryHint: string;
  filingPartyName: string;
  docketNumber: string;
  caseTitle: string;
  pleadingDesignation: string;
  courtPending: string;
  primaryManner: string;
  filingDate: string;
  contactNumbers: string;
  otherEmail: string;
  courtEmail: string;
  opposingCounselEmail: string;
  attachmentTitles: string[];
  suggestedFilenames: string[];
  caseRole?: string;
  annexStyle?: CivilEFilingAnnexStyle;
  clientCode: string | null;
  itemId: string;
};

type Props = {
  item: ItemSummary | null;
  open: boolean;
  onClose: () => void;
  onStatus?: (message: string, isError?: boolean) => void;
  onSent?: () => void;
};

type AttachmentRow = {
  id: string;
  kind: "main" | "annex";
  /** Primary or sub-annex label without "Annex " prefix — e.g. A, A-1, 1, 1-A */
  annexLabel?: string;
  /** Parent primary label when this is a sub-annex */
  parentAnnexLabel?: string;
  description: string;
  file: File | null;
  filename: string;
  editingFilename: boolean;
};

function newRowId(): string {
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function rowsToAttachmentSpecs(rows: AttachmentRow[], pleading: string): CivilEFilingAttachmentSpec[] {
  return rows.map((row) => {
    if (row.kind === "main") {
      return { title: row.description.trim() || pleading || "Pleading" };
    }
    return {
      title: row.description.trim() || formatAnnexDisplayLabel(row.annexLabel || ""),
      annex: row.annexLabel
    };
  });
}

function suggestedFilenameForRow(
  row: AttachmentRow,
  pleading: string,
  docket: string
): string {
  if (row.kind === "main") {
    return buildCivilEFilingMainFilename(pleading || row.description, docket);
  }
  return buildCivilEFilingAnnexFilename(row.annexLabel || "A", pleading, docket);
}

export function CivilEFilingDialog({ item, open, onClose, onStatus, onSent }: Props) {
  useBodyScrollLock(open && Boolean(item));
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const baseId = useId();

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);

  const [subject, setSubject] = useState("");
  const [plain, setPlain] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [docketNumber, setDocketNumber] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [pleadingDesignation, setPleadingDesignation] = useState("");
  const [courtPending, setCourtPending] = useState("");
  const [filingPartyName, setFilingPartyName] = useState("");
  const [filingDate, setFilingDate] = useState("");
  const [primaryManner, setPrimaryManner] = useState("Electronic Filing");
  const [contactNumbers, setContactNumbers] = useState("");
  const [otherEmail, setOtherEmail] = useState("");
  const [caseRole, setCaseRole] = useState("");
  const [annexStyle, setAnnexStyle] = useState<CivilEFilingAnnexStyle>("letter");
  const [attachmentRows, setAttachmentRows] = useState<AttachmentRow[]>([]);

  const applyPreviewFields = useCallback((data: PreviewPayload, preserveAttachments: boolean) => {
    setPreview(data);
    setSubject(data.subject);
    setPlain(data.plain);
    setTo(data.to || data.courtEmail || "");
    setCc(data.cc || data.opposingCounselEmail || "");
    setDocketNumber(data.docketNumber || "");
    setCaseTitle(data.caseTitle || "");
    setPleadingDesignation(data.pleadingDesignation || "");
    setCourtPending(data.courtPending || "");
    setFilingPartyName(data.filingPartyName || "");
    setFilingDate(data.filingDate || "");
    setPrimaryManner(data.primaryManner || "Electronic Filing");
    setContactNumbers(data.contactNumbers || "");
    setOtherEmail(data.otherEmail || "");
    setCaseRole(data.caseRole || "");
    setAnnexStyle(data.annexStyle || resolveCivilEFilingAnnexStyle(data.caseRole));
    if (!preserveAttachments) {
      setAttachmentRows([
        {
          id: newRowId(),
          kind: "main",
          description: data.pleadingDesignation || "Pleading",
          file: null,
          filename: buildCivilEFilingMainFilename(data.pleadingDesignation || "Pleading", data.docketNumber || ""),
          editingFilename: false
        }
      ]);
    }
  }, []);

  const loadPreview = useCallback(
    async (overrides?: Record<string, unknown>, preserveAttachments = true) => {
      if (!item) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/tasks/e-filing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "preview",
            source: item.source,
            itemId: item.id,
            rowNumber: item.rowNumber,
            overrides
          })
        });
        const { ok, data, errorMessage } = await parseApiJson<PreviewPayload & { error?: string }>(response);
        if (!ok || !data) throw new Error(errorMessage || "Could not build e-filing preview.");
        applyPreviewFields(data, preserveAttachments);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview failed.");
      } finally {
        setLoading(false);
      }
    },
    [item, applyPreviewFields]
  );

  useEffect(() => {
    if (!open || !item) return;
    setAttachmentRows([]);
    setPreview(null);
    void loadPreview(undefined, false);
  }, [open, item, loadPreview]);

  function currentOverrides(rows: AttachmentRow[] = attachmentRows): Record<string, unknown> {
    return {
      docketNumber,
      caseTitle,
      pleadingDesignation,
      courtPending,
      filingPartyName,
      contactNumbers,
      otherEmail,
      primaryManner,
      filingDate,
      courtEmail: to,
      opposingCounselEmail: cc,
      attachmentSpecs: rowsToAttachmentSpecs(rows, pleadingDesignation)
    };
  }

  function refreshFilenames(rows: AttachmentRow[], pleading = pleadingDesignation, docket = docketNumber): AttachmentRow[] {
    return rows.map((row) => ({
      ...row,
      filename: row.editingFilename ? row.filename : suggestedFilenameForRow(row, pleading, docket)
    }));
  }

  async function rebuildFromFields(rows?: AttachmentRow[]) {
    const nextRows = rows ?? attachmentRows;
    await loadPreview(currentOverrides(nextRows), true);
  }

  function addAnnex() {
    const existing = attachmentRows.filter((r) => r.kind === "annex").map((r) => r.annexLabel || "");
    const label = nextPrimaryAnnexLabel(existing, annexStyle);
    const row: AttachmentRow = {
      id: newRowId(),
      kind: "annex",
      annexLabel: label,
      description: "",
      file: null,
      filename: buildCivilEFilingAnnexFilename(label, pleadingDesignation, docketNumber),
      editingFilename: false
    };
    const next = [...attachmentRows, row];
    setAttachmentRows(next);
    void rebuildFromFields(next);
  }

  function addSubAnnex(parent: AttachmentRow) {
    const primary = parent.parentAnnexLabel || parent.annexLabel;
    if (!primary) return;
    const existing = attachmentRows.filter((r) => r.kind === "annex").map((r) => r.annexLabel || "");
    const label = nextSubAnnexLabel(primary, existing, annexStyle);
    const row: AttachmentRow = {
      id: newRowId(),
      kind: "annex",
      annexLabel: label,
      parentAnnexLabel: primary,
      description: "",
      file: null,
      filename: buildCivilEFilingAnnexFilename(label, pleadingDesignation, docketNumber),
      editingFilename: false
    };
    const parentIndex = attachmentRows.findIndex((r) => r.id === parent.id);
    // Insert after parent and its existing sub-annexes
    let insertAt = parentIndex + 1;
    while (
      insertAt < attachmentRows.length &&
      attachmentRows[insertAt].parentAnnexLabel === primary
    ) {
      insertAt += 1;
    }
    const next = [...attachmentRows.slice(0, insertAt), row, ...attachmentRows.slice(insertAt)];
    setAttachmentRows(next);
    void rebuildFromFields(next);
  }

  function removeRow(id: string) {
    const target = attachmentRows.find((r) => r.id === id);
    if (!target || target.kind === "main") return;
    const next = attachmentRows.filter((r) => {
      if (r.id === id) return false;
      // Removing a primary annex also removes its sub-annexes
      if (target.annexLabel && !target.parentAnnexLabel && r.parentAnnexLabel === target.annexLabel) {
        return false;
      }
      return true;
    });
    setAttachmentRows(next);
    void rebuildFromFields(next);
  }

  function updateRow(id: string, patch: Partial<AttachmentRow>) {
    setAttachmentRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const merged = { ...row, ...patch };
        if (!merged.editingFilename && (patch.description !== undefined || patch.annexLabel !== undefined)) {
          merged.filename = suggestedFilenameForRow(merged, pleadingDesignation, docketNumber);
        }
        return merged;
      })
    );
  }

  function onUploadForRow(id: string, list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setAttachmentRows((prev) => {
      const next = prev.map((row) => {
        if (row.id !== id) return row;
        const filename = suggestedFilenameForRow(row, pleadingDesignation, docketNumber);
        return {
          ...row,
          file,
          filename,
          editingFilename: false,
          description: row.description.trim() || file.name.replace(/\.pdf$/i, "")
        };
      });
      void rebuildFromFields(next);
      return next;
    });
  }

  async function submit(mode: "send" | "draft") {
    if (!item || !preview) return;
    const ready = attachmentRows.filter((r) => r.file);
    if (!ready.length) {
      setError("Upload at least the main pleading PDF.");
      return;
    }
    const missing = attachmentRows.find((r) => !r.file);
    if (missing) {
      setError(
        `Upload a PDF for ${missing.kind === "main" ? "the main pleading" : formatAnnexDisplayLabel(missing.annexLabel || "")} (or remove unused annex lines).`
      );
      return;
    }
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("action", mode);
      form.set(
        "meta",
        JSON.stringify({
          source: item.source,
          itemId: item.id,
          rowNumber: item.rowNumber,
          subject,
          plain,
          to,
          cc,
          overrides: currentOverrides(attachmentRows)
        })
      );
      form.set("filenames", JSON.stringify(attachmentRows.map((r) => r.filename)));
      for (const row of attachmentRows) {
        if (row.file) form.append("files", row.file, row.file.name);
      }

      const response = await fetch("/api/tasks/e-filing", { method: "POST", body: form });
      const { ok, data, errorMessage } = await parseApiJson<{ message?: string; error?: string }>(response);
      if (!ok) throw new Error(errorMessage || "Send failed.");
      onStatus?.(data.message || (mode === "draft" ? "Draft saved." : "E-filing sent."), false);
      onSent?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed.";
      setError(message);
      onStatus?.(message, true);
    } finally {
      setSending(false);
    }
  }

  // Keep filenames in sync when pleading/docket change (unless user is editing a name)
  useEffect(() => {
    if (!preview) return;
    setAttachmentRows((prev) => refreshFilenames(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when designation/docket change
  }, [pleadingDesignation, docketNumber]);

  if (!open || !item) return null;

  const annexHint =
    annexStyle === "number"
      ? `Annex style for ${caseRole || "defendant/accused"}: Annex 1, 2… · sub-annex 1-A, 1-B…`
      : `Annex style for ${caseRole || "petitioner/complainant"}: Annex A, B… · sub-annex A-1, A-2…`;

  return (
    <ModalPortal>
      <div
        className="reset-dialog-backdrop no-print"
        role="dialog"
        aria-modal="true"
        aria-labelledby="civil-efiling-title"
      >
        <div className="reset-dialog card max-h-[90vh] w-full max-w-2xl overflow-y-auto">
          <p className="view-eyebrow">Civil e-filing</p>
          <h3 id="civil-efiling-title" className="font-display text-xl font-semibold text-ink">
            Email to court
          </h3>
          <p className="mt-1 text-sm text-muted">{item.clientCase || "Filing event"}</p>

          {preview?.initiatoryHint ? (
            <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {preview.initiatoryHint}
            </p>
          ) : null}

          {loading && !preview ? <p className="mt-4 text-sm text-muted">Building preview…</p> : null}
          {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}

          {preview ? (
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-muted">To (court email)</span>
                <input className="field mt-1" type="email" value={to} disabled={sending} onChange={(e) => setTo(e.target.value)} />
              </label>
              {!preview.initiatory ? (
                <label className="block text-sm">
                  <span className="text-muted">CC (opposing counsel)</span>
                  <input className="field mt-1" type="email" value={cc} disabled={sending} onChange={(e) => setCc(e.target.value)} />
                </label>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-muted">Docket number</span>
                  <input className="field mt-1" value={docketNumber} disabled={sending} onChange={(e) => setDocketNumber(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className="text-muted">Filing date</span>
                  <input
                    className="field mt-1"
                    type="date"
                    value={filingDate.slice(0, 10)}
                    disabled={sending}
                    onChange={(e) => setFilingDate(e.target.value)}
                  />
                </label>
              </div>

              <label className="block text-sm">
                <span className="text-muted">Case title</span>
                <input className="field mt-1" value={caseTitle} disabled={sending} onChange={(e) => setCaseTitle(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Pleading / submission designation</span>
                <input
                  className="field mt-1"
                  value={pleadingDesignation}
                  disabled={sending}
                  onChange={(e) => setPleadingDesignation(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Court / branch</span>
                <input className="field mt-1" value={courtPending} disabled={sending} onChange={(e) => setCourtPending(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Filing party</span>
                <input className="field mt-1" value={filingPartyName} disabled={sending} onChange={(e) => setFilingPartyName(e.target.value)} />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-muted">Primary manner of filing</span>
                  <select className="field mt-1" value={primaryManner} disabled={sending} onChange={(e) => setPrimaryManner(e.target.value)}>
                    <option>Electronic Filing</option>
                    <option>Personal Filing</option>
                    <option>Registered Mail</option>
                    <option>Accredited Courier</option>
                    <option>Electronic Transmittal</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-muted">Other email of filer</span>
                  <input className="field mt-1" type="email" value={otherEmail} disabled={sending} onChange={(e) => setOtherEmail(e.target.value)} />
                </label>
              </div>

              <label className="block text-sm">
                <span className="text-muted">Contact number/s of filer</span>
                <input className="field mt-1" value={contactNumbers} disabled={sending} onChange={(e) => setContactNumbers(e.target.value)} />
              </label>

              <button type="button" className="btn-secondary text-sm" disabled={loading || sending} onClick={() => void rebuildFromFields()}>
                {loading ? "Updating…" : "Rebuild subject & body"}
              </button>

              <label className="block text-sm">
                <span className="text-muted">Subject</span>
                <input className="field mt-1" value={subject} disabled={sending} onChange={(e) => setSubject(e.target.value)} />
              </label>

              <label className="block text-sm">
                <span className="text-muted">Body</span>
                <textarea
                  className="field mt-1 min-h-[220px] font-mono text-xs"
                  value={plain}
                  disabled={sending}
                  onChange={(e) => setPlain(e.target.value)}
                />
              </label>

              <div className="rounded border border-line px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">Attachments</p>
                    <p className="mt-0.5 text-xs text-muted">{annexHint}</p>
                  </div>
                  <button type="button" className="btn-secondary text-sm" disabled={sending} onClick={addAnnex}>
                    Add annex
                  </button>
                </div>

                <ul className="mt-3 space-y-3">
                  {attachmentRows.map((row) => {
                    const isSub = Boolean(row.parentAnnexLabel);
                    const label =
                      row.kind === "main"
                        ? "Main pleading"
                        : formatAnnexDisplayLabel(row.annexLabel || "");
                    const inputId = `${baseId}-${row.id}`;
                    return (
                      <li
                        key={row.id}
                        className={`rounded border border-line bg-paper/40 px-3 py-2 ${isSub ? "ml-4 border-dashed" : ""}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm text-ink">{label}</strong>
                          <div className="flex flex-wrap gap-1.5">
                            {row.kind === "annex" && !isSub ? (
                              <button
                                type="button"
                                className="btn-secondary text-xs"
                                disabled={sending}
                                onClick={() => addSubAnnex(row)}
                              >
                                Add sub-annex
                              </button>
                            ) : null}
                            {row.kind === "annex" ? (
                              <button
                                type="button"
                                className="btn-secondary text-xs"
                                disabled={sending}
                                onClick={() => removeRow(row.id)}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <label className="mt-2 block text-sm">
                          <span className="text-xs text-muted">Document title (in email list)</span>
                          <input
                            className="field mt-1"
                            value={row.description}
                            disabled={sending}
                            placeholder={row.kind === "main" ? pleadingDesignation : "e.g. Articles of Partnership (SEC)"}
                            onChange={(e) => updateRow(row.id, { description: e.target.value })}
                            onBlur={() => void rebuildFromFields()}
                          />
                        </label>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            ref={(el) => {
                              fileInputRefs.current[row.id] = el;
                            }}
                            id={inputId}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="sr-only"
                            disabled={sending}
                            onChange={(e) => {
                              onUploadForRow(row.id, e.target.files);
                              e.target.value = "";
                            }}
                          />
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            disabled={sending}
                            onClick={() => fileInputRefs.current[row.id]?.click()}
                          >
                            {row.file ? "Replace PDF" : "Upload PDF"}
                          </button>
                          {row.file ? (
                            <span className="text-xs text-muted truncate max-w-[12rem]" title={row.file.name}>
                              Source: {row.file.name}
                            </span>
                          ) : (
                            <span className="text-xs text-amber-800">No file yet</span>
                          )}
                        </div>

                        <div className="mt-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-muted">Attachment filename</span>
                            <button
                              type="button"
                              className="btn-secondary text-xs"
                              disabled={sending}
                              onClick={() => {
                                if (row.editingFilename) {
                                  updateRow(row.id, {
                                    editingFilename: false,
                                    filename: suggestedFilenameForRow(row, pleadingDesignation, docketNumber)
                                  });
                                } else {
                                  updateRow(row.id, { editingFilename: true });
                                }
                              }}
                            >
                              {row.editingFilename ? "Reset name" : "Edit name"}
                            </button>
                          </div>
                          {row.editingFilename ? (
                            <input
                              className="field mt-1 font-mono text-xs"
                              value={row.filename}
                              disabled={sending}
                              onChange={(e) => updateRow(row.id, { filename: e.target.value, editingFilename: true })}
                            />
                          ) : (
                            <p className="mt-1 break-all font-mono text-xs text-ink">{row.filename}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary flex-1 text-sm" disabled={sending} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-secondary flex-1 text-sm"
              disabled={sending || loading || !preview}
              onClick={() => void submit("draft")}
            >
              {sending ? "…" : "Save Gmail draft"}
            </button>
            <button
              type="button"
              className="btn-primary flex-1 text-sm"
              disabled={sending || loading || !preview}
              onClick={() => void submit("send")}
            >
              {sending ? "Sending…" : "Send e-filing email"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
