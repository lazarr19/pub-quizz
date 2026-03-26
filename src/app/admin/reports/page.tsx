"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const REASON_LABELS: Record<string, string> = {
  factual_error: "Činjenična greška",
  multiple_correct: "Više tačnih odgovora",
  wrong_options: "Očigledno netačni ponuđeni odgovori",
  ambiguous: "Dvosmislenost u formulaciji",
  outdated: "Zastarele informacije",
  grammar: "Gramatičke greške",
};

interface Report {
  id: string;
  user_id: string;
  question_id: string;
  reason: string;
  comment: string | null;
  resolved: boolean;
  created_at: string;
  profiles?: { display_name: string };
  questions?: {
    content: string;
    option_1: string;
    option_2: string;
    option_3: string;
    correct_option: number;
    categories?: { name: string };
  };
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const { data } = await supabase
      .from("question_reports")
      .select(
        "*, profiles(display_name), questions(content, option_1, option_2, option_3, correct_option, categories(name))",
      )
      .order("created_at", { ascending: false });
    if (data) setReports(data);
    setLoading(false);
  };

  const toggleResolved = async (id: string, current: boolean) => {
    await supabase
      .from("question_reports")
      .update({ resolved: !current })
      .eq("id", id);
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, resolved: !current } : r)),
    );
  };

  const pending = reports.filter((r) => !r.resolved);
  const resolved = reports.filter((r) => r.resolved);

  const correctAnswer = (q: Report["questions"]) => {
    if (!q) return "";
    return q.correct_option === 1
      ? q.option_1
      : q.correct_option === 2
        ? q.option_2
        : q.option_3;
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push("/admin")}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ← Nazad
          </button>
          <h1 className="font-bold text-lg">Prijavljeni problemi</h1>
          <span className="text-sm text-[var(--muted)] ml-auto">
            {pending.length} nerešeno
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : pending.length === 0 && resolved.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted)]">
            Nema prijava.
          </div>
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[var(--muted)]">
                  Nerešene prijave
                </h3>
                {pending.map((r) => (
                  <div
                    key={r.id}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-xs text-[var(--muted)]">
                          {r.questions?.categories?.name || "—"} · od{" "}
                          {r.profiles?.display_name || "Nepoznato"}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--muted)] shrink-0">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Question info */}
                    <div className="bg-[var(--background)] rounded-lg p-3 mb-3 border border-[var(--border)]">
                      <p className="text-sm font-medium mb-1">
                        {r.questions?.content}
                      </p>
                      <div className="text-xs text-[var(--muted)] space-y-0.5">
                        <p>A: {r.questions?.option_1}</p>
                        <p>B: {r.questions?.option_2}</p>
                        <p>C: {r.questions?.option_3}</p>
                        <p className="text-[var(--success)] mt-1">
                          Tačan: {correctAnswer(r.questions)}
                        </p>
                      </div>
                    </div>

                    {/* Report details */}
                    <div className="mb-3">
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--error)]/10 text-[var(--error)]">
                        {REASON_LABELS[r.reason] || r.reason}
                      </span>
                      {r.comment && (
                        <p className="text-sm text-[var(--muted)] mt-2 italic">
                          &quot;{r.comment}&quot;
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => toggleResolved(r.id, r.resolved)}
                      className="text-xs bg-[var(--success)]/20 text-[var(--success)] px-3 py-1.5 rounded-lg font-medium hover:bg-[var(--success)]/30 transition-colors"
                    >
                      Označi kao rešeno
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Resolved */}
            {resolved.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[var(--muted)]">
                  Rešene prijave
                </h3>
                {resolved.map((r) => (
                  <div
                    key={r.id}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 opacity-60"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs text-[var(--muted)]">
                        {r.questions?.categories?.name || "—"} · od{" "}
                        {r.profiles?.display_name || "Nepoznato"}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-[var(--success)] bg-[var(--success)]/10">
                        rešeno
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {r.questions?.content}
                    </p>
                    <span className="inline-block text-xs text-[var(--muted)] mt-1">
                      {REASON_LABELS[r.reason] || r.reason}
                    </span>
                    {r.comment && (
                      <p className="text-xs text-[var(--muted)] mt-1 italic">
                        &quot;{r.comment}&quot;
                      </p>
                    )}
                    <div className="mt-2">
                      <button
                        onClick={() => toggleResolved(r.id, r.resolved)}
                        className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      >
                        Vrati na nerešeno
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
