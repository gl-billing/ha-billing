import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireMatterEditAccess } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getClients } from "@/lib/sheets/master";
import { buildRetainerHomeReadiness } from "@/lib/retainer-package";
import {
  formatRetainerDigestOneLiner,
  listRetainerDigestForTomorrow
} from "@/lib/retainer-month-ops";
import { seedDueRetainerBillingTasks } from "@/lib/retainer-billing-autopilot";

/**
 * Staff-only retainer ops (readiness + dry-run):
 * GET  — list retainers, emails, readiness, eve digest preview
 * GET ?preview=1 — same as GET (digest preview helper for UI buttons)
 * GET ?dryRun=1&today=YYYY-MM-DD — dry-run due retainer billing tasks (no writes)
 * POST { action: "dry-run", today?: string }
 */
export async function GET(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    requireMatterEditAccess(session?.user?.email);

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("action") === "dry-run";
    if (dryRun) {
      const result = await seedDueRetainerBillingTasks(accessToken, {
        today: url.searchParams.get("today") || undefined,
        dryRun: true,
        auditUser: session?.user?.email || "staff:retainer-dry-run"
      });
      return NextResponse.json({
        ok: true,
        message: result.planned?.length
          ? result.planned.join("; ")
          : "No retainer billing due on that date.",
        result
      });
    }

    const clients = await getClients(accessToken);
    const retainers = clients
      .map((client) => {
        const readiness = buildRetainerHomeReadiness(client);
        if (!readiness) return null;
        return {
          code: client.code,
          name: client.name,
          email: readiness.email,
          emailOk: readiness.emailOk,
          fee: readiness.fee,
          dueDay: readiness.dueDay,
          ready: readiness.ready,
          missing: readiness.missing,
          nextBillingDate: readiness.nextBillingDate
        };
      })
      .filter(Boolean);

    const digestRows = listRetainerDigestForTomorrow(clients);
    return NextResponse.json({
      retainers,
      eveDigest: {
        oneLiner: formatRetainerDigestOneLiner(digestRows),
        rows: digestRows
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed.";
    const status = /sign in|unauthorized|forbidden|access/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireSessionAccessToken();
    const session = await getServerSession(authOptions);
    requireMatterEditAccess(session?.user?.email);

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      today?: string;
    };
    const action = String(body.action || "").trim();

    if (action === "dry-run") {
      const result = await seedDueRetainerBillingTasks(accessToken, {
        today: body.today,
        dryRun: true,
        auditUser: session?.user?.email || "staff:retainer-dry-run"
      });
      return NextResponse.json({
        ok: true,
        message: result.planned?.length
          ? result.planned.join("; ")
          : "No retainer billing due on that date.",
        result
      });
    }

    return NextResponse.json({ error: 'Unknown action. Use "dry-run".' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed.";
    const status = /sign in|unauthorized|forbidden|access/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
