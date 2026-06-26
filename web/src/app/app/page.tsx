import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { TasksWorkspace } from "@/components/office-tasks/TasksWorkspace";
import { canAccessTasks } from "@/lib/app-access";
import { authOptions } from "@/lib/auth";

export default async function TasksWorkspacePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!canAccessTasks(session.user.email)) {
    redirect("/login?error=AccessDenied");
  }

  return <TasksWorkspace sessionError={session.error} />;
}
