"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientSummary } from "@/lib/gl-config";
import { GL } from "@/lib/gl-config";
import { parseBillingDeepLink } from "@/lib/billing-routes";
import { matterHref } from "@/lib/matter-routes";
import { formatSheetsAccessHint, type SheetsAccessHint } from "@/lib/sheets-access-help";

type ClientsResponse = {
  clients: ClientSummary[];
  chargeCategories: string[];
  paymentMethods: string[];
};

type StatusReporter = {
  reportProcessing: (message: string) => void;
  reportSuccess: (message: string) => void;
  reportError: (message: string) => void;
};

export function useBillingClients(
  email: string,
  reportProcessing: StatusReporter["reportProcessing"],
  reportSuccess: StatusReporter["reportSuccess"],
  reportError: StatusReporter["reportError"]
) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [chargeCategories, setChargeCategories] = useState<string[]>([...GL.chargeCategories]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([...GL.paymentMethods]);
  const [clientCode, setClientCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [lastLoadStatus, setLastLoadStatus] = useState<number | undefined>(undefined);
  const [lastLoadError, setLastLoadError] = useState<string | null>(null);
  const [sheetsAccessHint, setSheetsAccessHint] = useState<SheetsAccessHint | null>(null);

  const loadData = useCallback(
    async (options?: { quiet?: boolean }) => {
      setLoading(true);
      if (!options?.quiet) reportProcessing("Loading billing controls…");

      try {
        const clientsRes = await fetch("/api/clients");
        setLastLoadStatus(clientsRes.status);

        if (!clientsRes.ok) {
          const err = await clientsRes.json().catch(() => ({}));
          throw new Error(err.error || "Unable to load clients.");
        }

        const clientsData = (await clientsRes.json()) as ClientsResponse;
        setClients(clientsData.clients);
        setChargeCategories(clientsData.chargeCategories);
        setPaymentMethods(clientsData.paymentMethods);
        setLoadFailed(false);
        setLastLoadError(null);
        setSheetsAccessHint(null);

        const params =
          typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
        const deepLink = parseBillingDeepLink(params);
        const legacyClient = params.get("client")?.trim().toUpperCase();

        if (legacyClient && !deepLink?.page && !params.get("doc")) {
          router.replace(matterHref(legacyClient, undefined));
        } else {
          setClientCode((prev) => prev || deepLink?.clientCode || clientsData.clients[0]?.code || "");
        }

        if (!options?.quiet) {
          reportSuccess(
            clientsData.clients.length
              ? "Ready."
              : "No active clients found. Add clients in Master List."
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load data.";
        setClients([]);
        setLoadFailed(true);
        setLastLoadError(message);
        setSheetsAccessHint(formatSheetsAccessHint(message, email));
        reportError(message);
      } finally {
        setLoading(false);
      }
    },
    [email, reportError, reportProcessing, reportSuccess, router]
  );

  useEffect(() => {
    void loadData({ quiet: true });
  }, [loadData]);

  return {
    clients,
    chargeCategories,
    paymentMethods,
    clientCode,
    setClientCode,
    loading,
    loadFailed,
    lastLoadStatus,
    lastLoadError,
    sheetsAccessHint,
    loadData
  };
}
