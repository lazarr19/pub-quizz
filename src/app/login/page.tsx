"use client";

import { Suspense, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get("confirmed") === "1") {
      setSuccess(
        "Nalog je napravljen! Proverite email za potvrdu, pa se prijavite.",
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (isSignUp) {
      // Check email whitelist before attempting signup
      const { data: allowed } = await supabase.rpc("is_email_allowed", {
        p_email: email,
      });
      if (!allowed) {
        setError("Registracija nije dozvoljena za ovu email adresu.");
        setLoading(false);
        return;
      }

      // Validate that the nickname is provided, one word, and unique
      if (!displayName.trim()) {
        setError("Nadimak je obavezan.");
        setLoading(false);
        return;
      }

      if (/\s/.test(displayName.trim())) {
        setError("Nadimak mora biti jedna reč (bez razmaka).");
        setLoading(false);
        return;
      }

      const { data: existingEmail } = await supabase.rpc(
        "get_email_by_display_name",
        { p_display_name: displayName.trim() },
      );
      if (existingEmail) {
        setError("Ovaj nadimak je već zauzet. Izaberite drugi.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/login?confirmed=1");
        return;
      }
    } else {
      // Resolve identifier: if it looks like an email use directly, otherwise look up by nickname
      const isEmail = identifier.includes("@");
      let loginEmail = identifier;

      if (!isEmail) {
        const { data: resolvedEmail, error: rpcError } = await supabase.rpc(
          "get_email_by_display_name",
          { p_display_name: identifier.trim() },
        );
        if (rpcError || !resolvedEmail) {
          setError("Korisnik sa ovim nadimkom nije pronađen.");
          setLoading(false);
          return;
        }
        loginEmail = resolvedEmail;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push("/lobby");
        router.refresh();
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <img
            src="/kzz-logo.png"
            alt="KZZ"
            className="w-16 h-16 object-contain mx-auto mb-3"
          />
          <h1 className="text-2xl font-bold">Ko Zna Zna</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Pripremi se za kviz, osvoji znanje
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--card)] rounded-2xl p-6 space-y-4 border border-[var(--border)]"
        >
          <h2 className="text-lg font-semibold text-center">
            {isSignUp ? "Napravi nalog" : "Dobrodošli nazad"}
          </h2>

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-500 text-sm rounded-lg p-3">
              {success}
            </div>
          )}

          {error && (
            <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {isSignUp && (
            <>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">
                  Nadimak
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="Vaš jedinstveni nadimak"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </>
          )}

          {!isSignUp && (
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">
                Email ili nadimak
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                placeholder="you@example.com ili nadimak"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">
              Lozinka
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors disabled:opacity-50"
          >
            {loading
              ? "Učitavanje..."
              : isSignUp
                ? "Napravi nalog"
                : "Prijavi se"}
          </button>

          <p className="text-center text-sm text-[var(--muted)]">
            {isSignUp ? "Već imate nalog?" : "Nemate nalog?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setSuccess("");
              }}
              className="text-[var(--accent)] hover:underline"
            >
              {isSignUp ? "Prijavi se" : "Registruj se"}
            </button>
          </p>
        </form>

        <p className="text-center mt-4">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ← Nazad na početnu
          </button>
        </p>
      </div>
    </div>
  );
}
