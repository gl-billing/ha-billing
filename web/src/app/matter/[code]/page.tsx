import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { MatterPage } from "@/components/matter/MatterPage";
import { authOptions } from "@/lib/auth";

type Props = { params: Promise<{ code: string }> };

export default async function MatterRoutePage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const { code } = await params;
  const matterCode = decodeURIComponent(code).trim().toUpperCase();
  if (!matterCode) {
    redirect("/app");
  }

  return (
    <Suspense
      fallback={
        <div className="app-shell py-12 text-center">
          <p className="text-sm font-extrabold text-ink">Loading matter…</p>
        </div>
      }
    >
      <MatterPage matterCode={matterCode} user={session.user} />
    </Suspense>
  );
}
