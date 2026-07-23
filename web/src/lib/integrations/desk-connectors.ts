/**
 * Desk-facing connector keys for the Integrations setup checklist.
 * PayMongo is intentionally excluded for HA Billing.
 */

export const DESK_CONNECTOR_IDS = ["google", "sheets", "storage"] as const;

export type DeskConnectorId = (typeof DESK_CONNECTOR_IDS)[number];

export type DeskConnectorStatus = "ok" | "warn" | "error" | "unknown";

export type DeskConnector = {
  id: DeskConnectorId;
  label: string;
  description: string;
  status: DeskConnectorStatus;
  configured: boolean;
  ok: boolean;
  message: string;
  detail?: string;
  docsUrl?: string;
  docsLabel?: string;
  canTest?: boolean;
  canReconnect?: boolean;
  reconnectHref?: string;
  settingsHref?: string;
  openHref?: string;
  openLabel?: string;
};

export type DeskConnectorMap = Record<DeskConnectorId, DeskConnector>;
