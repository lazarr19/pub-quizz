"use client";

import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

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
    if (selected.size === stats.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(stats.map((s) => s.category_id)));
    }
  };

  const startTraining = () => {
    const ids = Array.from(selected).join(",");
    router.push(`/quiz?categories=${ids}`);
  };

  const totalAnswered = stats.reduce((a, s) => a + s.answered, 0);
  const totalCorrect = stats.reduce((a, s) => a + s.correct, 0);
  const totalQuestions = stats.reduce((a, s) => a + s.total_questions, 0);
  const overallAccuracy =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  return (
    <AppShell>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Stats Card */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <h2 className="text-sm font-medium text-[var(--muted)] mb-3">
              Your Progress
            </h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{totalAnswered}</div>
                <div className="text-xs text-[var(--muted)]">Answered</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--success)]">
                  {overallAccuracy}%
                </div>
                <div className="text-xs text-[var(--muted)]">Accuracy</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{totalQuestions}</div>
                <div className="text-xs text-[var(--muted)]">Total Qs</div>
              </div>
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Categories</h2>
              <button
                onClick={selectAll}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {selected.size === stats.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="space-y-2">
              {stats.map((stat) => {
                const isSelected = selected.has(stat.category_id);
                const progress =
                  stat.total_questions > 0
                    ? (stat.answered / stat.total_questions) * 100
                    : 0;
                const accuracy =
                  stat.answered > 0
                    ? Math.round((stat.correct / stat.answered) * 100)
                    : 0;
                const isComplete =
                  stat.total_questions > 0 &&
                  stat.answered === stat.total_questions;

                return (
                  <button
                    key={stat.category_id}
                    onClick={() => toggleCategory(stat.category_id)}
                    className={`w-full text-left bg-[var(--card)] rounded-xl p-4 border transition-all ${
                      isSelected
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
                        {isComplete && (
                          <span className="text-[10px] bg-[var(--success)]/20 text-[var(--success)] px-2 py-0.5 rounded-full font-medium">
                            DONE
                          </span>
                        )}
                        <span className="text-xs text-[var(--muted)]">
                          {stat.answered}/{stat.total_questions}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
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

                    {stat.answered > 0 && (
                      <div className="text-[11px] text-[var(--muted)] mt-1.5">
                        {accuracy}% accuracy
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
            Start Training
            {selected.size > 0 && (
              <span className="ml-1 opacity-70">
                ({selected.size} {selected.size === 1 ? "category" : "categories"})
              </span>
            )}
          </button>
        </div>
      )}
    </AppShell>
  );
}
