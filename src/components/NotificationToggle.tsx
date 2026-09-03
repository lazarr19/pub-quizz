"use client";

import { useEffect, useState } from "react";
import {
  isPushSupported,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/subscribe";

// variant "row": full-width list item (mobile menu). "icon": compact button (desktop nav).
export default function NotificationToggle({
  variant = "icon",
}: {
  variant?: "icon" | "row";
}) {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }
    setBlocked(Notification.permission === "denied");
    getExistingSubscription().then((sub) => setEnabled(!!sub));
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
      } else {
        const sub = await subscribeToPush();
        setEnabled(!!sub);
        setBlocked(Notification.permission === "denied");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!supported) return null;

  const label = blocked
    ? "🔕 Obaveštenja blokirana"
    : enabled
      ? "🔔 Obaveštenja uključena"
      : "🔔 Uključi obaveštenja";
  const title = blocked
    ? "Dozvoli obaveštenja u podešavanjima pregledača"
    : undefined;

  if (variant === "row") {
    return (
      <button
        onClick={toggle}
        disabled={loading || blocked}
        title={title}
        className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--card-hover)] transition-colors flex items-center gap-2 disabled:opacity-50"
      >
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading || blocked}
      title={title}
      className="text-xs bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors disabled:opacity-50"
    >
      {label}
    </button>
  );
}
