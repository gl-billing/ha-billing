import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { isAdminEmail, requireAdminEmail } from "@/lib/admin";
import { requireSessionAccessToken } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { invalidateCache } from "@/lib/sheets/cache";
import {
  normalizeAnnouncementDraft,
  saveOfficeAnnouncement
} from "@/lib/sheets/settings";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    requireAdminEmail(email);

    const body = (await request.json()) as {
      message?: string;
      from?: string;
      until?: string;
    };

    const draft = normalizeAnnouncementDraft(body);
    const token = await requireSessionAccessToken();
    const state = await saveOfficeAnnouncement(token, draft);
    invalidateCache(token, "office-hub-summary");

    return NextResponse.json({
      announcement: state.active,
      announcementDraft: state.draft,
      isAdmin: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save announcement.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("owners/admins")
        ? 403
        : message.includes("must be")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ isAdmin: isAdminEmail(email) });
}
