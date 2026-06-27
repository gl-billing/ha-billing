import { NextResponse } from "next/server";
import { canAccessBilling, canEditDeskBilling, isSecretaryNavUser, isStaffEmail } from "@/lib/app-access";
import { canManageTeamRoster, isAdminEmail } from "@/lib/admin";
import { getSafeServerSession } from "@/lib/safe-server-session";

export async function GET() {
  try {
    const session = await getSafeServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const billingAccess = canAccessBilling(session.user.email);
    const secretaryNav = billingAccess && isSecretaryNavUser(session.user.email);
    const deskBillingEdit = billingAccess && canEditDeskBilling(session.user.email);

    return NextResponse.json({
      email: session.user.email,
      isAdmin: isAdminEmail(session.user.email),
      canManageTeamRoster: canManageTeamRoster(session.user.email),
      billingAccess,
      tasksOnly: !billingAccess,
      secretaryNav,
      deskBillingEdit,
      officeAccess: isStaffEmail(session.user.email)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
