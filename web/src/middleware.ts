import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  canAccessBilling,
  isBillingApiPath,
  isBillingPagePath,
  isStaffEmail,
  warnProductionAllowlistUnset
} from "@/lib/app-access";

warnProductionAllowlistUnset();

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    // Must match authOptions.cookies.sessionToken.name (HA vs GL share localhost).
    cookieName: "ha-billing.session-token"
  });
  const email = typeof token?.email === "string" ? token.email : null;

  const publicPath =
    pathname === "/login" ||
    pathname.startsWith("/help/") ||
    pathname === "/install" ||
    pathname.startsWith("/api/help/") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/privacy" ||
    pathname === "/terms";

  if (email && !isStaffEmail(email) && !publicPath) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login?error=AccessDenied", request.url));
  }

  if (isBillingPagePath(pathname) || isBillingApiPath(pathname)) {
    if (email && !canAccessBilling(email)) {
      if (isBillingApiPath(pathname)) {
        return NextResponse.json(
          { error: "You do not have access to the billing system." },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/office-hub", request.url));
    }
  }

  const response = NextResponse.next();

  if (!pathname.startsWith("/_next/static")) {
    response.headers.set("Cache-Control", "no-store, must-revalidate");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|icons/|apple-touch-icon|api/auth).*)"]
};
