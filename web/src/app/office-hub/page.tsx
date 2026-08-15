import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { OfficeHubLauncher } from "@/components/OfficeHubLauncher";
import { isAdminEmail } from "@/lib/admin";
import { canAccessOfficeHub } from "@/lib/app-access";
import { getSafeServerSession } from "@/lib/safe-server-session";
import { emptyOfficeHubSummary } from "@/lib/office-hub/summary";
import { formatStaffDisplayName } from "@/lib/user-display";
import { LAYOUT_MODE_COOKIE, LAYOUT_MODE_QUERY, LEGACY_LAYOUT_MODE_COOKIE, shouldOpenNativeMobileHome } from "@/lib/layout-mode-prefs";
import { mobileOfficeHomeHref } from "@/lib/space-nav";

export default async function OfficeHubPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSafeServerSession();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const email = session.user.email;

  if (!canAccessOfficeHub(email)) {
    redirect("/login?error=AccessDenied");
  }

  const isAdmin = isAdminEmail(email);
  const params = searchParams ? await searchParams : undefined;
  const noticeRaw = params?.notice;
  const notice = Array.isArray(noticeRaw) ? noticeRaw[0] : noticeRaw;
  const layoutQueryRaw = params?.[LAYOUT_MODE_QUERY];
  const layoutQuery = Array.isArray(layoutQueryRaw) ? layoutQueryRaw[0] : layoutQueryRaw;
  const cookieStore = await cookies();
  const headerList = await headers();
  if (
    shouldOpenNativeMobileHome({
      layoutCookie: cookieStore.get(LAYOUT_MODE_COOKIE)?.value || cookieStore.get(LEGACY_LAYOUT_MODE_COOKIE)?.value,
      userAgent: headerList.get("user-agent"),
      layoutQuery: typeof layoutQuery === "string" ? layoutQuery : null
    })
  ) {
    const home = mobileOfficeHomeHref();
    const suffix =
      layoutQuery === "mobile" || layoutQuery === "desktop" ? `&${LAYOUT_MODE_QUERY}=${layoutQuery}` : "";
    redirect(`${home}${suffix}`);
  }

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
      <OfficeHubLauncher
        initialSummary={initialSummary}
        hubUser={hubUser}
        notice={typeof notice === "string" ? notice : undefined}
      />
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
