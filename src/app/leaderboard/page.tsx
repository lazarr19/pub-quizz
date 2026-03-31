"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  correct_count: number;
  rank: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  current_user: LeaderboardEntry | null;
}

interface StreakEntry {
  user_id: string;
  display_name: string;
  streak: number;
  answered_today: boolean;
  rank: number;
}

interface StreakCurrentUser {
  user_id: string;
  display_name: string;
  streak: number;
  answered_today: boolean;
  answered_yesterday: boolean;
  rank: number | null;
}

interface StreakData {
  leaderboard: StreakEntry[];
  current_user: StreakCurrentUser | null;
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLeaderboard = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    const [{ data: result }, { data: streakResult }] = await Promise.all([
      supabase.rpc("get_leaderboard", { p_user_id: user.id }),
      supabase.rpc("get_streak_leaderboard", { p_user_id: user.id }),
    ]);

    if (result) setData(result);
    if (streakResult) setStreakData(streakResult);
    setLoading(false);
  };

  const isCurrentUserInTop = data?.leaderboard.some(
    (e) => e.user_id === userId,
  );

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return null;
    }
  };

  return (
    <AppShell>
      {loading ? (
        <div className="space-y-6">
          {/* Accuracy leaderboard skeleton */}
          <div>
            <div className="skeleton h-6 w-36 mb-1" />
            <div className="skeleton h-3 w-56 mt-2" />
          </div>
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="divide-y divide-[var(--border)]">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="skeleton w-8 h-4" />
                    <div className="skeleton h-3.5 w-28" />
                  </div>
                  <div className="skeleton h-3.5 w-8" />
                </div>
              ))}
            </div>
          </div>

          {/* Streak leaderboard skeleton */}
          <div className="border-t border-[var(--border)] pt-6">
            <div className="skeleton h-6 w-48 mb-1" />
            <div className="skeleton h-3 w-64 mt-2" />
          </div>
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="divide-y divide-[var(--border)]">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="skeleton w-8 h-4" />
                    <div className="skeleton h-3.5 w-28" />
                  </div>
                  <div className="skeleton h-3.5 w-10" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold">🏆 Rang lista</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Najviše tačnih odgovora u poslednjih 7 dana
            </p>
          </div>

          {/* Leaderboard Table */}
          {data && data.leaderboard.length > 0 ? (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="divide-y divide-[var(--border)]">
                {data.leaderboard.map((entry) => {
                  const isMe = entry.user_id === userId;
                  const medal = getMedalEmoji(entry.rank);

                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center justify-between px-4 py-3 transition-colors ${
                        isMe
                          ? "bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 text-center text-sm font-bold ${
                            isMe
                              ? "text-[var(--accent)]"
                              : entry.rank <= 3
                                ? "text-[var(--foreground)]"
                                : "text-[var(--muted)]"
                          }`}
                        >
                          {medal ?? `#${entry.rank}`}
                        </span>
                        <span
                          className={`text-sm ${
                            isMe
                              ? "font-semibold text-[var(--accent)]"
                              : "font-medium"
                          }`}
                        >
                          {entry.display_name}
                          {isMe && (
                            <span className="text-xs text-[var(--muted)] ml-1.5">
                              (vi)
                            </span>
                          )}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          isMe ? "text-[var(--accent)]" : "text-[var(--muted)]"
                        }`}
                      >
                        {entry.correct_count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-8 text-center">
              <p className="text-[var(--muted)] text-sm">
                Nema aktivnosti u poslednjih 7 dana.
              </p>
              <p className="text-[var(--muted)] text-xs mt-1">
                Počnite da odgovarate na pitanja i zauzmite prvo mesto!
              </p>
            </div>
          )}

          {/* Current user score if outside top 10 */}
          {data?.current_user && !isCurrentUserInTop && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--accent)]/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center text-sm font-bold text-[var(--accent)]">
                    #{data.current_user.rank}
                  </span>
                  <span className="text-sm font-semibold text-[var(--accent)]">
                    {data.current_user.display_name}
                    <span className="text-xs text-[var(--muted)] ml-1.5">
                      (vi)
                    </span>
                  </span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[var(--accent)]">
                  {data.current_user.correct_count}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-2 pl-11">
                Vi ste {data.current_user.rank}. - nastavite da uđete među prvih{" "}
                {Math.min(10, data.leaderboard.length)}!
              </p>
            </div>
          )}

          {/* Show score even if user has no recent activity */}
          {data && !data.current_user && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4 text-center">
              <p className="text-[var(--muted)] text-sm">
                Niste tačno odgovorili ni na jedno pitanje ove nedelje.
              </p>
              <p className="text-[var(--muted)] text-xs mt-1">
                Odigrajte nekoliko rundi da se popnete na listu!
              </p>
            </div>
          )}

          {/* ── Streak Leaderboard ── */}
          <div className="border-t border-[var(--border)] pt-6">
            <div>
              <h2 className="text-xl font-bold">🔥 Rang lista po nizovima</h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Uzastopni dani sa bar jednim tačnim odgovorom
              </p>
            </div>
          </div>

          {streakData && streakData.leaderboard.length > 0 ? (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="divide-y divide-[var(--border)]">
                {streakData.leaderboard.map((entry) => {
                  const isMe = entry.user_id === userId;
                  const medal = getMedalEmoji(entry.rank);

                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center justify-between px-4 py-3 transition-colors ${
                        isMe
                          ? "bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 text-center text-sm font-bold ${
                            isMe
                              ? "text-[var(--accent)]"
                              : entry.rank <= 3
                                ? "text-[var(--foreground)]"
                                : "text-[var(--muted)]"
                          }`}
                        >
                          {medal ?? `#${entry.rank}`}
                        </span>
                        <span
                          className={`text-sm ${
                            isMe
                              ? "font-semibold text-[var(--accent)]"
                              : "font-medium"
                          }`}
                        >
                          {entry.display_name}
                          {isMe && (
                            <span className="text-xs text-[var(--muted)] ml-1.5">
                              (vi)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            isMe
                              ? "text-[var(--accent)]"
                              : "text-[var(--muted)]"
                          }`}
                        >
                          {entry.streak}d
                        </span>
                        {!entry.answered_today && (
                          <span
                            className="text-[10px] text-yellow-400 font-medium"
                            title="Danas još nije igrao/la"
                          >
                            ⏳
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-8 text-center">
              <p className="text-[var(--muted)] text-sm">
                Trenutno nema aktivnih nizova.
              </p>
              <p className="text-[var(--muted)] text-xs mt-1">
                Odgovarajte tačno svaki dan da započnete niz!
              </p>
            </div>
          )}

          {/* Current user streak if outside top 10 */}
          {streakData?.current_user &&
            !streakData.leaderboard.some((e) => e.user_id === userId) && (
              <div className="bg-[var(--card)] rounded-2xl border border-[var(--accent)]/30 p-4">
                {streakData.current_user.streak > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-center text-sm font-bold text-[var(--accent)]">
                          #{streakData.current_user.rank}
                        </span>
                        <span className="text-sm font-semibold text-[var(--accent)]">
                          {streakData.current_user.display_name}
                          <span className="text-xs text-[var(--muted)] ml-1.5">
                            (vi)
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold tabular-nums text-[var(--accent)]">
                          {streakData.current_user.streak}d
                        </span>
                        {!streakData.current_user.answered_today && (
                          <span className="text-[10px] text-yellow-400 font-medium">
                            ⏳
                          </span>
                        )}
                      </div>
                    </div>
                    {!streakData.current_user.answered_today && (
                      <p className="text-xs text-yellow-400 mt-2 pl-11">
                        Odgovorite danas da održite niz!
                      </p>
                    )}
                  </>
                ) : streakData.current_user.answered_yesterday ? (
                  <div className="text-center">
                    <p className="text-sm text-yellow-400">
                      ⏳ Vaš niz je istekao - ali odgovorite tačno danas da
                      započnete novi!
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-[var(--muted)] text-sm">
                      Nemate aktivan niz.
                    </p>
                    <p className="text-[var(--muted)] text-xs mt-1">
                      Odgovorite tačno danas da započnete niz!
                    </p>
                  </div>
                )}
              </div>
            )}
        </div>
      )}
    </AppShell>
  );
}
