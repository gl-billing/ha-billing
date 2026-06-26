"use client";

import { useEffect, useState } from "react";

let cachedAdmin: boolean | null = null;
let pending: Promise<boolean> | null = null;

async function fetchIsAdmin(): Promise<boolean> {
  if (cachedAdmin !== null) return cachedAdmin;
  if (pending) return pending;
  pending = fetch("/api/me")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      cachedAdmin = Boolean(data?.isAdmin);
      return cachedAdmin;
    })
    .catch(() => {
      cachedAdmin = false;
      return false;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Cached firm-admin flag for gating event filing actions in task rows. */
export function useFirmAdmin(defaultValue = false): boolean {
  const [isAdmin, setIsAdmin] = useState(cachedAdmin ?? defaultValue);

  useEffect(() => {
    let cancelled = false;
    void fetchIsAdmin().then((value) => {
      if (!cancelled) setIsAdmin(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}

export function resetFirmAdminCache(): void {
  cachedAdmin = null;
}
