"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  applyLayoutChrome,
  canUseMobileLayout,
  DEFAULT_LAYOUT_MODE,
  getSavedLayoutMode,
  isLayoutMode,
  isPhoneDevice,
  readLayoutQuery,
  saveLayoutMode,
  subscribeLayoutMode,
  type LayoutMode
} from "@/lib/layout-mode-prefs";

type LayoutModeContextValue = {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  /** Phone, compact desk, or ?ha-layout=mobile preview — may use the native mobile office. */
  isPhone: boolean;
  /** Real phone UA or ≤767px viewport. Desktop windows stay false. */
  isPhoneDevice: boolean;
};

const LayoutModeContext = createContext<LayoutModeContextValue | null>(null);

type Props = {
  children: ReactNode;
  serverLayoutMode?: LayoutMode;
};

export function LayoutModeProvider({
  children,
  serverLayoutMode = DEFAULT_LAYOUT_MODE
}: Props) {
  const initial = isLayoutMode(serverLayoutMode) ? serverLayoutMode : DEFAULT_LAYOUT_MODE;
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(initial);
  const [isPhone, setIsPhone] = useState(false);
  const [phoneDevice, setPhoneDevice] = useState(false);

  useLayoutEffect(() => {
    function sync() {
      const query = readLayoutQuery();
      if (query) saveLayoutMode(query);
      const phone = canUseMobileLayout();
      const device = isPhoneDevice();
      const saved = getSavedLayoutMode();
      const effective = applyLayoutChrome(saved, phone);
      setIsPhone((prev) => (prev === phone ? prev : phone));
      setPhoneDevice((prev) => (prev === device ? prev : device));
      setLayoutModeState((prev) => (prev === effective ? prev : effective));
    }

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const unsubLayout = subscribeLayoutMode(() => {
      const next =
        document.documentElement.getAttribute("data-layout-mode") === "mobile" ? "mobile" : "desktop";
      const phone = canUseMobileLayout();
      const device = isPhoneDevice();
      setLayoutModeState((prev) => (prev === next ? prev : next));
      setIsPhone((prev) => (prev === phone ? prev : phone));
      setPhoneDevice((prev) => (prev === device ? prev : device));
    });
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      unsubLayout();
    };
  }, []);

  const setLayoutMode = useCallback((next: LayoutMode) => {
    saveLayoutMode(next);
    const effective = applyLayoutChrome(next, canUseMobileLayout());
    setLayoutModeState(effective);
  }, []);

  const value = useMemo(
    () => ({ layoutMode, setLayoutMode, isPhone, isPhoneDevice: phoneDevice }),
    [layoutMode, setLayoutMode, isPhone, phoneDevice]
  );

  return <LayoutModeContext.Provider value={value}>{children}</LayoutModeContext.Provider>;
}

export function useLayoutMode() {
  const context = useContext(LayoutModeContext);
  if (!context) {
    throw new Error("useLayoutMode must be used within LayoutModeProvider");
  }
  return context;
}
