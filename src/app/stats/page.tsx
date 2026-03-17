"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";

interface CategoryStat {
  category_id: string;
  category_name: string;
  total_questions: number;
  answered: number;
  correct: number;
}

export default function StatsPage() {
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.rpc("get_player_stats", {
      p_user_id: user.id,
    });

    if (data) setStats(data);
    setLoading(false);
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
          <h2 className="text-xl font-bold">Your Statistics</h2>

          {/* Overall */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-[var(--success)]">
                  {overallAccuracy}%
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Overall Accuracy
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold">
                  {totalAnswered}
                  <span className="text-lg text-[var(--muted)]">
                    /{totalQuestions}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Total Progress
                </div>
              </div>
            </div>

            {/* Overall progress bar */}
            <div className="mt-4 h-2 bg-[var(--background)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                style={{
                  width: `${
                    totalQuestions > 0
                      ? (totalAnswered / totalQuestions) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--muted)]">
              Category Breakdown
            </h3>

            {stats.map((stat) => {
              const accuracy =
                stat.answered > 0
                  ? Math.round((stat.correct / stat.answered) * 100)
                  : 0;
              const progress =
                stat.total_questions > 0
                  ? (stat.answered / stat.total_questions) * 100
                  : 0;

              return (
                <div
                  key={stat.category_id}
                  className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">
                      {stat.category_name}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-[var(--muted)]">
                        {stat.answered}/{stat.total_questions}
                      </span>
                      {stat.answered > 0 && (
                        <span
                          className={`font-semibold ${
                            accuracy >= 70
                              ? "text-[var(--success)]"
                              : accuracy >= 40
                                ? "text-yellow-400"
                                : "text-[var(--error)]"
                          }`}
                        >
                          {accuracy}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dual bar - progress and accuracy */}
                  <div className="space-y-1">
                    <div className="h-1.5 bg-[var(--background)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progress}%`,
                          backgroundColor:
                            accuracy >= 70
                              ? "var(--success)"
                              : accuracy >= 40
                                ? "#eab308"
                                : "var(--error)",
                        }}
                      />
                    </div>
                  </div>

                  {stat.answered > 0 && (
                    <div className="flex gap-4 mt-2 text-[11px] text-[var(--muted)]">
                      <span>✓ {stat.correct} correct</span>
                      <span>✗ {stat.answered - stat.correct} incorrect</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
