"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EntryFormOptions } from "@/components/office-tasks/AddEntryForm";
import type { EditableItem } from "@/components/office-tasks/EditItemDialog";
import type { ItemSummary } from "@/components/office-tasks/ItemCard";
import { ClientMatterOverlay } from "@/components/office-tasks/ClientMatterOverlay";
import { matterReturnPathForNavigation } from "@/lib/matter-return";
import { matterHref } from "@/lib/matter-routes";
import type { ItemStatusUpdate } from "@/lib/office-tasks/status";
import type { OfficeItem } from "@/lib/office-tasks/item-types";
import type { PrepChecklistMutation } from "@/lib/office-tasks/prep-checklist-storage";
import {
  isMatterPinned,
  recordMatterVisit,
  togglePinMatter as togglePinPref
} from "@/lib/matter-prefs";
import { clearSavedMatter, getSavedMatter, saveMatter } from "@/lib/staff-prefs";

type ClientMatterContextValue = {
  activeCode: string | null;
  activeLabel: string | null;
  /** "Client profile" or "Client matter" — set from the matter page when loaded */
  activeHeaderLabel: string | null;
  isPinned: boolean;
  prefsVersion: number;
  stickyDismissed: boolean;
  openClientCode: (code: string, label?: string) => void;
  setMatterLabel: (label: string) => void;
  setMatterHeaderLabel: (label: string) => void;
  togglePin: () => boolean;
  clearMatter: () => void;
};

const ClientMatterContext = createContext<ClientMatterContextValue | null>(null);

export function useClientMatter(): ClientMatterContextValue | null {
  return useContext(ClientMatterContext);
}

export type ClientMatterProviderProps = {
  children: ReactNode;
  lazyLoadItems?: boolean;
  items?: OfficeItem[];
  togglingKey?: string | null;
  onToggleDone?: (item: ItemSummary, done: boolean) => void;
  onSetStatus?: (item: ItemSummary, status: ItemStatusUpdate) => void;
  onResetWithDate?: (item: ItemSummary, newDate: string) => void;
  onDeleteItem?: (item: ItemSummary) => void;
  onUpdateNextAction?: (item: ItemSummary, nextAction: string) => void;
  onTogglePrepChecklistItem?: (item: ItemSummary, itemIndex: number, checked: boolean) => void;
  onMutatePrepChecklistItem?: (item: ItemSummary, mutation: PrepChecklistMutation) => void | Promise<void>;
  onCreatePrepChecklist?: (item: ItemSummary) => void;
  onInitializePrepChecklist?: (item: ItemSummary) => void;
  prepChecklistCreatingKey?: string | null;
  onSaveEdit?: (item: EditableItem, payload: Record<string, unknown>) => void;
  onCourtConfirmed?: (item: ItemSummary) => void;
  formOptions?: EntryFormOptions;
  isAdmin?: boolean;
  onClientCodeRenamed?: (newCode: string) => void;
  onNotice?: (message: string, isError?: boolean) => void;
};

function matterCodeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/matter\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim().toUpperCase();
  } catch {
    return match[1].trim().toUpperCase();
  }
}

type SavedMatterState = { code: string; label?: string } | null;

