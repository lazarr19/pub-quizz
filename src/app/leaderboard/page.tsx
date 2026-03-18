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

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
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

    const { data: result } = await supabase.rpc("get_leaderboard", {
      p_user_id: user.id,
    });

    if (result) setData(result);
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
            <h2 className="text-xl font-bold">Leaderboard</h2>
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
        </div>
      )}
    </AppShell>
  );
}
