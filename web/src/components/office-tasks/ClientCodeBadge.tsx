"use client";

import type { ReactNode } from "react";
import { ClientBirthdayCake } from "@/components/ClientBirthdayCake";
import { useTodayBirthdays } from "@/components/TodayBirthdaysProvider";
import { useClientMatter } from "@/components/office-tasks/ClientMatterPanel";
import { clientCodeFromCase, parseClientCaseDisplay } from "@/lib/office-tasks/client-matter";

export function useClientCodeForCase(clientCase?: string): { code: string | null; open: () => void } {
  const matter = useClientMatter();
  const code = clientCase?.trim() ? clientCodeFromCase(clientCase) : null;
  const canOpen = Boolean(matter && code);

  return {
    code,
    open: () => {
      if (canOpen && code) matter!.openClientCode(code, clientCase?.trim() || undefined);
    }
  };
}

type ClientCaseLinkProps = {
  clientCase?: string;
  className?: string;
  children?: ReactNode;
};

/** Bold client / case name — opens the matter popup when inside ClientMatterProvider. */
export function ClientCaseLink({ clientCase, className = "", children }: ClientCaseLinkProps) {
  const matter = useClientMatter();
  const { todayCodes } = useTodayBirthdays();
  const { code, open } = useClientCodeForCase(clientCase);
  const display = parseClientCaseDisplay(clientCase);
  const showCake = Boolean(code && todayCodes.has(code));
  const title = children ?? display.title;
  const showCase = !children && display.subtitle;
  const content = (
    <span className="client-name-case-label">
      <span className="client-name-case-label__name-group">
        <span className="client-case-link__name">{title}</span>
        {showCake ? <ClientBirthdayCake /> : null}
      </span>
      {showCase ? (
        <>
          <span className="client-name-case-label__sep"> — </span>
          <span className="client-name-case-label__case">{display.subtitle}</span>
        </>
      ) : null}
    </span>
  );

  if (!matter || !code) {
    return <span className={className}>{content}</span>;
  }

  return (
    <span
      role="button"
      tabIndex={0}
      className={className}
      title={`View all ${code} tasks and events`}
      onClick={(event) => {
        event.stopPropagation();
        open();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          open();
        }
      }}
    >
      {content}
    </span>
  );
}
