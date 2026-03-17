"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AllowedEmail {
  id: string;
  email: string;
  created_at: string;
}

export default function AllowedEmailsPage() {
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    const { data } = await supabase
      .from("allowed_emails")
      .select("*")
      .order("email");
    if (data) setEmails(data);
    setLoading(false);
  };

  const addEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;

    setAdding(true);
    setError("");

    const { error: insertErr } = await supabase
      .from("allowed_emails")
      .insert({ email: trimmed });

    if (insertErr) {
      setError(
        insertErr.code === "23505"
          ? "This email is already in the list."
          : insertErr.message,
      );
    } else {
      setNewEmail("");
      loadEmails();
    }
    setAdding(false);
  };

  const removeEmail = async (id: string, email: string) => {
    if (!confirm(`Remove ${email} from allowed list?`)) return;
    await supabase.from("allowed_emails").delete().eq("id", id);
    setEmails((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              ← Back
            </button>
            <h1 className="font-bold text-lg">Allowed Emails</h1>
          </div>
          <span className="text-sm text-[var(--muted)]">
            {emails.length} email{emails.length !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {/* Add Email Form */}
        <form onSubmit={addEmail} className="flex gap-2 mb-6">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-5 py-3 text-sm transition-colors disabled:opacity-50 shrink-0"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </form>

        {error && (
          <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-12 text-[var(--muted)]">
            <p>No emails added yet.</p>
            <p className="text-sm mt-1">
              Add email addresses to allow registration.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {emails.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3"
              >
                <span className="text-sm">{entry.email}</span>
                <button
                  onClick={() => removeEmail(entry.id, entry.email)}
                  className="text-[var(--muted)] hover:text-[var(--error)] transition-colors text-sm shrink-0"
                  title="Remove email"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
