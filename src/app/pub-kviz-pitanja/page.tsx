import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { categoryGenitive } from "@/lib/categories";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pub kviz pitanja i odgovori - spreman set za kviz veče",
  description:
    "Besplatna pub kviz pitanja po rundama: opšte znanje, istorija, geografija, sport, muzika i film. Gotov set za kviz veče u kafiću ili za vežbanje kod kuće.",
  keywords: [
    "pub kviz pitanja",
    "pab kviz pitanja",
    "pitanja za pub kviz",
    "pub kviz pitanja i odgovori",
    "kviz veče",
    "pub kviz Srbija",
    "pitanja za kviz",
  ],
  alternates: {
    canonical: "/pub-kviz-pitanja",
  },
  openGraph: {
    title: "Pub kviz pitanja i odgovori - Ko Zna Zna",
    description:
      "Gotov set pub kviz pitanja po rundama, besplatno. Opšte znanje, istorija, geografija, sport, muzika i film.",
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
  slug: string;
  emoji: string | null;
}

interface SampleQuestion {
  id: string;
  content: string;
  option_1: string;
  option_2: string;
  option_3: string;
}

interface Round {
  category: Category;
  questions: SampleQuestion[];
}

// Categories that actually come up on a pub quiz night, in running order.
// Anything missing from the DB is simply skipped.
const ROUND_SLUGS = [
  "opste-znanje",
  "istorija",
  "geografija",
  "sport",
  "muzika",
  "film",
  "pop-kultura",
];

const QUESTIONS_PER_ROUND = 6;
// /kategorije/[slug] already renders the first 20 questions of each category.
// Starting past that window keeps this page's content genuinely distinct
// instead of duplicating the category pages.
const CATEGORY_PAGE_SAMPLE_SIZE = 20;

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function getRounds(): Promise<Round[]> {
  const supabase = getClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, emoji");

  const bySlug = new Map(
    ((categories as Category[]) ?? []).map((c) => [c.slug, c]),
  );

  const rounds = await Promise.all(
    ROUND_SLUGS.map(async (slug) => {
      const category = bySlug.get(slug);
      if (!category) return null;

      const { data } = await supabase.rpc("get_public_sample_questions", {
        p_category_id: category.id,
        p_limit: 50,
      });
      const all = (data as SampleQuestion[] | null) ?? [];

      // Prefer questions the category page doesn't already show; fall back to
      // the tail of whatever exists for thinly-populated categories.
      const fresh = all.slice(CATEGORY_PAGE_SAMPLE_SIZE);
      const questions = (
        fresh.length >= QUESTIONS_PER_ROUND
          ? fresh
          : all.slice(-QUESTIONS_PER_ROUND)
      ).slice(0, QUESTIONS_PER_ROUND);

      if (questions.length === 0) return null;
      return { category, questions };
    }),
  );

  return rounds.filter((r): r is Round => r !== null);
}

const faqs = [
  {
    q: "Koliko pitanja treba za jedan pub kviz?",
    a: "Standardno kviz veče ima 5 do 7 rundi sa po 6 do 10 pitanja, dakle između 40 i 70 pitanja ukupno. Set na ovoj strani pokriva jedno celo veče.",
  },
  {
    q: "Da li su pub kviz pitanja besplatna?",
    a: "Jesu. Sva pitanja na Ko Zna Zna su besplatna i možeš ih koristiti za kviz veče u kafiću, na proslavi ili za vežbanje kod kuće.",
  },
  {
    q: "Kako se piše - pub kviz ili pab kviz?",
    a: "Oba oblika se koriste u govoru. Pub kviz je uobičajeniji u pisanoj formi, dok se pab kviz javlja kao fonetski zapis engleske reči pub.",
  },
  {
    q: "Gde mogu da vidim tačne odgovore?",
    a: "Prijavi se besplatno na Ko Zna Zna i dobijaš tačne odgovore, objašnjenja i praćenje napretka kroz sve kategorije.",
  },
  {
    q: "Mogu li da napravim svoj set pitanja po kategorijama?",
    a: "Da. Svaka kategorija ima svoju stranicu sa primerima pitanja, a nakon prijave možeš da vežbaš bilo koju kombinaciju kategorija.",
  },
];

