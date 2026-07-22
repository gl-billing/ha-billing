"use client";

import { Suspense } from "react";
import { signOut } from "next-auth/react";
import { TasksApp } from "@/components/office-tasks/TasksApp";

type Props = {
  sessionError?: string | null;
};

export function TasksWorkspace({ sessionError }: Props) {
  if (sessionError === "RefreshAccessTokenError") {
    return (
      <div className="app-shell p-8 text-center">
        <p className="font-display text-2xl font-semibold text-ink">Session expired</p>
        <p className="mt-2 text-sm text-muted">Sign in again to refresh access to Google Sheets.</p>
        <button
          type="button"
          className="btn-primary mt-4 max-w-[240px]"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign in again
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <TasksApp />
    </Suspense>
  );
}
