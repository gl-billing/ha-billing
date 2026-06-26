import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OfficeHubLauncher } from "@/components/OfficeHubLauncher";
import { isAdminEmail } from "@/lib/admin";
import { canAccessOfficeHub } from "@/lib/app-access";
import { getSafeServerSession } from "@/lib/safe-server-session";
import { emptyOfficeHubSummary } from "@/lib/office-hub/summary";
import { formatStaffDisplayName } from "@/lib/user-display";

export default async function OfficeHubPage() {
  const session = await getSafeServerSession();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const email = session.user.email;

  if (!canAccessOfficeHub(email)) {
    redirect("/login?error=AccessDenied");
  }

  const isAdmin = isAdminEmail(email);

  const initialSummary = {
    ...emptyOfficeHubSummary(email),
    isAdmin
  };

  const hubUser = {
    name: session.user.name,
    email,
    displayName: formatStaffDisplayName(session.user.name, email),
    billingAccess: session.user.billingAccess !== false,
    isAdmin
  };

  return (
    <Suspense fallback={<OfficeHubLoadingFallback />}>
      <OfficeHubLauncher initialSummary={initialSummary} hubUser={hubUser} />
    </Suspense>
  );
}

function OfficeHubLoadingFallback() {
  return (
    <div className="office-hub office-hub--loading">
      <p className="office-hub__loading-text">Loading office hub…</p>
    </div>
  );
}
