import AppShell from "@/components/AppShell";

export default function LeaderboardLoading() {
  return (
    <AppShell>
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
    </AppShell>
  );
}
