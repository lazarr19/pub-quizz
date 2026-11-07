"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import LevelCard from "@/components/LevelCard";
import XpChart from "@/components/XpChart";
import { ProgressInfo } from "@/lib/progress";

const HISTORY_DAYS = 30;

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
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data }, { data: progressData }] = await Promise.all([
      supabase.rpc("get_player_stats", { p_user_id: user.id }),
      supabase.rpc("get_my_progress", { p_history_days: HISTORY_DAYS }),
    ]);

    if (data) setStats(data);
    if (progressData) setProgress(progressData as ProgressInfo);
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
        <div className="space-y-6">
          {/* Title skeleton */}
          <div className="skeleton h-7 w-40" />

          {/* Overall card skeleton */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="grid grid-cols-2 gap-4 text-center">
              {[0, 1].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="skeleton h-9 w-20" />
                  <div className="skeleton h-2.5 w-24" />
                </div>
              ))}
            </div>
            <div className="skeleton h-2 w-full rounded-full mt-4" />
          </div>

          {/* Category breakdown skeleton */}
          <div className="space-y-3">
            <div className="skeleton h-3.5 w-28" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="skeleton h-3.5 w-28" />
                  <div className="flex gap-3">
                    <div className="skeleton h-3 w-10" />
                    <div className="skeleton h-3 w-8" />
                  </div>
                </div>
                <div className="skeleton h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Vaša statistika</h2>

          {/* Level / XP + daily XP */}
          {progress && (
            <div className="space-y-3">
              <LevelCard info={progress} />
              <div className="bg-[var(--card)] rounded-2xl p-4 border border-[var(--border)]">
                <h3 className="text-sm font-medium text-[var(--muted)] mb-2">
                  XP po danima - poslednjih {HISTORY_DAYS} dana
                </h3>
                <XpChart history={progress.history ?? []} days={HISTORY_DAYS} />
              </div>
              <p className="text-[11px] text-[var(--muted)] px-1">
                XP dobijate za svako novo pitanje (više za teža), za trud i
                kada netačno pitanje kasnije tačno ponovite (📘 naučeno,
                +15 XP). Pitanja za ponavljanje stižu posle 1, 3, 7 i 21 dan.
              </p>
            </div>
          )}

          {/* Overall */}
          <div className="bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-[var(--success)]">
                  {overallAccuracy}%
                </div>
                <div className="text-xs text-[var(--muted)] mt-1">
                  Ukupna tačnost
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
                  Ukupan napredak
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
              Po kategorijama
            </h3>

            {[...stats]
              .filter((s) => s.answered > 0)
              .sort((a, b) => {
                const accA = a.answered > 0 ? a.correct / a.answered : 0;
                const accB = b.answered > 0 ? b.correct / b.answered : 0;
                return accA - accB;
              })
              .map((stat) => {
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
                        <span>✓ {stat.correct} tačno</span>
                        <span>✗ {stat.answered - stat.correct} netačno</span>
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
