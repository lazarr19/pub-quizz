import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { categoryGenitive } from "@/lib/categories";

export const revalidate = 3600;

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
}

interface SampleQuestion {
  id: string;
  content: string;
  option_1: string;
  option_2: string;
  option_3: string;
}

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function getCategory(slug: string): Promise<Category | null> {
  const supabase = getClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, emoji")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

async function getAllCategories(): Promise<Category[]> {
  const supabase = getClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description, emoji")
    .order("name");
  return data ?? [];
}

async function getQuestionCount(categoryId: string): Promise<number> {
  const supabase = getClient();
  const { data } = await supabase.rpc("get_public_category_counts");
  const row = (
    data as { category_id: string; question_count: number }[] | null
  )?.find((r) => r.category_id === categoryId);
  return row?.question_count ?? 0;
}

async function getSampleQuestions(
  categoryId: string,
): Promise<SampleQuestion[]> {
  const supabase = getClient();
  const { data } = await supabase.rpc("get_public_sample_questions", {
    p_category_id: categoryId,
    p_limit: 20,
  });
  return (data as SampleQuestion[] | null) ?? [];
}

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const category = await getCategory(params.slug);
  if (!category) return {};

  const genitive = categoryGenitive(category.slug, category.name);
  const title = `Kviz pitanja iz ${genitive}`;
  const description = `Vežbaj kviz pitanja iz ${genitive} na Ko Zna Zna. ${
    category.description ?? ""
  } Besplatno, bez ograničenja, uz praćenje napretka.`.trim();

  return {
    title,
    description,
    alternates: {
      canonical: `/kategorije/${category.slug}`,
    },
    openGraph: {
      title: `${title} - Ko Zna Zna`,
      description,
      type: "website",
      locale: "sr_RS",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const category = await getCategory(params.slug);
  if (!category) notFound();

  const [questionCount, sampleQuestions, allCategories] = await Promise.all([
    getQuestionCount(category.id),
    getSampleQuestions(category.id),
    getAllCategories(),
  ]);

  const genitive = categoryGenitive(category.slug, category.name);
  const otherCategories = allCategories.filter((c) => c.id !== category.id);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://koznazna.rs";
  const pageUrl = `${siteUrl}/kategorije/${category.slug}`;

  // Breadcrumb + CollectionPage only. Deliberately NOT Question/Quiz markup:
  // these pages withhold the correct answer by design, and Question schema
  // without an acceptedAnswer is invalid structured data.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Početna", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Kategorije",
        item: `${siteUrl}/kategorije`,
      },
      { "@type": "ListItem", position: 3, name: category.name, item: pageUrl },
    ],
  };

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Kviz pitanja iz ${genitive}`,
    description:
      category.description ??
      `Kviz pitanja iz ${genitive} za vežbanje opšteg znanja.`,
    url: pageUrl,
    inLanguage: "sr",
    isPartOf: {
      "@type": "WebSite",
      name: "Ko Zna Zna",
      url: siteUrl,
    },
    ...(questionCount > 0
      ? {
          mainEntity: {
            "@type": "ItemList",
            name: `Kviz pitanja iz ${genitive}`,
            numberOfItems: questionCount,
          },
        }
      : {}),
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--background)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link
            href="/kategorije"
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm"
          >
            ← Kategorije
          </Link>
          <h1 className="font-bold text-lg truncate">
            {category.emoji && <span className="mr-1">{category.emoji}</span>}
            {category.name}
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="mb-8 space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-balance">
            Kviz pitanja iz {genitive}
          </h2>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            {category.description
              ? category.description
              : `Vežbaj kviz pitanja iz ${genitive} na Ko Zna Zna.`}{" "}
            {questionCount > 0 && (
              <>
                Trenutno je dostupno{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {questionCount}
                </span>{" "}
                pitanja u ovoj kategoriji.
              </>
            )}
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
            >
              Vežbaj ovu kategoriju →
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center border border-[var(--border)] text-sm font-medium rounded-xl px-5 py-2.5 hover:border-[var(--accent)]/50 transition-colors"
            >
              Probaj demo
            </Link>
          </div>
        </div>

        {sampleQuestions.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">
              Primeri pitanja
            </h3>
            {sampleQuestions.map((q, i) => (
              <div
                key={q.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-3"
              >
                <p className="font-medium text-[var(--foreground)] leading-relaxed">
                  <span className="text-[var(--muted)] mr-1">{i + 1}.</span>
                  {q.content}
                </p>
                <ul className="space-y-1.5">
                  {[q.option_1, q.option_2, q.option_3].map((opt, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-2"
                    >
                      {opt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-center space-y-3">
              <p className="text-sm font-semibold">
                Želiš da vidiš tačne odgovore?
              </p>
              <p className="text-xs text-[var(--muted)]">
                Prijavi se besplatno i odmah saznaj koliko dobro poznaješ{" "}
                {genitive}.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
                >
                  Prijavi se
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center border border-[var(--border)] text-sm font-medium rounded-xl px-5 py-2.5 hover:border-[var(--accent)]/50 transition-colors"
                >
                  Isprobaj demo
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-10 text-center">
            <p className="text-[var(--muted)] text-sm">
              Pitanja iz ove kategorije uskoro stižu.
            </p>
          </div>
        )}

        {otherCategories.length > 0 && (
          <div className="mt-10">
            <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
              Ostale kategorije
            </h3>
            <div className="flex flex-wrap gap-2">
              {otherCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`/kategorije/${c.slug}`}
                  className="inline-flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-full px-3.5 py-1.5 text-xs font-medium hover:border-[var(--accent)]/50 transition-colors"
                >
                  {c.emoji && <span>{c.emoji}</span>}
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
