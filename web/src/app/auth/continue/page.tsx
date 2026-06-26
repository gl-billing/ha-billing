import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { resolvePostLoginPath } from "@/lib/app-access";
import { AuthContinueClient } from "@/components/login/AuthContinueClient";
import { authOptions } from "@/lib/auth";
import { STAFF_GOOGLE_PROVIDER_ID } from "@/lib/guest-oauth";

export default async function AuthContinuePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const destination = resolvePostLoginPath(session.user.email);
  if (destination.startsWith("/login")) {
    redirect(destination);
  }

  return (
    <AuthContinueClient
      email={session.user.email}
      authProvider={session.authProvider ?? STAFF_GOOGLE_PROVIDER_ID}
      destination={destination}
    />
  );
}
