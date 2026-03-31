import AppShell from "@/components/AppShell";

export default function LobbyLoading() {
  return (
    <AppShell>
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
    </AppShell>
  );
}
