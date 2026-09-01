"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">(
    "checking",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    // In case the recovery session was already established before this
    // listener attached, check for it directly as a fallback.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus("ready");
    });

    const timeout = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Lozinke se ne poklapaju.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.push("/lobby");
      router.refresh();
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/kzz-logo.png"
            alt="KZZ"
            className="w-16 h-16 object-contain mx-auto mb-3"
          />
          <h1 className="text-2xl font-bold">Ko Zna Zna</h1>
        </div>

        <div className="bg-[var(--card)] rounded-2xl p-6 space-y-4 border border-[var(--border)]">
          <h2 className="text-lg font-semibold text-center">
            Nova lozinka
          </h2>

          {status === "checking" && (
            <p className="text-center text-sm text-[var(--muted)]">
              Proveravamo link...
            </p>
          )}

          {status === "invalid" && (
            <div className="space-y-3">
              <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm rounded-lg p-3 text-center">
                Link nije važeći ili je istekao. Zatražite novi link za
                resetovanje lozinke.
              </div>
              <button
                onClick={() => router.push("/login")}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
              >
                Nazad na prijavu
              </button>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm rounded-lg p-3">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">
                  Nova lozinka
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">
                  Potvrdite lozinku
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors disabled:opacity-50"
              >
                {loading ? "Čuvanje..." : "Sačuvaj lozinku"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
