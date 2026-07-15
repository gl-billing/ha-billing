"use client";

import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "gl-office-hub-pwa-dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function isIosSafari(): boolean {
  if (!isIos()) return false;
  const ua = navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua)) return false;
  return /Safari/i.test(ua) && !/Chrome/i.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** One-time iPhone hint on Office Hub only — keeps login/portal clean. */
export function OfficeHubPwaHint() {
  const [visible, setVisible] = useState(false);
  const [safariMode, setSafariMode] = useState(true);

  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    setSafariMode(isIosSafari());
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <aside className="office-hub__pwa-hint firm-auth-animate firm-auth-animate--3" aria-label="Add to Home Screen">
      <p className="office-hub__pwa-hint-title">Add HA Office to your home screen</p>
      {safariMode ? (
        <p className="office-hub__pwa-hint-text">
          Safari → Share → <strong>Add to Home Screen</strong>
        </p>
      ) : (
        <p className="office-hub__pwa-hint-text">
          Open in <strong>Safari</strong>, then Share → Add to Home Screen.
        </p>
      )}
      <button type="button" className="office-hub__pwa-hint-dismiss" onClick={dismiss}>
        Dismiss
      </button>
    </aside>
  );
}