export function ClientMatterProvider({
  children,
  lazyLoadItems = false,
  items: itemsProp,
  togglingKey,
  onToggleDone,
  onSetStatus,
  onResetWithDate,
  onDeleteItem,
  onUpdateNextAction,
  onTogglePrepChecklistItem,
  onMutatePrepChecklistItem,
  onCreatePrepChecklist,
  onInitializePrepChecklist,
  prepChecklistCreatingKey,
  onSaveEdit,
  onCourtConfirmed,
  formOptions,
  isAdmin = false,
  onClientCodeRenamed,
  onNotice
}: ClientMatterProviderProps) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const returnPath = useMemo(
    () => matterReturnPathForNavigation(pathname, searchParams),
    [pathname, searchParams]
  );
  const [saved, setSaved] = useState<SavedMatterState>(null);
  const [popupCode, setPopupCode] = useState<string | null>(null);
  const [lazyItems, setLazyItems] = useState<OfficeItem[]>([]);
  const [labelOverride, setLabelOverride] = useState<string | null>(null);
  const [headerLabelOverride, setHeaderLabelOverride] = useState<string | null>(null);
  const [stickyDismissed, setStickyDismissed] = useState(false);
  const [prefsVersion, setPrefsVersion] = useState(0);
  const [mounted, setMounted] = useState(false);

  const pathCode = useMemo(() => matterCodeFromPath(pathname), [pathname]);
  const overlayItems = itemsProp ?? lazyItems;

  useEffect(() => {
    setSaved(getSavedMatter());
    setMounted(true);
  }, []);

  useEffect(() => {
    setStickyDismissed(false);
    setLabelOverride(null);
    setHeaderLabelOverride(null);
  }, [pathCode]);

  useEffect(() => {
    if (!pathCode) return;
    let changed = false;
    setSaved((prev) => {
      const label = prev?.code === pathCode ? prev.label : undefined;
      if (prev?.code === pathCode && prev.label === label) return prev;
      changed = true;
      saveMatter(pathCode, label);
      recordMatterVisit(pathCode, label);
      return { code: pathCode, label };
    });
    if (changed) setPrefsVersion((version) => version + 1);
  }, [pathCode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const matter = params.get("matter")?.trim().toUpperCase();
    if (!matter) return;
    router.replace(matterHref(matter, undefined, { from: returnPath }));
    // Legacy ?matter= links — run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!popupCode || itemsProp || !lazyLoadItems) return;
    let cancelled = false;
    fetch("/api/tasks/items")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (cancelled || !response.ok) return;
        setLazyItems(Array.isArray(payload.items) ? (payload.items as OfficeItem[]) : []);
      })
      .catch(() => {
        if (!cancelled) setLazyItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [popupCode, itemsProp, lazyLoadItems]);

  const activeCode = popupCode || pathCode || saved?.code || null;
  const activeLabel =
    labelOverride ?? (saved?.code === activeCode ? saved.label || null : null);
  const activeHeaderLabel = headerLabelOverride;
  const pinned = mounted && activeCode ? isMatterPinned(activeCode) : false;

  const openClientCode = useCallback(
    (code: string, label?: string) => {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) return;
      if (pathCode === trimmed) return;

      setStickyDismissed(false);
      setLabelOverride(label?.trim() || null);
      saveMatter(trimmed, label);
      recordMatterVisit(trimmed, label);
      setSaved({ code: trimmed, label: label?.trim() || undefined });
      setPrefsVersion((version) => version + 1);
      setPopupCode(trimmed);
    },
    [pathCode]
  );

  const closePopup = useCallback(() => {
    setPopupCode(null);
  }, []);

  const handleClientCodeRenamed = useCallback(
    (newCode: string) => {
      const trimmed = newCode.trim().toUpperCase();
      if (!trimmed) return;
      setPopupCode(trimmed);
      onClientCodeRenamed?.(trimmed);
    },
    [onClientCodeRenamed]
  );

  const setMatterLabel = useCallback(
    (label: string) => {
      if (!activeCode) return;
      const trimmed = label.trim();
      if (!trimmed) return;
      if (labelOverride === trimmed) return;
      let changed = false;
      setLabelOverride(trimmed);
      setSaved((prev) => {
        if (prev?.code === activeCode && prev.label === trimmed) return prev;
        changed = true;
        saveMatter(activeCode, trimmed);
        recordMatterVisit(activeCode, trimmed);
        return { code: activeCode, label: trimmed };
      });
      if (changed) setPrefsVersion((version) => version + 1);
    },
    [activeCode, labelOverride]
  );

  const setMatterHeaderLabel = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setHeaderLabelOverride((prev) => (prev === trimmed ? prev : trimmed));
  }, []);

  const togglePin = useCallback(() => {
    if (!activeCode) return false;
    const next = togglePinPref(activeCode, activeLabel || undefined);
    setPrefsVersion((version) => version + 1);
    return next;
  }, [activeCode, activeLabel]);

  const clearMatter = useCallback(() => {
    clearSavedMatter();
    setLabelOverride(null);
    setHeaderLabelOverride(null);
    setStickyDismissed(true);
    setSaved(null);
    setPopupCode(null);
  }, []);

  const value = useMemo(
    () => ({
      activeCode,
      activeLabel,
      activeHeaderLabel,
      isPinned: pinned,
      prefsVersion,
      stickyDismissed,
      openClientCode,
      setMatterLabel,
      setMatterHeaderLabel,
      togglePin,
      clearMatter
    }),
    [
      activeCode,
      activeLabel,
      activeHeaderLabel,
      pinned,
      prefsVersion,
      stickyDismissed,
      openClientCode,
      setMatterLabel,
      setMatterHeaderLabel,
      togglePin,
      clearMatter
    ]
  );

  return (
    <ClientMatterContext.Provider value={value}>
      {children}
      {popupCode ? (
        <ClientMatterOverlay
          clientCode={popupCode}
          caseHint={labelOverride ?? (saved?.code === popupCode ? saved.label : undefined)}
          items={overlayItems}
          onClose={closePopup}
          togglingKey={togglingKey}
          onToggleDone={onToggleDone}
          onSetStatus={onSetStatus}
          onResetWithDate={onResetWithDate}
          onDeleteItem={onDeleteItem}
          onUpdateNextAction={onUpdateNextAction}
          onTogglePrepChecklistItem={onTogglePrepChecklistItem}
          onMutatePrepChecklistItem={onMutatePrepChecklistItem}
          onCreatePrepChecklist={onCreatePrepChecklist}
          onInitializePrepChecklist={onInitializePrepChecklist}
          prepChecklistCreatingKey={prepChecklistCreatingKey}
          onSaveEdit={onSaveEdit}
          onCourtConfirmed={onCourtConfirmed}
          formOptions={formOptions}
          isAdmin={isAdmin}
          onClientCodeRenamed={handleClientCodeRenamed}
          onNotice={onNotice}
        />
      ) : null}
    </ClientMatterContext.Provider>
  );
}
