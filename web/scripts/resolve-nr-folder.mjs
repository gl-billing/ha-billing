/**
 * Resolve notarial receipts (NR) Drive folder ID via Apps Script.
 * Usage: node scripts/resolve-nr-folder.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

function loadEnv(path) {
  const text = readFileSync(path, "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const env = loadEnv(envPath);
const url = env.APPS_SCRIPT_WEB_APP_URL;
const secret = env.APPS_SCRIPT_WEB_APP_SECRET;

if (!url || !secret) {
  console.error("Missing APPS_SCRIPT_WEB_APP_URL or APPS_SCRIPT_WEB_APP_SECRET in web/.env.local");
  process.exit(1);
}

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: secret, action: "getNrFolderHeadless" }),
  redirect: "follow"
});

const text = await res.text();
let payload;
try {
  payload = JSON.parse(text);
} catch {
  console.error("Non-JSON response from Apps Script. Deploy WebAppApi.gs + WebAppHeadless.gs with getNrFolderHeadless first.");
  console.error(text.slice(0, 300));
  process.exit(1);
}

if (!payload.ok) {
  console.error(payload.error || "Apps Script request failed.");
  if (/Unknown action/i.test(String(payload.error))) {
    console.error("\nPaste the latest WebAppApi.gs and WebAppHeadless.gs into Apps Script, then Deploy → New version.");
  }
  process.exit(1);
}

console.log(JSON.stringify({
  folderId: payload.folderId,
  folderUrl: payload.folderUrl,
  folderName: payload.folderName
}, null, 2));
