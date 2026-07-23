/**
 * Client-safe filing queue types/constants — no Sheets / next/headers imports.
 */

import type { FilingQueueKind } from "@/lib/office-tasks/filing-queue-route";

export const FILING_QUEUE_STATUSES = ["Queued", "Out", "Filed/served", "Proof complete"] as const;
export type FilingQueueStatus = (typeof FILING_QUEUE_STATUSES)[number];

export const FILING_PHYSICAL_MANNERS = ["Registered mail", "Personal service", "Private courier"] as const;
export type FilingPhysicalManner = (typeof FILING_PHYSICAL_MANNERS)[number];

export type FilingCopyFurnishedParty = {
  name: string;
  address?: string;
  email?: string;
};

export type FilingQueueRow = {
  sheetRow: number;
  created: string;
  queue: FilingQueueKind;
  eventId: string;
  clientCode: string;
  pleading: string;
  clientParty: string;
  whereFiled: string;
  courtAddress: string;
  courtEmail: string;
  copyFurnished: FilingCopyFurnishedParty[];
  manner: string;
  assignedTo: string;
  status: FilingQueueStatus | string;
  deadline: string;
  dateFiled: string;
  trackingOrAck: string;
  proof: string;
  notes: string;
  clientCaseLabel: string;
  eventRow: number;
};

export type FilingQueueCreateInput = {
  queue: FilingQueueKind;
  eventId: string;
  clientCode?: string;
  pleading: string;
  clientParty: string;
  whereFiled?: string;
  courtAddress?: string;
  courtEmail?: string;
  copyFurnished?: FilingCopyFurnishedParty[];
  manner?: string;
  assignedTo?: string;
  status?: string;
  deadline?: string;
  dateFiled?: string;
  trackingOrAck?: string;
  proof?: string;
  notes?: string;
  clientCaseLabel?: string;
  eventRow?: number;
};

export type FilingQueueUpdateInput = Partial<
  Omit<FilingQueueCreateInput, "eventId" | "queue"> & { queue?: FilingQueueKind }
>;
