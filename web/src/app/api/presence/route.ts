import { NextResponse } from "next/server";
import { isStaffEmail } from "@/lib/app-access";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { isFirmOwnerEmail } from "@/lib/firm-team-config";
import { getSafeServerSession } from "@/lib/safe-server-session";
import { listStaffPresence, upsertStaffPresenceHeartbeat } from "@/lib/sheets/staff-presence";
import type { PresenceWorkspace } from "@/lib/staff-presence";
import { formatStaffDisplayName } from "@/lib/user-display";

function parseWorkspace(value: unknown): PresenceWorkspace {
  if (value === "billing" || value === "tasks" || value === "hub") return value;
  return "hub";
}

/** Janine-only: list who is online / recently opened the app. */
export async function GET() {
  try {
    const session = await getSafeServerSession();
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isFirmOwnerEmail(email)) {
      return NextResponse.json({ error: "Only firm management may view the attendance register." }, { status: 403 });
    }

    const token = await requireSessionAccessToken();
    const entries = await listStaffPresence(token);
    return NextResponse.json({
      entries,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the attendance register.";
    const status = message.includes("Unauthorized") || message.includes("sign in") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Any signed-in staff: soft heartbeat (fails quietly for sheet permission issues). */
export async function POST(request: Request) {
  try {
    const session = await getSafeServerSession();
    const email = session?.user?.email;
    if (!email || !isStaffEmail(email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      workspace?: unknown;
      path?: unknown;
    };

    const token = await requireSessionAccessToken();
    const entry = await upsertStaffPresenceHeartbeat(token, {
      email,
      displayName:
        formatStaffDisplayName(session.user?.name, email) ||
        session.user?.displayName ||
        email,
      workspace: parseWorkspace(body.workspace),
      path: typeof body.path === "string" ? body.path : "/"
    });

    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    // Sheet not shared / quota — don't block the UI; presence is best-effort.
    const message = error instanceof Error ? error.message : "Presence update failed.";
    return NextResponse.json({ ok: false, skipped: true, error: message }, { status: 200 });
  }
}
