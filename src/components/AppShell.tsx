"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

interface Profile {
  display_name: string;
  is_admin: boolean;
}

const NAV_ITEMS = [
  { href: "/dnevni-izazov", icon: "📅", label: "Izazov dana" },
  { href: "/leaderboard", icon: "🏆", label: "Rang lista" },
  { href: "/stats", icon: "📊", label: "Statistika" },
  { href: "/suggest", icon: "❓", label: "Predloži pitanje" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("display_name, is_admin")
          .eq("id", session.user.id)
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
            onClick={() => router.push("/lobby")}
            className="flex items-center gap-2 font-bold text-lg"
          >
            <Image
              src="/kzz-logo.png"
              alt="KZZ"
              width={24}
              height={24}
              className="object-contain"
              priority
            />{" "}
            <span className="hidden sm:inline">KZZ</span>
          </button>

          {/* Desktop/tablet: inline icon row */}
          <div className="hidden sm:flex items-center gap-3">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="text-xs bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
              >
                {item.icon}
              </button>
            ))}
            {profile?.is_admin && (
              <button
                onClick={() => router.push("/admin")}
                className="text-xs bg-[var(--accent)]/20 text-[var(--accent)] px-3 py-1.5 rounded-lg font-medium hover:bg-[var(--accent)]/30 transition-colors"
              >
                Admin
              </button>
            )}
            <span className="text-sm text-[var(--muted)]">
              {profile?.display_name}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Odjavi se
            </button>
          </div>

          {/* Mobile: collapsible hamburger menu */}
          <div className="sm:hidden relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="text-sm bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
              aria-label="Meni"
            >
              ☰
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-50">
                  {profile?.display_name && (
                    <div className="px-4 py-3 text-sm font-medium border-b border-[var(--border)]">
                      {profile.display_name}
                    </div>
                  )}
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => {
                        setMenuOpen(false);
                        router.push(item.href);
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--card-hover)] transition-colors flex items-center gap-2"
                    >
                      <span>{item.icon}</span> {item.label}
                    </button>
                  ))}
                  {profile?.is_admin && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/admin");
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-[var(--accent)] font-medium hover:bg-[var(--card-hover)] transition-colors"
                    >
                      Admin
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-[var(--muted)] hover:bg-[var(--card-hover)] hover:text-[var(--foreground)] transition-colors border-t border-[var(--border)]"
                  >
                    Odjavi se
                  </button>
              </div>
            )}
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
