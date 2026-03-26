"use client";

import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/lobby")}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              ← Nazad
            </button>
            <h1 className="font-bold text-lg">Admin panel</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <div className="grid gap-3">
          <button
            onClick={() => router.push("/admin/suggestions")}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-left hover:bg-[var(--card-hover)] transition-colors"
          >
            <span className="font-medium">Predložena pitanja</span>
            <p className="text-xs text-[var(--muted)] mt-1">
              Pregledajte i prihvatite predloge igrača
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/reports")}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-left hover:bg-[var(--card-hover)] transition-colors"
          >
            <span className="font-medium">Prijavljeni problemi</span>
            <p className="text-xs text-[var(--muted)] mt-1">
              Pregledajte prijave problema sa pitanjima
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/new")}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-left hover:bg-[var(--card-hover)] transition-colors"
          >
            <span className="font-medium">Dodaj pitanje</span>
            <p className="text-xs text-[var(--muted)] mt-1">
              Napravite novo kviz pitanje
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/categories")}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-left hover:bg-[var(--card-hover)] transition-colors"
          >
            <span className="font-medium">Kategorije</span>
            <p className="text-xs text-[var(--muted)] mt-1">
              Upravljajte kategorijama pitanja
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/emails")}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-left hover:bg-[var(--card-hover)] transition-colors"
          >
            <span className="font-medium">Dozvoljeni emailovi</span>
            <p className="text-xs text-[var(--muted)] mt-1">
              Upravljajte listom emailova za registraciju
            </p>
          </button>
        </div>
      </main>
    </div>
  );
}
