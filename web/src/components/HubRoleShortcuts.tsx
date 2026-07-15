"use client";

import { SameWindowLink } from "@/components/SameWindowLink";
import { billingHref } from "@/lib/billing-routes";
import { tasksHref } from "@/lib/tasks-routes";

type Props = {
  billingAccess: boolean;
  isAdmin: boolean;
  secretaryNav: boolean;
};

/** Single quiet link — not a launcher grid. */
export function HubRoleShortcuts({ billingAccess, isAdmin, secretaryNav = false }: Props) {
  if (secretaryNav) {
    return (
      <p className="hub-assigned-line firm-auth-animate firm-auth-animate--2">
        <SameWindowLink href={tasksHref({ tab: "today" })} className="hub-assigned-line__link">
          Assigned today
        </SameWindowLink>
        <span className="hub-assigned-line__sep" aria-hidden>
          ·
        </span>
        <SameWindowLink href={billingHref({ page: "walkIns" })} className="hub-assigned-line__link">
          Walk-in log
        </SameWindowLink>
      </p>
    );
  }

  if (isAdmin || billingAccess) {
    return (
      <p className="hub-assigned-line firm-auth-animate firm-auth-animate--2">
        <SameWindowLink href={tasksHref({ tab: "today" })} className="hub-assigned-line__link">
          Assigned today
        </SameWindowLink>
        {billingAccess ? (
          <>
            <span className="hub-assigned-line__sep" aria-hidden>
              ·
            </span>
            <SameWindowLink href={billingHref({ page: "billing" })} className="hub-assigned-line__link">
              Record fees &amp; payments
            </SameWindowLink>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <p className="hub-assigned-line firm-auth-animate firm-auth-animate--2">
      <SameWindowLink href={tasksHref({ tab: "today" })} className="hub-assigned-line__link">
        Assigned today
      </SameWindowLink>
    </p>
  );
}
