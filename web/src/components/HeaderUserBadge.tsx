"use client";

import { formatStaffDisplayName } from "@/lib/user-display";

type Props = {
  name?: string | null;
  email?: string | null;
  /** From session (includes USER_DISPLAY_NAMES override when set server-side). */
  displayName?: string | null;
  /** `portal` = light card on /portal; default = dark app header toolbar */
  variant?: "header" | "portal";
};

export function HeaderUserBadge({ name, email, displayName: _displayName, variant = "header" }: Props) {
  if (!email?.trim()) return null;

  const label = formatStaffDisplayName(name, email);
  const portal = variant === "portal";

  return (
    <div className={portal ? "portal-user-badge" : "brand-header__user"}>
      <p className={portal ? "portal-user-badge__greeting" : "brand-header__greeting"}>
        Hi {label}
      </p>
      <p className={portal ? "portal-user-badge__email" : "brand-header__email"}>{email}</p>
    </div>
  );
}
