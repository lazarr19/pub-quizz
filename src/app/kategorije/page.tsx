import type { Metadata } from "next";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Kategorije kviz pitanja - Ko Zna Zna",
  description:
    "Pregledajte sve kategorije kviz pitanja na Ko Zna Zna: istorija, geografija, nauka, pop kultura, sport i još mnogo toga. Izaberite kategoriju i počnite da vežbate!",
  keywords: [
    "kviz kategorije",
    "istorija pitanja",
    "geografija kviz",
    "nauka pitanja",
    "pop kultura kviz",
    "sport pitanja",
    "opšte znanje kategorije",
  ],
  alternates: {
    canonical: "/kategorije",
  },
  openGraph: {
    title: "Kategorije kviz pitanja - Ko Zna Zna",
    description:
      "Sve kategorije kviz pitanja na jednom mestu. Vežbajte istoriju, geografiju, nauku, muziku i još mnogo toga.",
    type: "website",
    locale: "sr_RS",
  },
  robots: {
    index: true,
    follow: true,
  },
};

interface Category {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
}

export default async function KategorijeePage() {
  const supabase = createServerSupabaseClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, description, emoji")
    .order("name");

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm"
          >
            ← Početna
          </Link>
          <h1 className="font-bold text-lg">Kategorije</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Sve kategorije</h2>
            <p className="text-[var(--muted)] text-sm mt-1">
              Pitanja iz svih oblasti opšteg znanja
            </p>
          </div>
          <Link
            href="/lobby"
            className="shrink-0 inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
          >
            Počni vežbanje
          </Link>
        </div>

        {categories && categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(categories as Category[]).map((cat) => (
              <div
                key={cat.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-2 hover:border-[var(--accent)]/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {cat.emoji && (
                    <span className="text-2xl">{cat.emoji}</span>
                  )}
                  <h3 className="font-semibold text-[var(--foreground)]">
                    {cat.name}
                  </h3>
                </div>
                {cat.description && (
                  <p className="text-sm text-[var(--muted)] leading-relaxed">
                    {cat.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-10 text-center">
            <p className="text-[var(--muted)] text-sm">
              Nema dostupnih kategorija.
            </p>
          </div>
        )}

        <div className="mt-10 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm font-semibold">Niste sigurni odakle da počnete?</p>
          <p className="text-xs text-[var(--muted)]">
            Isprobajte demo bez registracije ili se prijavite da pratite napredak.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center border border-[var(--border)] text-sm font-medium rounded-xl px-5 py-2.5 hover:border-[var(--accent)]/50 transition-colors"
            >
              Isprobaj demo
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
            >
              Prijavi se
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