export default async function PubKvizPitanjaPage() {
  const rounds = await getRounds();
  const totalQuestions = rounds.reduce((n, r) => n + r.questions.length, 0);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://koznazna.rs";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Početna", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Pub kviz pitanja",
        item: `${siteUrl}/pub-kviz-pitanja`,
      },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--background)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm"
          >
            ← Početna
          </Link>
          <h1 className="font-bold text-lg truncate">🍺 Pub kviz pitanja</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="mb-10 space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-balance">
            Pub kviz pitanja i odgovori za kviz veče
          </h2>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            Spreman set pub kviz pitanja, podeljen po rundama kao na pravom
            kviz veču. Pitanja su birana tako da pokriju širok spektar tema -
            od opšteg znanja i istorije do sporta, muzike i filma - pa set
            odgovara i ekipi početnika i iskusnim kvizašima.
          </p>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            Koristi ga kako god ti odgovara: kao gotov scenario za kviz veče u
            kafiću, kao zagrevanje pred takmičenje, ili jednostavno da proveriš
            koliko znaš. Sva pitanja su besplatna i bez registracije.
            {totalQuestions > 0 && (
              <>
                {" "}
                Ovaj set ima{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {totalQuestions} pitanja
                </span>{" "}
                u {rounds.length} rundi.
              </>
            )}
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
            >
              Vidi tačne odgovore →
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center border border-[var(--border)] text-sm font-medium rounded-xl px-5 py-2.5 hover:border-[var(--accent)]/50 transition-colors"
            >
              Probaj demo
            </Link>
          </div>
        </div>

        <section className="mb-10 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-3">
          <h3 className="font-semibold">Kako se igra pub kviz</h3>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Ekipe imaju između dva i šest članova. Voditelj čita pitanja rundu
            po rundu, ekipe zapisuju odgovore na papir, a bodovanje se radi na
            kraju svake runde - najčešće tako što ekipe razmene papire i
            međusobno pregledaju odgovore. Jedan bod po tačnom odgovoru, bez
            telefona.
          </p>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Dobro kviz veče drži ravnotežu između lakih i teških pitanja. Ako su
            sva pitanja teška, ekipe odustanu; ako su sva laka, nema pobednika.
            Set ispod je složen upravo tako - svaka runda počinje lakšim
            pitanjima i postepeno se otežava.
          </p>
        </section>

        {rounds.length > 0 ? (
          <div className="space-y-8">
            {rounds.map((round, roundIndex) => (
              <section key={round.category.id} className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="font-bold text-lg">
                    {round.category.emoji && (
                      <span className="mr-1.5">{round.category.emoji}</span>
                    )}
                    {roundIndex + 1}. runda - {round.category.name}
                  </h3>
                  <Link
                    href={`/kategorije/${round.category.slug}`}
                    className="text-xs text-[var(--accent-text)] hover:underline"
                  >
                    Još pitanja iz{" "}
                    {categoryGenitive(round.category.slug, round.category.name)}{" "}
                    →
                  </Link>
                </div>

                <ol className="space-y-4">
                  {round.questions.map((q, i) => (
                    <li
                      key={q.id}
                      className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-3"
                    >
                      <p className="font-medium text-sm leading-relaxed">
                        <span className="text-[var(--muted)] mr-1.5">
                          {i + 1}.
                        </span>
                        {q.content}
                      </p>
                      <ul className="grid gap-2 text-sm text-[var(--muted)]">
                        {[q.option_1, q.option_2, q.option_3].map((opt, oi) => (
                          <li
                            key={oi}
                            className="border border-[var(--border)] rounded-xl px-3.5 py-2"
                          >
                            {opt}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-10 text-center">
            <p className="text-[var(--muted)] text-sm">
              Pitanja trenutno nisu dostupna.
            </p>
          </div>
        )}

        <section className="mt-12 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-center space-y-3">
          <p className="font-semibold">Želiš tačne odgovore?</p>
          <p className="text-sm text-[var(--muted)]">
            Prijavi se besplatno i dobij tačne odgovore na sva pitanja, plus
            praćenje napretka po kategorijama.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
            >
              Prijavi se
            </Link>
            <Link
              href="/kategorije"
              className="inline-flex items-center justify-center border border-[var(--border)] text-sm font-medium rounded-xl px-5 py-2.5 hover:border-[var(--accent)]/50 transition-colors"
            >
              Sve kategorije
            </Link>
          </div>
        </section>

        <section className="mt-12 space-y-4">
          <h3 className="font-bold text-lg">Česta pitanja</h3>
          <div className="space-y-3">
            {faqs.map((f) => (
              <div
                key={f.q}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-2"
              >
                <p className="font-medium text-sm">{f.q}</p>
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
