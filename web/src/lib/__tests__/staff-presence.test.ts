import { describe, expect, it } from "vitest";
import {
  applyPresenceHeartbeat,
  collectPresenceFromSettings,
  flattenPresenceLoginLog,
  isPresenceOnline,
  parsePresenceEntry,
  presenceSettingKey,
  serializePresenceEntry
} from "@/lib/staff-presence";
import { isAllowedTasksTab, tasksNavTabsForUser } from "@/lib/workspace-labels";
import { isFirmOwnerEmail } from "@/lib/firm-team-config";

describe("staff presence", () => {
  it("round-trips a heartbeat entry with last signed in", () => {
    const raw = serializePresenceEntry({
      email: "legal@hernandezlaw.info",
      displayName: "Shiela",
      workspace: "billing",
      path: "/billing",
      lastSeen: "2026-07-15T10:30:00.000Z",
      lastSignedIn: "2026-07-15T10:00:00.000Z",
      recentLogins: [{ at: "2026-07-15T10:00:00.000Z", workspace: "billing" }]
    });
    expect(parsePresenceEntry(raw)).toEqual({
      email: "legal@hernandezlaw.info",
      displayName: "Shiela",
      workspace: "billing",
      path: "/billing",
      lastSeen: "2026-07-15T10:30:00.000Z",
      lastSignedIn: "2026-07-15T10:00:00.000Z",
      recentLogins: [{ at: "2026-07-15T10:00:00.000Z", workspace: "billing" }]
    });
  });

  it("backfills lastSignedIn from lastSeen for legacy rows", () => {
    const raw = JSON.stringify({
      email: "legal@hernandezlaw.info",
      displayName: "Shiela",
      workspace: "hub",
      path: "/",
      lastSeen: "2026-07-15T10:00:00.000Z"
    });
    const entry = parsePresenceEntry(raw);
    expect(entry?.lastSignedIn).toBe("2026-07-15T10:00:00.000Z");
    expect(entry?.recentLogins).toEqual([{ at: "2026-07-15T10:00:00.000Z", workspace: "hub" }]);
  });

  it("records a new sign-in after a session gap", () => {
    const previous = {
      email: "legal@hernandezlaw.info",
      displayName: "Shiela",
      workspace: "hub" as const,
      path: "/",
      lastSeen: "2026-07-15T08:00:00.000Z",
      lastSignedIn: "2026-07-15T08:00:00.000Z",
      recentLogins: [{ at: "2026-07-15T08:00:00.000Z", workspace: "hub" as const }]
    };
    const next = applyPresenceHeartbeat(previous, {
      email: "legal@hernandezlaw.info",
      displayName: "Shiela",
      workspace: "tasks",
      path: "/app",
      nowIso: "2026-07-15T09:00:00.000Z"
    });
    expect(next.lastSignedIn).toBe("2026-07-15T09:00:00.000Z");
    expect(next.recentLogins[0]).toEqual({ at: "2026-07-15T09:00:00.000Z", workspace: "tasks" });
    expect(next.recentLogins).toHaveLength(2);
  });

  it("does not create a new sign-in for heartbeats within the session gap", () => {
    const previous = {
      email: "legal@hernandezlaw.info",
      displayName: "Shiela",
      workspace: "hub" as const,
      path: "/",
      lastSeen: "2026-07-15T09:00:00.000Z",
      lastSignedIn: "2026-07-15T09:00:00.000Z",
      recentLogins: [{ at: "2026-07-15T09:00:00.000Z", workspace: "hub" as const }]
    };
    const next = applyPresenceHeartbeat(previous, {
      email: "legal@hernandezlaw.info",
      displayName: "Shiela",
      workspace: "billing",
      path: "/billing",
      nowIso: "2026-07-15T09:10:00.000Z"
    });
    expect(next.lastSignedIn).toBe("2026-07-15T09:00:00.000Z");
    expect(next.lastSeen).toBe("2026-07-15T09:10:00.000Z");
    expect(next.recentLogins).toHaveLength(1);
  });

  it("treats recent heartbeats as online", () => {
    const now = Date.parse("2026-07-15T12:00:00.000Z");
    expect(isPresenceOnline(new Date(now - 60_000).toISOString(), now)).toBe(true);
    expect(isPresenceOnline(new Date(now - 10 * 60_000).toISOString(), now)).toBe(false);
  });

  it("collects presence keys and keeps recent sign-in history", () => {
    const now = Date.parse("2026-07-15T12:00:00.000Z");
    const settings = new Map([
      [
        presenceSettingKey("legal@hernandezlaw.info"),
        serializePresenceEntry({
          email: "legal@hernandezlaw.info",
          displayName: "Shiela",
          workspace: "hub",
          path: "/office-hub",
          lastSeen: new Date(now - 60_000).toISOString(),
          lastSignedIn: new Date(now - 60_000).toISOString(),
          recentLogins: [{ at: new Date(now - 60_000).toISOString(), workspace: "hub" }]
        })
      ],
      [
        presenceSettingKey("old@example.com"),
        serializePresenceEntry({
          email: "old@example.com",
          displayName: "Old",
          workspace: "tasks",
          path: "/app",
          lastSeen: new Date(now - 40 * 24 * 60 * 60_000).toISOString(),
          lastSignedIn: new Date(now - 40 * 24 * 60 * 60_000).toISOString(),
          recentLogins: [
            { at: new Date(now - 40 * 24 * 60 * 60_000).toISOString(), workspace: "tasks" }
          ]
        })
      ],
      ["Office Announcement", "Hello"]
    ]);

    const entries = collectPresenceFromSettings(settings, now);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.email).toBe("legal@hernandezlaw.info");
    expect(flattenPresenceLoginLog(entries, now)).toHaveLength(1);
  });

  it("uses formal workspace labels", async () => {
    const { workspaceLabel } = await import("@/lib/staff-presence");
    expect(workspaceLabel("billing")).toBe("Accounts");
    expect(workspaceLabel("tasks")).toBe("Schedule");
    expect(workspaceLabel("hub")).toBe("Office Hub");
  });
});

describe("presence tab gating", () => {
  it("shows Staff attendance for firm admins (owner + managing partner)", () => {
    expect(isFirmOwnerEmail("janinerose1191@gmail.com")).toBe(true);
    expect(isFirmOwnerEmail("atty.hernandez@hernandezlaw.info")).toBe(false);

    const ownerTabs = tasksNavTabsForUser(true, "full", { canViewPresenceTab: true });
    expect(ownerTabs.map((t) => t.id)).toContain("presence");
    expect(ownerTabs.find((t) => t.id === "presence")?.label).toBe("Staff attendance");

    const partnerTabs = tasksNavTabsForUser(true, "full", { canViewPresenceTab: true }).map((t) => t.id);
    expect(partnerTabs).toContain("presence");

    const secretaryTabs = tasksNavTabsForUser(true, "full", { canViewPresenceTab: false }).map((t) => t.id);
    expect(secretaryTabs).not.toContain("presence");

    expect(isAllowedTasksTab("presence", true, "full", { canViewPresenceTab: true })).toBe(true);
    expect(isAllowedTasksTab("presence", true, "full", { canViewPresenceTab: false })).toBe(false);
    expect(isAllowedTasksTab("presence", true, "secretary", { canViewPresenceTab: false })).toBe(false);
  });
});
