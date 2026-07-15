import { describe, expect, it } from "vitest";
import {
  collectPresenceFromSettings,
  isPresenceOnline,
  parsePresenceEntry,
  presenceSettingKey,
  serializePresenceEntry
} from "@/lib/staff-presence";
import { isAllowedTasksTab, tasksNavTabsForUser } from "@/lib/workspace-labels";
import { isFirmOwnerEmail } from "@/lib/firm-team-config";

describe("staff presence", () => {
  it("round-trips a heartbeat entry", () => {
    const raw = serializePresenceEntry({
      email: "legal@hernandezlaw.info",
      displayName: "Shiela",
      workspace: "billing",
      path: "/billing",
      lastSeen: "2026-07-15T10:00:00.000Z"
    });
    expect(parsePresenceEntry(raw)).toEqual({
      email: "legal@hernandezlaw.info",
      displayName: "Shiela",
      workspace: "billing",
      path: "/billing",
      lastSeen: "2026-07-15T10:00:00.000Z"
    });
  });

  it("treats recent heartbeats as online", () => {
    const now = Date.parse("2026-07-15T12:00:00.000Z");
    expect(isPresenceOnline(new Date(now - 60_000).toISOString(), now)).toBe(true);
    expect(isPresenceOnline(new Date(now - 10 * 60_000).toISOString(), now)).toBe(false);
  });

  it("collects presence keys from settings and drops stale rows", () => {
    const now = Date.parse("2026-07-15T12:00:00.000Z");
    const settings = new Map([
      [
        presenceSettingKey("legal@hernandezlaw.info"),
        serializePresenceEntry({
          email: "legal@hernandezlaw.info",
          displayName: "Shiela",
          workspace: "hub",
          path: "/office-hub",
          lastSeen: new Date(now - 60_000).toISOString()
        })
      ],
      [
        presenceSettingKey("old@example.com"),
        serializePresenceEntry({
          email: "old@example.com",
          displayName: "Old",
          workspace: "tasks",
          path: "/app",
          lastSeen: new Date(now - 48 * 60 * 60_000).toISOString()
        })
      ],
      ["Office Announcement", "Hello"]
    ]);

    const entries = collectPresenceFromSettings(settings, now);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.email).toBe("legal@hernandezlaw.info");
  });
  it("uses formal workspace labels", async () => {
    const { workspaceLabel } = await import("@/lib/staff-presence");
    expect(workspaceLabel("billing")).toBe("Accounts");
    expect(workspaceLabel("tasks")).toBe("Schedule");
    expect(workspaceLabel("hub")).toBe("Office Hub");
  });
});

describe("presence tab gating", () => {
  it("shows Staff attendance only for the firm owner", () => {
    expect(isFirmOwnerEmail("janinerose1191@gmail.com")).toBe(true);
    expect(isFirmOwnerEmail("atty.hernandez@hernandezlaw.info")).toBe(false);

    const ownerTabs = tasksNavTabsForUser(true, "full", { canViewPresenceTab: true });
    expect(ownerTabs.map((t) => t.id)).toContain("presence");
    expect(ownerTabs.find((t) => t.id === "presence")?.label).toBe("Staff attendance");

    const attyTabs = tasksNavTabsForUser(true, "full", { canViewPresenceTab: false }).map((t) => t.id);
    expect(attyTabs).not.toContain("presence");

    expect(isAllowedTasksTab("presence", true, "full", { canViewPresenceTab: true })).toBe(true);
    expect(isAllowedTasksTab("presence", true, "full", { canViewPresenceTab: false })).toBe(false);
    expect(isAllowedTasksTab("presence", true, "secretary", { canViewPresenceTab: false })).toBe(false);
  });
});
