import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { runCronRoute } from "@/lib/cron-route-handler";
import { seedDueRetainerBillingTasks } from "@/lib/retainer-billing-autopilot";

/** Vercel Cron — post retainer fees / SOA when due. */
export async function GET(request: Request) {
  return runCronRoute(request, "retainer-billing", async () => {
    const accessToken = await getCronGoogleAccessToken();
    if (!accessToken) {
      throw new Error(
        "Set CRON_GOOGLE_REFRESH_TOKEN so retainer billing can run without a staff session."
      );
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("dry-run") === "1";
    const today = url.searchParams.get("today") || undefined;

    const result = await seedDueRetainerBillingTasks(accessToken, {
      auditUser: dryRun ? "cron:retainer-billing:dry-run" : "cron:retainer-billing",
      dryRun,
      today
    });

    const parts: string[] = [];
    if (dryRun) parts.push("dry-run");
    if (result.chargesPosted) parts.push(`posted ${result.chargesPosted} retainer charge(s)`);
    if (result.soasSent) parts.push(`emailed ${result.soasSent} SOA(s)`);
    if (result.created) parts.push(`created ${result.created} fallback task(s)`);
    if (result.errors.length) parts.push(`${result.errors.length} issue(s)`);
    if (result.planned?.length) parts.push(result.planned.join("; "));

    return {
      ...result,
      message: parts.length ? parts.join("; ") + "." : "No retainer billing due today."
    };
  });
}
