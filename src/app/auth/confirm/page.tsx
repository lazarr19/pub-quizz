"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmForm />
    </Suspense>
  );
}

function ConfirmForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const tokenHash = searchParams.get("token_hash");

  // Requires an explicit click before consuming the token - Supabase's
  // default confirmation link consumes its one-time token the instant
  // anything visits it, including email clients' automated link-scanners,
  // which burns it before the user ever clicks. Waiting for deliberate
  // interaction avoids that.
  const handleConfirm = async () => {
    if (!tokenHash) return;
    setLoading(true);
    setError("");

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "signup",
    });

    setLoading(false);

    if (verifyError) {
      setError(
        "Link nije važeći ili je istekao. Prijavite se i zatražite novi.",
      );
    } else {
      router.push("/login?confirmed=1");
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

        <div className="bg-[var(--card)] rounded-2xl p-6 space-y-4 border border-[var(--border)] text-center">
          <h2 className="text-lg font-semibold">Potvrda naloga</h2>

          {!tokenHash ? (
            <>
              <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm rounded-lg p-3">
                Link nije važeći. Prijavite se i zatražite novi.
              </div>
              <button
                onClick={() => router.push("/login")}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
              >
                Nazad na prijavu
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">
                Klikni da potvrdiš svoj nalog i počneš sa vežbanjem.
              </p>

              {error && (
                <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm rounded-lg p-3 text-left">
                  {error}
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={loading}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors disabled:opacity-50"
              >
                {loading ? "Potvrđujem..." : "Potvrdi nalog"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
