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

  const getRankSuffix = (rank: number) => {
    if (rank % 100 >= 11 && rank % 100 <= 13) return "th";
    switch (rank % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

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
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold">🏆 Leaderboard</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Most correct answers in the last 7 days
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
                              (you)
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
                No activity in the last 7 days.
              </p>
              <p className="text-[var(--muted)] text-xs mt-1">
                Start answering questions to claim the top spot!
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
                      (you)
                    </span>
                  </span>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[var(--accent)]">
                  {data.current_user.correct_count}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-2 pl-11">
                You&apos;re {data.current_user.rank}
                {getRankSuffix(data.current_user.rank)} — keep going to break
                into the top {Math.min(10, data.leaderboard.length)}!
              </p>
            </div>
          )}

          {/* Show score even if user has no recent activity */}
          {data && !data.current_user && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-4 text-center">
              <p className="text-[var(--muted)] text-sm">
                You haven&apos;t answered any questions correctly this week.
              </p>
              <p className="text-[var(--muted)] text-xs mt-1">
                Play some rounds to get on the board!
              </p>
            </div>
          )}

          {/* ── Streak Leaderboard ── */}
          <div className="border-t border-[var(--border)] pt-6">
            <div>
              <h2 className="text-xl font-bold">🔥 Streak Leaderboard</h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Consecutive days with at least one correct answer
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
                              (you)
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
                            title="Hasn't played today yet"
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
                No active streaks right now.
              </p>
              <p className="text-[var(--muted)] text-xs mt-1">
                Answer a question correctly each day to start a streak!
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
                            (you)
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
                        Answer today to keep your streak alive!
                      </p>
                    )}
                  </>
                ) : streakData.current_user.answered_yesterday ? (
                  <div className="text-center">
                    <p className="text-sm text-yellow-400">
                      ⏳ Your streak expired — but answer correctly today to
                      start a new one!
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-[var(--muted)] text-sm">
                      You don&apos;t have an active streak.
                    </p>
                    <p className="text-[var(--muted)] text-xs mt-1">
                      Answer a question correctly today to start one!
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
