"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Props {
  // Where the signup came from ("hub", "fon-probni-test-1-result", ...).
  source: string;
}

export default function NotifyForm({ source }: Props) {
  const [email, setEmail] = useState("");
  // Honeypot: real visitors never see or fill this, bots usually do.
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    if (website) {
      setStatus("done");
      return;
    }
    const value = email.trim();
    if (!EMAIL_RE.test(value) || value.length > 254) {
      setStatus("error");
      setError("Unesi ispravnu email adresu.");
      return;
    }
    setStatus("sending");
    // Loaded on demand so the Supabase client stays out of the page's
    // initial JavaScript (this form sits on an SEO landing page).
    let failed = false;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { error: rpcError } = await createClient().rpc(
        "subscribe_test_notifications",
        { p_email: value, p_source: source },
      );
      failed = !!rpcError;
    } catch {
      failed = true;
    }
    if (failed) {
      setStatus("error");
      setError("Nešto nije u redu. Pokušaj ponovo za koji trenutak.");
      return;
    }
    try {
      track("toi_notify_signup", { source });
    } catch {
      // analytics must never break the form
    }
    setStatus("done");
  };

  if (status === "done") {
    return (
      <p className="text-sm text-[var(--success)] font-medium" role="status">
        ✓ Hvala! Javićemo ti čim objavimo nove testove.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <div className="flex gap-2 flex-col sm:flex-row">
        <label htmlFor={`notify-${source}`} className="sr-only">
          Email adresa
        </label>
        <input
          id={`notify-${source}`}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tvoj@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? `notify-err-${source}` : undefined}
          className="flex-1 min-w-0 bg-[var(--background)] border border-[var(--border)] focus:border-[var(--accent)] outline-none rounded-xl px-4 py-3 text-base placeholder:text-[var(--muted)]"
        />
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute left-[-9999px] w-px h-px opacity-0"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white font-semibold rounded-xl px-5 py-3 text-sm transition-colors"
        >
          {status === "sending" ? "Šaljem..." : "Obavesti me"}
        </button>
      </div>
      {status === "error" && (
        <p
          id={`notify-err-${source}`}
          className="text-xs text-[var(--error)]"
          role="alert"
        >
          {error}
        </p>
      )}
      <p className="text-xs text-[var(--muted)]">
        Šaljemo samo obaveštenja o novim testovima, bez spama.
      </p>
    </form>
  );
}
