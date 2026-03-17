"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
}

interface Question {
  id: string;
  category_id: string;
  type: "text" | "image";
  content: string;
  image_url: string | null;
  option_1: string;
  option_2: string;
  option_3: string;
  correct_option: number;
  created_at: string;
  categories?: { name: string };
}

export default function AdminPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const [questionsRes, categoriesRes] = await Promise.all([
      supabase
        .from("questions")
        .select("*, categories(name)")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
    ]);

    if (questionsRes.data) setQuestions(questionsRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    setLoading(false);
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    await supabase.from("questions").delete().eq("id", id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const filtered = questions.filter((q) => {
    if (filterCategory && q.category_id !== filterCategory) return false;
    if (filterType && q.type !== filterType) return false;
    return true;
  });

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/admin/suggestions")}
              className="text-xs bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
            >
              Suggestions
            </button>
            <button
              onClick={() => router.push("/admin/emails")}
              className="text-xs bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
            >
              Emails
            </button>
            <button
              onClick={() => router.push("/admin/categories")}
              className="text-xs bg-[var(--card)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--card-hover)] transition-colors"
            >
              Categories
            </button>
            <button
              onClick={() => router.push("/admin/new")}
              className="text-xs bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg hover:bg-[var(--accent-hover)] transition-colors font-medium"
            >
              + Add Question
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">All Types</option>
                <option value="text">Text</option>
                <option value="image">Image</option>
              </select>

              <span className="text-sm text-[var(--muted)] self-center ml-auto">
                {filtered.length} question{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Questions List */}
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-[var(--muted)]">
                  <p>No questions found.</p>
                  <button
                    onClick={() => router.push("/admin/new")}
                    className="mt-2 text-[var(--accent)] hover:underline text-sm"
                  >
                    Add your first question
                  </button>
                </div>
              ) : (
                filtered.map((q) => (
                  <div
                    key={q.id}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              q.type === "image"
                                ? "bg-purple-500/20 text-purple-400"
                                : "bg-blue-500/20 text-blue-400"
                            }`}
                          >
                            {q.type.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-[var(--muted)]">
                            {q.categories?.name}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate">
                          {q.content}
                        </p>
                        <div className="flex gap-2 mt-2 text-xs text-[var(--muted)]">
                          <span
                            className={`${
                              q.correct_option === 1
                                ? "text-[var(--success)] font-medium"
                                : ""
                            }`}
                          >
                            A: {q.option_1}
                          </span>
                          <span>·</span>
                          <span
                            className={`${
                              q.correct_option === 2
                                ? "text-[var(--success)] font-medium"
                                : ""
                            }`}
                          >
                            B: {q.option_2}
                          </span>
                          <span>·</span>
                          <span
                            className={`${
                              q.correct_option === 3
                                ? "text-[var(--success)] font-medium"
                                : ""
                            }`}
                          >
                            C: {q.option_3}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteQuestion(q.id)}
                        className="text-[var(--muted)] hover:text-[var(--error)] transition-colors text-sm shrink-0"
                        title="Delete question"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
