import { NextResponse } from "next/server";
import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { sendHtmlEmailViaGmail } from "@/lib/office-tasks/gmail-send";
import { getAdminEmails } from "@/lib/admin";
import { FIRM_OWNER_EMAILS } from "@/lib/firm-team-config";

export const runtime = "nodejs";

type Body = {
  email?: string;
  source?: string;
  userAgent?: string;
};

function notifyRecipients(): string[] {
  const admins = getAdminEmails();
  const owners = [...FIRM_OWNER_EMAILS];
  return [...new Set([...admins, ...owners].map((e) => e.trim().toLowerCase()).filter(Boolean))];
}

/** Silent staff sign-in distress signal — emails admins; public, rate-light. */
export async function POST(request: Request) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const staffEmail = String(body.email || "").trim().toLowerCase() || "(not provided)";
  const source = String(body.source || "unknown").trim().slice(0, 80);
  const ua = String(body.userAgent || "").trim().slice(0, 240);
  const when = new Date().toISOString();

  const recipients = notifyRecipients();
  if (!recipients.length) {
    return NextResponse.json({ ok: true });
  }

  try {
    const accessToken = await getCronGoogleAccessToken();
    if (!accessToken) {
      console.error("[signin-issue] No CRON_GOOGLE_REFRESH_TOKEN — cannot email admins.", {
        staffEmail,
        source
      });
      return NextResponse.json({ ok: true });
    }

    const subject = `[HA Office] Sign-in help clicked — ${staffEmail}`;
    const plain = [
      "A staff member used the “still can’t sign in” help link.",
      `Staff email: ${staffEmail}`,
      `Source: ${source}`,
      `When: ${when}`,
      ua ? `Device: ${ua}` : "",
      "",
      "They were not told that you were notified."
    ]
      .filter(Boolean)
      .join("\n");

    const html =
      `<p>A staff member used the sign-in help link.</p>` +
      `<p><strong>Staff email:</strong> ${staffEmail}<br/>` +
      `<strong>Source:</strong> ${source}<br/>` +
      `<strong>When:</strong> ${when}</p>` +
      (ua ? `<p style="color:#666;font-size:12px">${ua}</p>` : "") +
      `<p style="color:#666;font-size:12px">They were not told that you were notified.</p>`;

    for (const to of recipients) {
      try {
        await sendHtmlEmailViaGmail({ accessToken, to, subject, html, plain });
      } catch (err) {
        console.error("[signin-issue] notify failed", to, err);
      }
    }
  } catch (err) {
    console.error("[signin-issue]", err);
  }

  // Always return ok so the staff page stays calm.
  return NextResponse.json({ ok: true });
}
