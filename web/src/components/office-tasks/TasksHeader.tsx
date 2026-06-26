"use client";

import { FirmBrandHeader } from "@/components/FirmBrandHeader";

type Props = {
  name?: string | null;
  email?: string | null;
  displayName?: string | null;
  billingAccess?: boolean;
};

/** @deprecated Use FirmWorkspaceShell */
export function TasksHeader(props: Props) {
  return <FirmBrandHeader workspace="tasks" {...props} className="-mx-3.5 -mt-3.5 mb-4" />;
}
