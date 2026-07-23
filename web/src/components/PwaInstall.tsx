"use client";

import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "ha-office-pwa-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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

export function isPrivateDevHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    /^192\.168\./.test(h) ||
    /^10\./.test(h) ||
    h.endsWith(".local")
  );
}

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* optional */
    });
  }, []);

  return null;
}

/** Reserved — no top-of-page banners (keeps login and portal clean). */
export function PwaWrongHomeScreenHint() {
  return null;
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState<"safari" | "other" | null>(null);

  useEffect(() => {
    if (isPrivateDevHost() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    if (isIos()) {
      setIosMode(isIosSafari() ? "safari" : "other");
      setVisible(true);
      return;
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setDeferred(null);
  }

  if (!visible) return null;

  return (
    <div
      className="pwa-install-banner"
      role="dialog"
      aria-label="Add HA Office to Home Screen"
    >
      <div className="pwa-install-banner__inner">
        <div className="flex items-start gap-3">
          <img
            src="/apple-touch-icon.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 border border-white/30"
          />
          <div className="min-w-0">
            <p className="text-sm font-extrabold">Add HA Office to your home screen</p>
            {iosMode === "safari" ? (
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[11px] leading-relaxed text-white/85">
                <li>
                  Select <strong>Share</strong> at the bottom of Safari
                </li>
                <li>
                  Scroll and select <strong>Add to Home Screen</strong>
                </li>
                <li>Select <strong>Add</strong></li>
              </ol>
            ) : iosMode === "other" ? (
              <p className="mt-1 text-[11px] leading-relaxed text-white/85">
                Open this page in <strong>Safari</strong>, then Share → Add to Home Screen.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-white/80">
                Install for desk access from the home screen.
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 sm:ml-2">
          {!iosMode && deferred ? (
            <button type="button" className="btn-gold !text-xs" onClick={() => void install()}>
              Install
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-white/25 px-3 py-1.5 text-[11px] font-bold text-white/90 hover:bg-white/10"
            onClick={dismiss}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
