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

// Supabase Auth returns error messages in English - translate the ones users
// actually hit; fall back to a generic message rather than leaking raw
// English text for anything unrecognized.
function translateAuthError(message: string): string {
  // e.g. "For security purposes, you can only request this after 37 seconds."
  const wait = message.match(/after (\d+) seconds?/);
  if (wait) return `Sačekajte još ${wait[1]} s pa pokušajte ponovo.`;
  if (/rate limit/i.test(message))
    return "Previše pokušaja. Sačekajte par minuta pa pokušajte ponovo.";
  const known: Record<string, string> = {
    "Invalid login credentials": "Pogrešan email/nadimak ili lozinka.",
    "Email not confirmed":
      "Nalog nije potvrđen. Proverite email (i folder Spam / Promocije) za link za potvrdu.",
    "User already registered": "Nalog sa ovim emailom već postoji.",
    "Password should be at least 6 characters":
      "Lozinka mora imati bar 6 karaktera.",
  };
  return known[message] ?? "Došlo je do greške. Pokušajte ponovo.";
}

function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [resending, setResending] = useState(false);
  // After signup: the address the confirmation link went to, the nickname the
  // account actually has, and whether this was a repeat of an earlier signup.
  const [sent, setSent] = useState<{
    email: string;
    name: string;
    repeat: boolean;
  } | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resendNote, setResendNote] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get("confirmed") === "1") {
      setSuccess(
        "Nalog je napravljen! Proverite email za potvrdu, pa se prijavite.",
      );
      setIsSignUp(false);
    }
  }, [searchParams]);

  // Resend cooldown (Supabase allows one confirmation email per 60 s).
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const resendSignupLink = async () => {
    if (!sent || resendIn > 0) return;
    setResending(true);
    setResendNote("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: sent.email,
    });
    setResendNote(
      error
        ? translateAuthError(error.message)
        : "Poslato ponovo! Proverite i Spam / Promocije.",
    );
    setResendIn(60);
    setResending(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    });

    if (error) {
      setError(translateAuthError(error.message));
    } else {
      setSuccess(
        "Ako nalog sa ovim emailom postoji, poslat je link za resetovanje lozinke.",
      );
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setUnconfirmedEmail("");

    if (isSignUp) {
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
      // Taken - unless by this same email (someone repeating their own
      // unconfirmed signup): let it through, Supabase just resends the link.
      if (
        existingEmail &&
        String(existingEmail).toLowerCase() !== email.trim().toLowerCase()
      ) {
        setError("Ovaj nadimak je već zauzet. Izaberite drugi.");
        setLoading(false);
        return;
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
        },
      });
      // With email confirmation on, Supabase doesn't error for an email that
      // already has a confirmed account (anti-enumeration): it returns a fake
      // user with no identities and sends nothing. Say so instead of claiming
      // the account was created.
      const alreadyRegistered =
        !error && signUpData.user?.identities?.length === 0;
      if (error && /after \d+ seconds?/.test(error.message)) {
        // Repeated within a minute: the first link is already on its way.
        setError(
          "Link za potvrdu je već poslat na ovaj email pre manje od minut. Proverite i Spam / Promocije.",
        );
      } else if (error) {
        setError(translateAuthError(error.message));
      } else if (alreadyRegistered) {
        setError(
          "Ovaj email već ima nalog. Prijavite se ili kliknite „Zaboravili ste lozinku?”.",
        );
        setIdentifier(email);
        setPassword("");
        setIsSignUp(false);
      } else {
        // A repeat signup for an UNCONFIRMED email returns the existing user
        // (Supabase resends the link, keeps the original nickname): its
        // created_at is older than the link just sent. Server timestamps on
        // both sides, so the client clock doesn't matter.
        const u = signUpData.user;
        const repeat =
          !!u?.created_at &&
          !!u?.confirmation_sent_at &&
          new Date(u.confirmation_sent_at).getTime() -
            new Date(u.created_at).getTime() >
            10_000;
        if (!repeat) {
          fetch("/api/notify-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, displayName: displayName.trim() }),
          }).catch(() => {});
        }
        setSent({
          email: email.trim(),
          name:
            (u?.user_metadata?.display_name as string | undefined) ??
            displayName.trim(),
          repeat,
        });
        setResendIn(60);
        setResendNote("");
        setPassword("");
        setLoading(false);
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
        setError(translateAuthError(error.message));
        if (error.message === "Email not confirmed") {
          setUnconfirmedEmail(loginEmail);
        }
      } else {
        router.push("/lobby");
        router.refresh();
      }
    }

    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResending(true);
    setError("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: unconfirmedEmail,
    });
    if (error) {
      setError(translateAuthError(error.message));
    } else {
      setSuccess("Link za potvrdu je ponovo poslat! Proverite email.");
      setUnconfirmedEmail("");
    }
    setResending(false);
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

        {sent ? (
          <div className="bg-[var(--card)] rounded-2xl p-6 space-y-4 border border-[var(--border)] text-center">
            <div className="text-4xl">📬</div>
            <h2 className="text-lg font-semibold">Proverite email</h2>
            {sent.repeat && (
              <p className="text-sm bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg p-3">
                Već ste započeli registraciju sa ovim emailom kao{" "}
                <span className="font-semibold">{sent.name}</span>. Poslali
                smo vam link ponovo.
              </p>
            )}
            <p className="text-sm">
              Poslali smo link za potvrdu na{" "}
              <span className="font-semibold break-all">{sent.email}</span>.
              Kliknite na njega, pa se prijavite
              {sent.repeat ? "" : (
                <>
                  {" "}kao <span className="font-semibold">{sent.name}</span>
                </>
              )}
              .
            </p>
            <p className="text-sm text-[var(--muted)]">
              Email može da stigne za minut. Ako ga ne vidite, proverite
              folder <span className="font-semibold text-[var(--foreground)]">Spam</span>{" "}
              ili <span className="font-semibold text-[var(--foreground)]">Promocije</span>.
            </p>
            {resendNote && <p className="text-xs text-[var(--muted)]">{resendNote}</p>}
            <button
              type="button"
              onClick={resendSignupLink}
              disabled={resending || resendIn > 0}
              className="w-full border border-[var(--border)] hover:border-[var(--accent)] rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {resending
                ? "Šaljem..."
                : resendIn > 0
                  ? `Pošalji ponovo (${resendIn} s)`
                  : "Pošalji ponovo"}
            </button>
            <p className="text-xs text-[var(--muted)]">
              Pogrešan email?{" "}
              <button
                type="button"
                onClick={() => {
                  setSent(null);
                  setError("");
                  setSuccess("");
                }}
                className="text-[var(--accent-text)] hover:underline"
              >
                Registrujte se ponovo
              </button>{" "}
              ·{" "}
              <button
                type="button"
                onClick={() => {
                  setIdentifier(sent.email);
                  setSent(null);
                  setIsSignUp(false);
                  setError("");
                  setSuccess("");
                }}
                className="text-[var(--accent-text)] hover:underline"
              >
                Već sam potvrdio/la — prijava
              </button>
            </p>
          </div>
        ) : (
        <form
          onSubmit={forgotPassword ? handleForgotPassword : handleSubmit}
          className="bg-[var(--card)] rounded-2xl p-6 space-y-4 border border-[var(--border)]"
        >
          <h2 className="text-lg font-semibold text-center">
            {forgotPassword
              ? "Resetujte lozinku"
              : isSignUp
                ? "Napravi nalog"
                : "Dobrodošli nazad"}
          </h2>

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-500 text-sm rounded-lg p-3">
              {success}
            </div>
          )}

          {error && (
            <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm rounded-lg p-3 space-y-2">
              <p>{error}</p>
              {unconfirmedEmail && (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resending}
                  className="text-xs font-semibold underline hover:no-underline disabled:opacity-50"
                >
                  {resending ? "Šaljem..." : "Pošalji link ponovo"}
                </button>
              )}
            </div>
          )}

          {forgotPassword ? (
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                placeholder="you@example.com"
              />
            </div>
          ) : (
            <>
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

              {!isSignUp && (
                <div className="text-right -mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPassword(true);
                      setError("");
                      setSuccess("");
                    }}
                    className="text-xs text-[var(--muted)] hover:text-[var(--accent-text)] transition-colors"
                  >
                    Zaboravili ste lozinku?
                  </button>
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors disabled:opacity-50"
          >
            {loading
              ? "Učitavanje..."
              : forgotPassword
                ? "Pošalji link za reset"
                : isSignUp
                  ? "Napravi nalog"
                  : "Prijavi se"}
          </button>

          <p className="text-center text-sm text-[var(--muted)]">
            {forgotPassword ? (
              <button
                type="button"
                onClick={() => {
                  setForgotPassword(false);
                  setError("");
                  setSuccess("");
                }}
                className="text-[var(--accent-text)] hover:underline"
              >
                ← Nazad na prijavu
              </button>
            ) : (
              <>
                {isSignUp ? "Već imate nalog?" : "Nemate nalog?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                    setSuccess("");
                  }}
                  className="text-[var(--accent-text)] hover:underline"
                >
                  {isSignUp ? "Prijavi se" : "Registruj se"}
                </button>
              </>
            )}
          </p>
        </form>
        )}

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
