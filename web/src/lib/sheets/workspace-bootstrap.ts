import { getAllMasterRows } from "@/lib/sheets/master";
import { withCache } from "@/lib/sheets/cache";
import { getCachedAllItems, getCachedEmployeeDirectory } from "@/lib/office-tasks/tasks-cache";

const BOOTSTRAP_TTL_MS = 30_000;

export type WarmWorkspaceSheetCachesOptions = {
  fresh?: boolean;
  /** Associates and tasks-only staff must not need the billing workbook to open Feed. */
  includeBilling?: boolean;
};

/** Warm shared sheet caches in one parallel burst to reduce quota spikes on workspace load. */
export async function warmWorkspaceSheetCaches(
  accessToken: string,
  freshOrOptions: boolean | WarmWorkspaceSheetCachesOptions = false,
  maybeOptions?: WarmWorkspaceSheetCachesOptions
): Promise<{
  warmedAt: number;
  keys: string[];
}> {
  const options: WarmWorkspaceSheetCachesOptions =
    typeof freshOrOptions === "boolean" ? { fresh: freshOrOptions, ...maybeOptions } : freshOrOptions;
  const fresh = Boolean(options.fresh);
  const includeBilling = options.includeBilling !== false;

  const warm = async () => {
    const keys = ["tasks-items", "tasks-employees"];
    const tasks: Array<Promise<unknown>> = [
      getCachedAllItems(accessToken, fresh),
      getCachedEmployeeDirectory(accessToken)
    ];

    if (includeBilling) {
      keys.push("master-rows");
      tasks.push(
        getAllMasterRows(accessToken).catch((error) => {
          console.error("[workspace-bootstrap] billing master", error);
          return null;
        })
      );
    }

    await Promise.all(tasks);
    return { warmedAt: Date.now(), keys };
  };

  if (fresh) return warm();

  return withCache(accessToken, includeBilling ? "workspace-bootstrap" : "workspace-bootstrap:tasks", BOOTSTRAP_TTL_MS, warm);
}
