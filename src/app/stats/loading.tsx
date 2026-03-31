import AppShell from "@/components/AppShell";

export default function StatsLoading() {
  return (
    <AppShell>
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
    </AppShell>
  );
}
