import type { Metadata } from "next";
import Link from "next/link";
import FonTest from "@/components/toi/FonTest";

export const metadata: Metadata = {
  title: "FON - probni test 1",
  description: "Besplatan probni test opšte informisanosti za FON.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function FonProbniTest1Page() {
  return (
    <div className="min-h-dvh flex flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link
            href="/test-opste-informisanosti"
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-sm"
          >
            ← Svi testovi
          </Link>
          <h1 className="font-bold text-lg truncate">FON - probni test 1</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <FonTest />
      </main>
    </div>
  );
}
