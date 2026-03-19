"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";

interface Category {
  id: string;
  name: string;
}

interface Suggestion {
  id: string;
  category_id: string;
  content: string;
  correct_answer: string;
  status: string;
  created_at: string;
  categories?: { name: string };
}

export default function SuggestPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mySuggestions, setMySuggestions] = useState<Suggestion[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [content, setContent] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const [catRes, sugRes] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("suggested_questions")
        .select("*, categories(name)")
        .order("created_at", { ascending: false }),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (sugRes.data) setMySuggestions(sugRes.data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !content.trim() || !correctAnswer.trim()) return;

    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("suggested_questions").insert({
      user_id: user.id,
      category_id: categoryId,
      content: content.trim(),
      correct_answer: correctAnswer.trim(),
    });

    if (error) {
      alert("Failed to submit: " + error.message);
    } else {
      setSuccess(true);
      setCategoryId("");
      setContent("");
      setCorrectAnswer("");
      loadData();
      setTimeout(() => setSuccess(false), 3000);
    }
    setSubmitting(false);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "text-[var(--success)] bg-[var(--success)]/10";
      case "rejected":
        return "text-[var(--error)] bg-[var(--error)]/10";
      default:
        return "text-[var(--muted)] bg-[var(--muted)]/10";
    }
  };

  return (
    <AppShell>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Predložite pitanje</h2>

          {success && (
            <div className="bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] text-sm rounded-xl p-3 text-center">
              Predlog je poslat! Admin će ga pregledati.
            </div>
          )}

          {/* Suggestion Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 space-y-4"
          >
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">
                Kategorija
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="">Izaberite kategoriju...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">
                Pitanje
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={3}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                placeholder="Napišite pitanje ovde..."
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">
                Tačan odgovor
              </label>
              <input
                type="text"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                required
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                placeholder="Tačan odgovor"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? "Slanje..." : "Pošalji predlog"}
            </button>
          </form>

          {/* My Suggestions */}
          {mySuggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--muted)]">
                Vaši predlozi
              </h3>
              {mySuggestions.map((s) => (
                <div
                  key={s.id}
                  className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs text-[var(--muted)]">
                      {s.categories?.name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColor(s.status)}`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{s.content}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Odgovor: {s.correct_answer}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
