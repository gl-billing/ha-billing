/**
 * Send HA Office launch announcement to staff / lawyers from legal@hernandezlaw.info.
 *
 *   cd web && npx tsx scripts/send-launch-announcement.ts
 *
 * Requires CRON_GOOGLE_REFRESH_TOKEN (legal@ / firm Gmail) in .env.local.
 */
import fs from "fs";
import path from "path";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const APP = "https://ha-billing.vercel.app";
const LOGIN = `${APP}/login`;
const INSTALL = `${APP}/install`;

function helpUrl(email: string): string {
  const q = new URLSearchParams({ e: email, from: "launch-email" });
  return `${APP}/help/signin?${q.toString()}`;
}

function buildHtml(email: string): string {
  const help = helpUrl(email);
  return `
<div style="font-family:Georgia,serif;color:#1a1612;line-height:1.55;max-width:560px;margin:0 auto">
  <p style="margin:0 0 1rem;font-size:15px">Good day,</p>
  <p style="margin:0 0 1rem;font-size:15px">
    <strong>HA Office</strong> (Hernandez &amp; Associates billing, tasks, and calendar) is now running —
    repaired and updated. Please install it on your devices and sign in with your
    <strong>authorized firm Google account only</strong>.
  </p>

  <p style="margin:1.25rem 0 0.5rem;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b645a">Desktop</p>
  <p style="margin:0 0 1rem;font-size:15px">
    Open <a href="${INSTALL}" style="color:#1a1612;font-weight:700">${INSTALL}</a>
    (or go to <a href="${LOGIN}" style="color:#1a1612">${LOGIN}</a>), sign in, then add the app to your Dock
    (Safari: File → Add to Dock · Chrome: Install from the address bar).
  </p>

  <p style="margin:1.25rem 0 0.5rem;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b645a">iPhone / mobile</p>
  <p style="margin:0 0 1rem;font-size:15px">
    In <strong>Safari</strong>, open
    <a href="${INSTALL}" style="color:#1a1612;font-weight:700">${INSTALL}</a>,
    sign in, then Share → <strong>Add to Home Screen</strong>.
  </p>

  <p style="margin:0 0 1.25rem;font-size:15px">
    Reminder: log in only with the Google email your office authorized for you
    (firm address or listed personal Google). Using a different account will be blocked.
  </p>

  <p style="margin:0 0 0.75rem;text-align:center">
    <a href="${LOGIN}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 22px;font-size:14px;font-weight:700;letter-spacing:0.04em">
      Open HA Office
    </a>
  </p>

  <p style="margin:1.5rem 0 0.5rem;font-size:13px;color:#6b645a;text-align:center">
    Still having trouble signing in?
  </p>
  <p style="margin:0;text-align:center">
    <a href="${help}" style="display:inline-block;border:1px solid #0a0a0a;color:#0a0a0a;text-decoration:none;padding:10px 18px;font-size:13px;font-weight:600">
      Continue here
    </a>
  </p>

  <p style="margin:1.75rem 0 0;font-size:13px;color:#6b645a">
    — Hernandez &amp; Associates<br/>
    legal@hernandezlaw.info
  </p>
</div>`;
}

function buildPlain(email: string): string {
  return [
    "Good day,",
    "",
    "HA Office is now running — repaired and updated.",
    "",
    `Desktop / install guide: ${INSTALL}`,
    `Sign in: ${LOGIN}`,
    `iPhone: open that link in Safari → Share → Add to Home Screen.`,
    "",
    "Use only your authorized Google account.",
    "",
    `If you still cannot sign in, open: ${helpUrl(email)}`,
    "",
    "— Hernandez & Associates / legal@hernandezlaw.info"
  ].join("\n");
}

async function main() {
  loadEnvLocal();

  const { getCronGoogleAccessToken } = await import("../src/lib/cron-google-auth");
  const { sendHtmlEmailViaGmail } = await import("../src/lib/office-tasks/gmail-send");
  const {
    DEFAULT_FIRM_LAWYERS_ROSTER,
    FIRM_SECRETARIES,
    MANAGING_PARTNER
  } = await import("../src/lib/firm-team-config");

  const token = await getCronGoogleAccessToken();
  if (!token) {
    throw new Error("Set CRON_GOOGLE_REFRESH_TOKEN in web/.env.local (firm Gmail for legal@).");
  }

  const fromEnv =
    process.env.ALLOWED_EMAILS?.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) || [];
  const roster = [
    ...MANAGING_PARTNER.emails,
    ...DEFAULT_FIRM_LAWYERS_ROSTER.map((l) => l.email),
    ...FIRM_SECRETARIES.map((s) => s.email)
  ].map((e) => e.trim().toLowerCase());
  const recipients = [...new Set([...fromEnv, ...roster].filter(Boolean))];

  if (!recipients.length) throw new Error("No staff recipients found.");

  console.log(`Sending launch announcement to ${recipients.length} recipients from legal@…`);
  const subject = "HA Office is ready — install on desktop & mobile";

  for (const to of recipients) {
    await sendHtmlEmailViaGmail({
      accessToken: token,
      to,
      subject,
      html: buildHtml(to),
      plain: buildPlain(to)
    });
    console.log("sent", to);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
