import { NextResponse } from "next/server";
import { withSessionSheetsAccess } from "@/lib/api-auth";
import {
  MAX_TEMPLATE_UPLOAD_BYTES,
  TEMPLATE_FOLDERS,
  isAllowedTemplateMime,
  isTemplateFolderId,
  templateFolderById,
  type TemplateFolderId
} from "@/lib/firm-templates";
import {
  listFirmTemplateFiles,
  listSandboxTemplateFiles,
  uploadFirmTemplateFile,
  uploadSandboxTemplateFile
} from "@/lib/sheets/templates-storage";

function isTemplatesSandboxRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("sandbox") === "1") return true;
  const referer = request.headers.get("referer") || "";
  return /\/test-lab(\/|$|\?)/i.test(referer);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const folderParam = url.searchParams.get("folder")?.trim() || TEMPLATE_FOLDERS[0].id;
    if (!isTemplateFolderId(folderParam)) {
      return NextResponse.json({ error: "Unknown templates folder." }, { status: 400 });
    }
    const folderId = folderParam as TemplateFolderId;

    if (isTemplatesSandboxRequest(request)) {
      return NextResponse.json({
        ok: true,
        sandbox: true,
        folders: TEMPLATE_FOLDERS,
        folderId,
        folderLabel: templateFolderById(folderId).label,
        rootLink: "",
        files: listSandboxTemplateFiles(folderId)
      });
    }

    const result = await withSessionSheetsAccess((accessToken) =>
      listFirmTemplateFiles(accessToken, folderId)
    );

    return NextResponse.json({
      ok: true,
      sandbox: false,
      folders: TEMPLATE_FOLDERS,
      folderId,
      folderLabel: result.folderLabel,
      rootLink: result.rootLink,
      files: result.files
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load templates.";
    const status = /sign in|Unauthorized|expired/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Upload the file as multipart form data." }, { status: 400 });
    }

    const form = await request.formData();
    const folderParam = String(form.get("folder") || "").trim();
    const file = form.get("file");

    if (!isTemplateFolderId(folderParam)) {
      return NextResponse.json({ error: "Choose which folder to upload into." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Choose a file before uploading." }, { status: 400 });
    }
    if (file.size > MAX_TEMPLATE_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File is too large (max 10 MB)." }, { status: 400 });
    }
    if (!isAllowedTemplateMime(file.type || "", file.name || "")) {
      return NextResponse.json(
        { error: "Upload a PDF, Word (.doc/.docx), or RTF file." },
        { status: 400 }
      );
    }

    const folderId = folderParam as TemplateFolderId;
    const sandbox = isTemplatesSandboxRequest(request);

    if (sandbox) {
      const uploaded = uploadSandboxTemplateFile({
        folderId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size
      });
      return NextResponse.json({
        ok: true,
        sandbox: true,
        folderId,
        file: uploaded,
        message: `Uploaded to ${templateFolderById(folderId).label} (sandbox).`
      });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await withSessionSheetsAccess((accessToken) =>
      uploadFirmTemplateFile(accessToken, {
        folderId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        bytes
      })
    );

    return NextResponse.json({
      ok: true,
      sandbox: false,
      folderId,
      file: uploaded,
      message: `Uploaded to ${templateFolderById(folderId).label}.`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload template.";
    const status = /sign in|Unauthorized|expired/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
