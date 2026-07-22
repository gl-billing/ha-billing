"use client";

import type { FirmWorkspace } from "@/components/FirmWorkspaceShell";

const WORKSPACE_LABELS: Record<FirmWorkspace, string> = {
  billing: "Office",
  tasks: "Office"
};

type Props = {
  workspace?: FirmWorkspace;
  page?: string;
  detail?: string;
  className?: string;
};

export function WorkspaceBreadcrumb({ workspace, page, detail, className = "" }: Props) {
  return (
    <nav
      className={`workspace-breadcrumb no-print ${className}`.trim()}
      aria-label="You are here"
    >
      <span className="workspace-breadcrumb__root">Hernandez &amp; Associates</span>
      {workspace ? (
        <>
          <span className="workspace-breadcrumb__sep" aria-hidden>
            ·
          </span>
          <span className="workspace-breadcrumb__segment">{WORKSPACE_LABELS[workspace]}</span>
        </>
      ) : null}
      {page ? (
        <>
          <span className="workspace-breadcrumb__sep" aria-hidden>
            ·
          </span>
          <span
            className={`workspace-breadcrumb__segment ${
              !detail ? "workspace-breadcrumb__segment--current" : ""
            }`}
          >
            {page}
          </span>
        </>
      ) : null}
      {detail ? (
        <>
          <span className="workspace-breadcrumb__sep" aria-hidden>
            ·
          </span>
          <span className="workspace-breadcrumb__segment workspace-breadcrumb__segment--detail">
            {detail}
          </span>
        </>
      ) : null}
    </nav>
  );
}
