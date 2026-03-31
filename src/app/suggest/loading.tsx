import AppShell from "@/components/AppShell";

export default function SuggestLoading() {
  return (
    <AppShell>
      <div className="space-y-6">
        {/* Title skeleton */}
        <div className="skeleton h-7 w-48" />

        {/* Form card skeleton */}
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 space-y-4">
          <div className="space-y-1">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-11 w-full rounded-xl" />
          </div>
          <div className="space-y-1">
            <div className="skeleton h-3 w-14" />
            <div className="skeleton h-24 w-full rounded-xl" />
          </div>
          <div className="space-y-1">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-11 w-full rounded-xl" />
          </div>
          <div className="skeleton h-11 w-full rounded-xl" />
        </div>
      </div>
    </AppShell>
  );
}
