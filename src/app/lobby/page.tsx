"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";

interface CategoryStat {
  category_id: string;
  category_name: string;
  total_questions: number;
  answered: number;
  correct: number;
}

export default function LobbyPage() {
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"new" | "mistakes">("new");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const user = session.user;

    const { data, error } = await supabase.rpc("get_player_stats", {
      p_user_id: user.id,
    });

    if (!error && data) {
      setStats(data);
    }
    setLoading(false);
  };

  const toggleCategory = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (mode === "mistakes") {
      const mistakeCategories = stats.filter((s) => s.answered - s.correct > 0);
      if (selected.size === mistakeCategories.length) {
        setSelected(new Set());
      } else {
        setSelected(new Set(mistakeCategories.map((s) => s.category_id)));
      }
    } else {
      if (selected.size === stats.length) {
        setSelected(new Set());
      } else {
        setSelected(new Set(stats.map((s) => s.category_id)));
      }
    }
  };

  const handleModeChange = (newMode: "new" | "mistakes") => {
    setMode(newMode);
    setSelected(new Set());
  };

  const startTraining = () => {
    const ids = Array.from(selected).join(",");
    router.push(
      `/quiz?categories=${ids}${mode === "mistakes" ? "&mode=mistakes" : ""}`,
    );
  };

  const totalAnswered = stats.reduce((a, s) => a + s.answered, 0);
  const totalCorrect = stats.reduce((a, s) => a + s.correct, 0);
  const totalQuestions = stats.reduce((a, s) => a + s.total_questions, 0);
  const overallAccuracy =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const totalMistakes = stats.reduce((a, s) => a + (s.answered - s.correct), 0);
  const selectedMistakeCount = stats
    .filter((s) => selected.has(s.category_id))
    .reduce((a, s) => a + (s.answered - s.correct), 0);

  return (
    <AppShell>
      {loading ? (
        <div className="space-y-6">
          {/* Stats card skeleton */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="skeleton h-3 w-24 mb-4" />
            <div className="grid grid-cols-3 gap-4 text-center">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="skeleton h-7 w-12" />
                  <div className="skeleton h-2.5 w-16" />
                </div>
              ))}
            </div>
          </div>

          {/* Mode toggle skeleton */}
          <div className="flex bg-[var(--card)] rounded-xl border border-[var(--border)] p-1 gap-1">
            <div className="skeleton flex-1 h-9 rounded-lg" />
            <div className="skeleton flex-1 h-9 rounded-lg" />
          </div>

          {/* Category list skeleton */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="skeleton h-5 w-28" />
              <div className="skeleton h-3 w-16" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="skeleton w-5 h-5 rounded-md" />
                      <div className="skeleton h-3.5 w-28" />
                    </div>
                    <div className="skeleton h-3 w-10" />
                  </div>
                  <div className="skeleton h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Start button skeleton */}
          <div className="skeleton h-14 w-full rounded-xl sticky bottom-4" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Stats Card */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <h2 className="text-sm font-medium text-[var(--muted)] mb-3">
              Vaš napredak
            </h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{totalAnswered}</div>
                <div className="text-xs text-[var(--muted)]">Odgovoreno</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--success)]">
                  {overallAccuracy}%
                </div>
                <div className="text-xs text-[var(--muted)]">Tačnost</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{totalQuestions}</div>
                <div className="text-xs text-[var(--muted)]">Ukupno</div>
              </div>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-[var(--card)] rounded-xl border border-[var(--border)] p-1">
            <button
              onClick={() => handleModeChange("new")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                mode === "new"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Nova pitanja
            </button>
            <button
              onClick={() => handleModeChange("mistakes")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                mode === "mistakes"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Greške{totalMistakes > 0 && ` (${totalMistakes})`}
            </button>
          </div>

          {/* Category Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Kategorije</h2>
              <button
                onClick={selectAll}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {mode === "mistakes"
                  ? selected.size ===
                    stats.filter((s) => s.answered - s.correct > 0).length
                    ? "Poništi sve"
                    : "Izaberi sve"
                  : selected.size === stats.length
                    ? "Poništi sve"
                    : "Izaberi sve"}
              </button>
            </div>

            <div className="space-y-2">
              {stats.map((stat) => {
                const isSelected = selected.has(stat.category_id);
                const mistakes = stat.answered - stat.correct;
                const isDisabledByMode = mode === "mistakes" && mistakes === 0;
                const progress =
                  stat.total_questions > 0
                    ? (stat.answered / stat.total_questions) * 100
                    : 0;
                const accuracy =
                  stat.answered > 0
                    ? Math.round((stat.correct / stat.answered) * 100)
                    : 0;
                const isComplete =
                  mode === "new"
                    ? stat.total_questions > 0 &&
                      stat.answered === stat.total_questions
                    : mistakes === 0;

                return (
                  <button
                    key={stat.category_id}
                    onClick={() =>
                      !isDisabledByMode && toggleCategory(stat.category_id)
                    }
                    disabled={isDisabledByMode}
                    className={`w-full text-left bg-[var(--card)] rounded-xl p-4 border transition-all ${
                      isDisabledByMode
                        ? "border-[var(--border)] opacity-40 cursor-not-allowed"
                        : isSelected
                          ? "border-[var(--accent)] bg-[var(--accent)]/5"
                          : "border-[var(--border)] hover:border-[var(--border)]/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-[var(--accent)] border-[var(--accent)]"
                              : "border-[var(--border)]"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <span className="font-medium text-sm">
                          {stat.category_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {mode === "new" ? (
                          <>
                            {isComplete && (
                              <span className="text-[10px] bg-[var(--success)]/20 text-[var(--success)] px-2 py-0.5 rounded-full font-medium">
                                GOTOVO
                              </span>
                            )}
                            <span className="text-xs text-[var(--muted)]">
                              {stat.answered}/{stat.total_questions}
                            </span>
                          </>
                        ) : (
                          <>
                            {mistakes === 0 ? (
                              <span className="text-[10px] bg-[var(--success)]/20 text-[var(--success)] px-2 py-0.5 rounded-full font-medium">
                                SVE TAČNO
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--error)]">
                                {mistakes} greš{mistakes === 1 ? "ka" : "ke"}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress bar - only in new mode */}
                    {mode === "new" && (
                      <div className="h-1.5 bg-[var(--background)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                            backgroundColor:
                              accuracy >= 70
                                ? "var(--success)"
                                : accuracy >= 40
                                  ? "var(--accent)"
                                  : "var(--error)",
                          }}
                        />
                      </div>
                    )}

                    {mode === "new" && stat.answered > 0 && (
                      <div className="text-[11px] text-[var(--muted)] mt-1.5">
                        {accuracy}% tačnost
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={startTraining}
            disabled={selected.size === 0}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-4 text-sm transition-colors sticky bottom-4"
          >
            {mode === "mistakes" ? "Započni vežbu" : "Započni trening"}
            {selected.size > 0 && (
              <span className="ml-1 opacity-70">
                {mode === "mistakes"
                  ? `(${selectedMistakeCount} greš${selectedMistakeCount === 1 ? "ka" : "ke"})`
                  : `(${selected.size} ${selected.size === 1 ? "kategorija" : "kategorije"})`}
              </span>
            )}
          </button>
        </div>
      )}
    </AppShell>
  );
}
