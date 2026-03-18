"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Profile {
  display_name: string;
  is_admin: boolean;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, is_admin")
          .eq("id", user.id)
          .single();
        if (data) setProfile(data);
      }
    };
    getUser();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 font-bold text-lg"
          >
            🧠 <span className="hidden sm:inline">PQT</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/leaderboard")}
              className="text-xs bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
            >
              🏆
            </button>
            <button
              onClick={() => router.push("/stats")}
              className="text-xs bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
            >
              📊
            </button>
            <button
              onClick={() => router.push("/suggest")}
              className="text-xs bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
            >
              ❓
            </button>
            {profile?.is_admin && (
              <button
                onClick={() => router.push("/admin")}
                className="text-xs bg-[var(--accent)]/20 text-[var(--accent)] px-3 py-1.5 rounded-lg font-medium hover:bg-[var(--accent)]/30 transition-colors"
              >
                Admin
              </button>
            )}
            <span className="text-sm text-[var(--muted)] hidden sm:inline">
              {profile?.display_name}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
