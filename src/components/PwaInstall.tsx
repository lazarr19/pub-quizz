"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "kzz-install-dismissed-at";
const DISMISS_DAYS = 1;
const LAST_SHOWN_KEY = "kzz-install-last-shown-at";
const RESHOW_COOLDOWN_DAYS = 3;

function daysSince(key: string) {
  const raw = localStorage.getItem(key);
  if (!raw) return Infinity;
  return (Date.now() - Number(raw)) / (1000 * 60 * 60 * 24);
}

function markShown() {
  localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
}

export default function PwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    if (isStandalone) return;
    // Explicit "Ne sada" blocks it for 14 days; otherwise it can resurface every few days.
    if (daysSince(DISMISS_KEY) < DISMISS_DAYS) return;
    if (daysSince(LAST_SHOWN_KEY) < RESHOW_COOLDOWN_DAYS) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
      markShown();
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // iOS Safari has no beforeinstallprompt API, so show manual instructions instead.
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios/i.test(ua);
    if (isIos && isSafari) {
      setShowIosBanner(true);
      setVisible(true);
      markShown();
    }

    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl p-4 flex items-start gap-3">
      <span className="text-2xl">📲</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Instaliraj KZZ aplikaciju</p>
        {showIosBanner ? (
          <p className="text-xs text-[var(--muted)] mt-1">
            Dodirni <span className="font-semibold">Deli</span>, pa{" "}
            <span className="font-semibold">Dodaj na Home Screen</span>.
          </p>
        ) : (
          <p className="text-xs text-[var(--muted)] mt-1">
            Brži pristup, bez adresne trake, kao prava aplikacija.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1 items-end shrink-0">
        {!showIosBanner && (
          <button
            onClick={handleInstall}
            className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            Instaliraj
          </button>
        )}
        <button
          onClick={dismiss}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Ne sada
        </button>
      </div>
    </div>
  );
}
