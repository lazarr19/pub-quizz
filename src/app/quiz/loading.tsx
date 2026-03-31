import AppShell from "@/components/AppShell";

export default function QuizLoading() {
  return (
    <AppShell>
      <div className="space-y-4">
        {/* Session counter row skeleton */}
        <div className="flex items-center justify-between">
          <div className="skeleton h-3.5 w-20" />
          <div className="skeleton h-3.5 w-24" />
        </div>
        {/* Question card skeleton */}
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 space-y-4">
          <div className="skeleton h-3 w-24" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-4 w-2/3" />
          </div>
          <div className="space-y-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
