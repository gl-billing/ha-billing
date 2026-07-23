import { NextResponse } from "next/server";
import { requireAdminSessionAccessToken } from "@/lib/api-auth";
import { sendHtmlEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import {
  DEFAULT_FIRM_LAWYERS_ROSTER,
  FIRM_SECRETARIES,
  MANAGING_PARTNER
} from "@/lib/firm-team-config";

export const runtime = "nodejs";

const APP = "https://ha-billing.vercel.app";
const LOGIN = `${APP}/login`;
const INSTALL = `${APP}/install`;

function helpUrl(email: string): string {
  const q = new URLSearchParams({ e: email, from: "launch-email" });
  return `${APP}/help/signin?${q.toString()}`;
}

function recipients(): string[] {
  const fromEnv =
    process.env.ALLOWED_EMAILS?.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean) || [];
  const roster = [
    ...MANAGING_PARTNER.emails,
    ...DEFAULT_FIRM_LAWYERS_ROSTER.map((l) => l.email),
    ...FIRM_SECRETARIES.map((s) => s.email)
  ].map((e) => e.trim().toLowerCase());
  return [...new Set([...fromEnv, ...roster].filter(Boolean))];
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
    Open <a href="${INSTALL}" style="color:#1a1612;font-weight:700">${INSTALL}</a>,
    sign in, then add the app to your Dock (Safari: File → Add to Dock · Chrome: Install from the address bar).
  </p>
  <p style="margin:1.25rem 0 0.5rem;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b645a">iPhone / mobile</p>
  <p style="margin:0 0 1rem;font-size:15px">
    In <strong>Safari</strong>, open <a href="${INSTALL}" style="color:#1a1612;font-weight:700">${INSTALL}</a>,
    sign in, then Share → <strong>Add to Home Screen</strong>.
  </p>
  <p style="margin:0 0 1.25rem;font-size:15px">
    Reminder: log in only with the Google email your office authorized for you.
  </p>
  <p style="margin:0 0 0.75rem;text-align:center">
    <a href="${LOGIN}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 22px;font-size:14px;font-weight:700">Open HA Office</a>
  </p>
  <p style="margin:1.5rem 0 0.5rem;font-size:13px;color:#6b645a;text-align:center">Still having trouble signing in?</p>
  <p style="margin:0;text-align:center">
    <a href="${help}" style="display:inline-block;border:1px solid #0a0a0a;color:#0a0a0a;text-decoration:none;padding:10px 18px;font-size:13px;font-weight:600">Continue here</a>
  </p>
  <p style="margin:1.75rem 0 0;font-size:13px;color:#6b645a">— Hernandez &amp; Associates<br/>legal@hernandezlaw.info</p>
</div>`;
}

function buildPlain(email: string): string {
  return [
    "Good day,",
    "",
    "HA Office is now running — repaired and updated.",
    `Install: ${INSTALL}`,
    `Sign in: ${LOGIN}`,
    "iPhone: Safari → Share → Add to Home Screen.",
    "Use only your authorized Google account.",
    `If you still cannot sign in: ${helpUrl(email)}`,
    "",
    "— legal@hernandezlaw.info"
  ].join("\n");
}

/** Admin-only: send launch announcement using the signed-in admin's Google token. */
export async function POST() {
  try {
    const { token, email: adminEmail } = await requireAdminSessionAccessToken();
    const list = recipients();
    const subject = "HA Office is ready — install on desktop & mobile";
    const sent: string[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    for (const to of list) {
      try {
        await sendHtmlEmailViaGmail({
          accessToken: token,
          to,
          subject,
          html: buildHtml(to),
          plain: buildPlain(to)
        });
        sent.push(to);
      } catch (err) {
        failed.push({
          email: to,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    return NextResponse.json({
      ok: failed.length === 0,
      fromAdmin: adminEmail,
      sent,
      failed
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send.";
    const status = message.includes("Admin only") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
