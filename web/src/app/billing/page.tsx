import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { canAccessBilling } from "@/lib/app-access";
import { authOptions } from "@/lib/auth";
import { BillingApp } from "@/components/BillingApp";

export default async function BillingPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (!canAccessBilling(session.user?.email)) {
    redirect("/office-hub");
  }

  return (
    <Suspense fallback={null}>
      <BillingApp />
    </Suspense>
  );
}
