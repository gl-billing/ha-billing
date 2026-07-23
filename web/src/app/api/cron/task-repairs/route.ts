import { getCronGoogleAccessToken } from "@/lib/cron-google-auth";
import { runCronRoute } from "@/lib/cron-route-handler";
import { runTasksRepairs, formatTasksRepairReceipt, totalTasksRepairMutations } from "@/lib/office-tasks/tasks-repairs";

/** Vercel Cron — sheet task repairs. */
export async function GET(request: Request) {
  return runCronRoute(request, "task-repairs", async () => {
    const accessToken = await getCronGoogleAccessToken();
    if (!accessToken) {
      throw new Error("Cron Google token not configured.");
    }
    const result = await runTasksRepairs(accessToken, "cron", { createTasks: true });
    const mutations = totalTasksRepairMutations(result.counts);
    const receipt = formatTasksRepairReceipt(result.counts);
    return {
      mutations,
      counts: result.counts,
      message:
        result.error ||
        receipt ||
        (mutations > 0 ? "Task repairs completed." : "Task repairs ran — no sheet changes needed.")
    };
  });
}
