"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BillingTabGuide, BillingTabGuideText, TabPageHeader } from "@/components/BillingTabGuide";
import { FormStatusReport } from "@/components/FormStatusReport";
import {
  MAX_TEMPLATE_UPLOAD_BYTES,
  TEMPLATE_FOLDERS,
  TEMPLATE_UPLOAD_ACCEPT,
  type TemplateFileSummary,
  type TemplateFolderId
} from "@/lib/firm-templates";

type Props = {
  testLab?: boolean;
};

type LoadState = {
  files: TemplateFileSummary[];
  rootLink: string;
  sandbox: boolean;
};

function formatBytes(size?: number): string {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModified(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Templates library — category folders + upload into the chosen folder.
 * Matches GL Space Templates UX with HA branding.
 */
export function TasksTemplatesTab({ testLab = false }: Props) {
  const [folderId, setFolderId] = useState<TemplateFolderId>(TEMPLATE_FOLDERS[0].id);
  const [uploadFolderId, setUploadFolderId] = useState<TemplateFolderId>(TEMPLATE_FOLDERS[0].id);
  const [state, setState] = useState<LoadState>({ files: [], rootLink: "", sandbox: testLab });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ phase: "success" | "error" | "processing"; message: string } | null>(
    null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFolder = useMemo(
    () => TEMPLATE_FOLDERS.find((folder) => folder.id === folderId) || TEMPLATE_FOLDERS[0],
    [folderId]
  );

  const apiUrl = useCallback(
    (folder: TemplateFolderId) => {
      const params = new URLSearchParams({ folder });
      if (testLab) params.set("sandbox", "1");
      return `/api/firm/templates?${params.toString()}`;
    },
    [testLab]
  );

  const loadFolder = useCallback(
    async (folder: TemplateFolderId) => {
      setLoading(true);
      setStatus(null);
      try {
        const res = await fetch(apiUrl(folder), { cache: "no-store" });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          files?: TemplateFileSummary[];
          rootLink?: string;
          sandbox?: boolean;
        };
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Could not load templates.");
        }
        setState({
          files: json.files || [],
          rootLink: json.rootLink || "",
          sandbox: Boolean(json.sandbox)
        });
      } catch (error) {
        setState({ files: [], rootLink: "", sandbox: testLab });
        setStatus({
          message: error instanceof Error ? error.message : "Could not load templates.",
          phase: "error"
        });
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, testLab]
  );

  useEffect(() => {
    void loadFolder(folderId);
  }, [folderId, loadFolder]);

  async function handleUpload() {
    if (!selectedFile) {
      setStatus({ message: "Choose a file before uploading.", phase: "error" });
      return;
    }
    if (selectedFile.size > MAX_TEMPLATE_UPLOAD_BYTES) {
      setStatus({ message: "File is too large (max 10 MB).", phase: "error" });
      return;
    }

    setUploading(true);
    setStatus({ message: "Uploading…", phase: "processing" });
    try {
      const form = new FormData();
      form.set("folder", uploadFolderId);
      form.set("file", selectedFile);
      const params = new URLSearchParams();
      if (testLab) params.set("sandbox", "1");
      const res = await fetch(`/api/firm/templates${params.toString() ? `?${params}` : ""}`, {
        method: "POST",
        body: form
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        folderId?: TemplateFolderId;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Could not upload template.");
      }

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      const nextFolder = json.folderId || uploadFolderId;
      setFolderId(nextFolder);
      setStatus({ message: json.message || "Template uploaded.", phase: "success" });
      await loadFolder(nextFolder);
    } catch (error) {
      setStatus({
        message: error instanceof Error ? error.message : "Could not upload template.",
        phase: "error"
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <TabPageHeader resetKey="templates">
        <BillingTabGuide title="About templates">
          <BillingTabGuideText>
            Firm document starters organized by folder — affidavits, SPAs, contracts, deeds, retainership,
            and letters.
          </BillingTabGuideText>
          <BillingTabGuideText>
            Upload approved PDF or Word files into the right folder so the whole desk can reuse them.
          </BillingTabGuideText>
        </BillingTabGuide>
      </TabPageHeader>

      <div className="templates-library">
        <aside className="templates-library__folders card" aria-label="Template folders">
          <p className="view-eyebrow">Folders</p>
          <h2 className="panel-card-title templates-library__folders-title">Categories</h2>
          <ul className="templates-library__folder-list">
            {TEMPLATE_FOLDERS.map((folder) => {
              const active = folder.id === folderId;
              return (
                <li key={folder.id}>
                  <button
                    type="button"
                    className={`templates-library__folder${active ? " templates-library__folder--active" : ""}`}
                    aria-current={active ? "true" : undefined}
                    onClick={() => {
                      setFolderId(folder.id);
                      setUploadFolderId(folder.id);
                    }}
                  >
                    <span className="templates-library__folder-label">{folder.label}</span>
                    <span className="templates-library__folder-desc">{folder.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="templates-library__main">
          <section className="card templates-library__upload">
            <p className="view-eyebrow">Upload</p>
            <h2 className="panel-card-title">Add a template</h2>
            <p className="text-sm text-muted mt-1">
              PDF, Word (.doc / .docx), or RTF — max 10 MB. Choose the folder, then upload.
            </p>
            <div className="templates-library__upload-row">
              <label className="templates-library__field">
                <span className="field-label">Folder</span>
                <select
                  className="field"
                  value={uploadFolderId}
                  disabled={uploading}
                  onChange={(event) => setUploadFolderId(event.target.value as TemplateFolderId)}
                >
                  {TEMPLATE_FOLDERS.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="templates-library__field templates-library__field--file">
                <span className="field-label">File</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="field"
                  accept={TEMPLATE_UPLOAD_ACCEPT}
                  disabled={uploading}
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
              </label>
              <div className="templates-library__upload-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={uploading || !selectedFile}
                  onClick={() => void handleUpload()}
                >
                  {uploading ? "Uploading…" : "Upload to folder"}
                </button>
              </div>
            </div>
            {selectedFile ? (
              <p className="text-xs text-muted mt-2">
                Selected: <strong>{selectedFile.name}</strong> ({formatBytes(selectedFile.size)})
              </p>
            ) : null}
            {status ? <FormStatusReport status={status} className="mt-3" /> : null}
          </section>

          <section className="card templates-library__files">
            <div className="templates-library__files-head">
              <div>
                <p className="view-eyebrow">Library</p>
                <h2 className="panel-card-title">{activeFolder.label}</h2>
                <p className="text-sm text-muted mt-1">{activeFolder.description}</p>
              </div>
              <div className="templates-library__files-actions">
                {state.rootLink ? (
                  <a
                    href={state.rootLink}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-sm"
                  >
                    Open Drive folder
                  </a>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={loading}
                  onClick={() => void loadFolder(folderId)}
                >
                  Refresh
                </button>
              </div>
            </div>

            {state.sandbox ? (
              <p className="templates-library__sandbox-note text-xs text-muted">
                Sandbox mode — uploads stay in this session and are not written to Google Drive.
              </p>
            ) : null}

            {loading ? (
              <p className="text-sm text-muted mt-3">Loading templates…</p>
            ) : state.files.length === 0 ? (
              <p className="text-sm text-muted mt-3">
                No files in <strong>{activeFolder.label}</strong> yet. Upload one above.
              </p>
            ) : (
              <div className="templates-library__table-wrap">
                <table className="templates-library__table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Updated</th>
                      <th scope="col">Size</th>
                      <th scope="col">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.files.map((file) => (
                      <tr key={file.id}>
                        <td className="templates-library__name" title={file.name}>
                          {file.name}
                        </td>
                        <td>{formatModified(file.modifiedTime) || "—"}</td>
                        <td>{formatBytes(file.size) || "—"}</td>
                        <td>
                          {file.webViewLink.startsWith("#") ? (
                            <span className="text-xs text-muted">Sandbox</span>
                          ) : (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="templates-library__open"
                            >
                              Open
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
