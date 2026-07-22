import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function listRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listRouteFiles(full));
    else if (entry.name === "route.ts") files.push(full);
  }
  return files;
}

function relativeRoute(file: string, root: string): string {
  return file.replace(root, "").replace(/\\/g, "/");
}

describe("api route auth gates", () => {
  const webRoot = path.join(process.cwd(), "src/app/api");
  const tasksRoutes = listRouteFiles(path.join(webRoot, "tasks"));
  const clientsRoutes = listRouteFiles(path.join(webRoot, "clients"));

  it("tasks routes use staff or billing token gates", () => {
    const offenders: string[] = [];
    for (const file of tasksRoutes) {
      const source = fs.readFileSync(file, "utf8");
      if (
        !source.includes("requireSessionAccessToken") &&
        !source.includes("requireAdminSessionAccessToken") &&
        !source.includes("requireBillingAccessToken")
      ) {
        offenders.push(relativeRoute(file, webRoot));
      }
    }
    expect(offenders, offenders.join(", ")).toEqual([]);
  });

  it("clients routes use requireBillingAccessToken or admin billing helper", () => {
    const offenders: string[] = [];
    for (const file of clientsRoutes) {
      const source = fs.readFileSync(file, "utf8");
      if (
        !source.includes("requireBillingAccessToken") &&
        !source.includes("requireAdminBillingAccessToken")
      ) {
        offenders.push(relativeRoute(file, webRoot));
      }
    }
    expect(offenders, offenders.join(", ")).toEqual([]);
  });

  it("clients routes do not call getServerSession before require* gate", () => {
    const offenders: string[] = [];
    for (const file of clientsRoutes) {
      const source = fs.readFileSync(file, "utf8");
      if (!source.includes("getServerSession")) continue;
      const gateIndex = Math.min(
        ...["requireBillingAccessToken", "requireAdminBillingAccessToken"]
          .map((name) => source.indexOf(name))
          .filter((index) => index >= 0)
      );
      const sessionIndex = source.indexOf("getServerSession");
      if (sessionIndex >= 0 && (gateIndex < 0 || sessionIndex < gateIndex)) {
        offenders.push(relativeRoute(file, webRoot));
      }
    }
    expect(offenders, offenders.join(", ")).toEqual([]);
  });
});
