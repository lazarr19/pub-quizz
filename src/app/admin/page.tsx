"use client";

import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              ← Back
            </button>
            <h1 className="font-bold text-lg">Admin Panel</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <div className="grid gap-3">
          <button
            onClick={() => router.push("/admin/suggestions")}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-left hover:bg-[var(--card-hover)] transition-colors"
          >
            <span className="font-medium">Suggested Questions</span>
            <p className="text-xs text-[var(--muted)] mt-1">
              Review and promote player suggestions
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/new")}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-left hover:bg-[var(--card-hover)] transition-colors"
          >
            <span className="font-medium">Add Question</span>
            <p className="text-xs text-[var(--muted)] mt-1">
              Create a new quiz question
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/categories")}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-left hover:bg-[var(--card-hover)] transition-colors"
          >
            <span className="font-medium">Categories</span>
            <p className="text-xs text-[var(--muted)] mt-1">
              Manage question categories
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/emails")}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 text-left hover:bg-[var(--card-hover)] transition-colors"
          >
            <span className="font-medium">Allowed Emails</span>
            <p className="text-xs text-[var(--muted)] mt-1">
              Manage email whitelist for registration
            </p>
          </button>
        </div>
      </main>
    </div>
  );
}
