"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isPushSupported,
  getExistingSubscription,
  subscribeToPush,
} from "@/lib/push/subscribe";

const DISMISS_KEY = "kzz-notify-dismissed-at";
const DISMISS_DAYS = 7;
const LAST_SHOWN_KEY = "kzz-notify-last-shown-at";
const RESHOW_COOLDOWN_DAYS = 3;

function daysSince(key: string) {
  const raw = localStorage.getItem(key);
  if (!raw) return Infinity;
  return (Date.now() - Number(raw)) / (1000 * 60 * 60 * 24);
}

// Proactive nudge to enable push notifications, shown once conditions are met -
// the toggle in the AppShell menu alone is too easy to miss. Positioned above
// PwaInstall's banner (bottom-24 vs bottom-4) so the two can stack without overlapping.
export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (Notification.permission !== "default") return; // already granted or denied
    if (daysSince(DISMISS_KEY) < DISMISS_DAYS) return;
    if (daysSince(LAST_SHOWN_KEY) < RESHOW_COOLDOWN_DAYS) return;

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return; // only nudge logged-in users - subscribe needs auth

      getExistingSubscription().then((sub) => {
        if (sub) return;
        localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
        setVisible(true);
      });
    });
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const enable = async () => {
    setLoading(true);
    try {
      const sub = await subscribeToPush();
      if (sub) {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    } finally {
      setLoading(false);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl p-4 flex items-start gap-3">
      <span className="text-2xl">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Ne propusti izazov dana</p>
        <p className="text-xs text-[var(--muted)] mt-1">
          Uključi obaveštenja da te podsetimo kad je izazov spreman i kad je tvoj streak u opasnosti.
        </p>
      </div>
      <div className="flex flex-col gap-1 items-end shrink-0">
        <button
          onClick={enable}
          disabled={loading}
          className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Uključi
        </button>
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
