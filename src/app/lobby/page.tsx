"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import LevelCard from "@/components/LevelCard";
import { ProgressInfo } from "@/lib/progress";

interface CategoryStat {
  category_id: string;
  category_name: string;
  total_questions: number;
  answered: number;
  correct: number;
  // Questions due for a spaced-repetition review (absent before migration 022)
  due_reviews?: number;
}

type Mode = "new" | "review" | "mistakes";

interface DailyChallengeStatus {
  answered: number;
  correct: number;
  streak: number;
}

export default function LobbyPage() {
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [dailyStatus, setDailyStatus] = useState<DailyChallengeStatus | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("new");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
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

    const [
      { data, error },
      { data: daily },
      { data: dailyStreak },
      { data: progressData },
    ] = await Promise.all([
      supabase.rpc("get_player_stats", { p_user_id: user.id }),
      supabase.rpc("get_daily_challenge", { p_user_id: user.id }),
      supabase.rpc("get_daily_challenge_streak", { p_user_id: user.id }),
      supabase.rpc("get_my_progress", { p_history_days: 0 }),
    ]);

    if (!error && data) {
      setStats(data);
    }
    // Absent until migration 027 is applied; the card simply doesn't render.
    if (progressData) {
      setProgress(progressData as ProgressInfo);
    }
    if (daily) {
      const responses = daily.responses as { is_correct: boolean }[];
      setDailyStatus({
        answered: responses.length,
        correct: responses.filter((r) => r.is_correct).length,
        streak: dailyStreak?.streak ?? 0,
      });
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

  // Categories that have something to play in the current mode.
  const isEligible = (s: CategoryStat) =>
    mode === "mistakes"
      ? s.answered - s.correct > 0
      : mode === "review"
        ? Number(s.due_reviews ?? 0) > 0
        : true;
  const eligibleCount = stats.filter(isEligible).length;

  const selectAll = () => {
    if (selected.size === eligibleCount) {
      setSelected(new Set());
    } else {
      setSelected(new Set(stats.filter(isEligible).map((s) => s.category_id)));
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setSelected(new Set());
  };

  const startTraining = () => {
    const ids = Array.from(selected).join(",");
    router.push(
      `/quiz?categories=${ids}${mode === "new" ? "" : `&mode=${mode}`}`,
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
  const totalDue = stats.reduce((a, s) => a + Number(s.due_reviews ?? 0), 0);
  const selectedDueCount = stats
    .filter((s) => selected.has(s.category_id))
    .reduce((a, s) => a + Number(s.due_reviews ?? 0), 0);

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
          {/* Level / XP */}
          {progress && (
            <LevelCard info={progress} onClick={() => router.push("/stats")} />
          )}

          {/* Daily Challenge Card */}
          {dailyStatus && (
            <button
              onClick={() => router.push("/dnevni-izazov")}
              className="w-full text-left bg-[var(--card)] rounded-2xl p-5 border border-[var(--accent)]/30 hover:border-[var(--accent)] transition-colors flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  📅 Izazov dana
                  {dailyStatus.streak > 0 && (
                    <span className="text-xs font-medium text-orange-400">
                      🔥 {dailyStatus.streak}{" "}
                      {dailyStatus.streak === 1 ? "dan" : "dana"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {dailyStatus.answered === 10
                    ? `Završeno - ${dailyStatus.correct}/10 tačno`
                    : dailyStatus.answered > 0
                      ? `U toku - ${dailyStatus.answered}/10 odgovoreno`
                      : "10 novih pitanja, isto za sve - odigrajte danas!"}
                </p>
              </div>
              <span className="text-[var(--accent-text)] text-sm font-medium shrink-0 ml-3">
                {dailyStatus.answered === 10 ? "Pregled →" : "Igraj →"}
              </span>
            </button>
          )}

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
          <div className="flex bg-[var(--card)] rounded-xl border border-[var(--border)] p-1 gap-1">
            {(
              [
                ["new", "Nova", null],
                ["review", "Ponavljanje", totalDue],
                ["mistakes", "Greške", totalMistakes],
              ] as [Mode, string, number | null][]
            ).map(([m, label, count]) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`flex-1 py-2.5 px-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {label}
                {count !== null && count > 0 && (
                  <span className="ml-1 text-xs opacity-80 tabular-nums">
                    {count > 999 ? "999+" : count}
                  </span>
                )}
              </button>
            ))}
          </div>
          {mode === "review" && (
            <p className="text-xs text-[var(--muted)] -mt-3 px-1">
              🔁 Pitanja koja su došla na red za ponavljanje - prvo ona koja ste
              promašili. Promašeno pitanje koje sada znate: 📘 +15 XP.
            </p>
          )}

          {/* Category Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Kategorije</h2>
              <button
                onClick={selectAll}
                className="text-xs text-[var(--accent-text)] hover:underline"
              >
                {selected.size === eligibleCount && eligibleCount > 0
                  ? "Poništi sve"
                  : "Izaberi sve"}
              </button>
            </div>

            <div className="space-y-2">
              {stats.map((stat) => {
                const isSelected = selected.has(stat.category_id);
                const mistakes = stat.answered - stat.correct;
                const due = Number(stat.due_reviews ?? 0);
                const isDisabledByMode = !isEligible(stat);
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
                        {mode === "review" ? (
                          due > 0 ? (
                            <span className="text-xs text-[var(--accent-text)] tabular-nums">
                              🔁 {due}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-[var(--success)]/20 text-[var(--success)] px-2 py-0.5 rounded-full font-medium">
                              SVE PONOVLJENO
                            </span>
                          )
                        ) : mode === "new" ? (
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
                        {/* Finished categories serve due reviews only */}
                        {isComplete && Number(stat.due_reviews ?? 0) > 0 && (
                          <span className="text-[var(--accent-text)]">
                            {" "}
                            · 🔁 {stat.due_reviews} za ponavljanje
                          </span>
                        )}
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
            {mode === "mistakes"
              ? "Započni vežbu"
              : mode === "review"
                ? "Započni ponavljanje"
                : "Započni trening"}
            {selected.size > 0 && (
              <span className="ml-1 opacity-70">
                {mode === "mistakes"
                  ? `(${selectedMistakeCount} greš${selectedMistakeCount === 1 ? "ka" : "ke"})`
                  : mode === "review"
                    ? `(${selectedDueCount} pitanja)`
                    : `(${selected.size} ${selected.size === 1 ? "kategorija" : "kategorije"})`}
              </span>
            )}
          </button>
        </div>
      )}
    </AppShell>
  );
}
