import { getAllMasterRows } from "@/lib/sheets/master";
import { withCache } from "@/lib/sheets/cache";
import { getCachedAllItems, getCachedEmployeeDirectory } from "@/lib/office-tasks/tasks-cache";

const BOOTSTRAP_TTL_MS = 30_000;

/** Warm shared sheet caches in one parallel burst to reduce quota spikes on workspace load. */
export async function warmWorkspaceSheetCaches(accessToken: string, fresh = false): Promise<{
  warmedAt: number;
  keys: string[];
}> {
  if (fresh) {
    await Promise.all([
      getCachedAllItems(accessToken, true),
      getCachedEmployeeDirectory(accessToken),
      getAllMasterRows(accessToken)
    ]);
    return { warmedAt: Date.now(), keys: ["tasks-items", "tasks-employees", "master-rows"] };
  }

  return withCache(accessToken, "workspace-bootstrap", BOOTSTRAP_TTL_MS, async () => {
    await Promise.all([
      getCachedAllItems(accessToken),
      getCachedEmployeeDirectory(accessToken),
      getAllMasterRows(accessToken)
    ]);
    return { warmedAt: Date.now(), keys: ["tasks-items", "tasks-employees", "master-rows"] };
  });
}
