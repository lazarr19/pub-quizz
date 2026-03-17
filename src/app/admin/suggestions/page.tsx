"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
}

interface Suggestion {
  id: string;
  user_id: string;
  category_id: string;
  content: string;
  correct_answer: string;
  status: string;
  created_at: string;
  categories?: { name: string };
  profiles?: { display_name: string };
}

export default function AdminSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Promote form state
  const [promoteData, setPromoteData] = useState<{
    id: string;
    category_id: string;
    content: string;
    option_1: string;
    option_2: string;
    option_3: string;
    correct_option: string;
  } | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const [sugRes, catRes] = await Promise.all([
      supabase
        .from("suggested_questions")
        .select("*, categories(name), profiles(display_name)")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
    ]);
    if (sugRes.data) setSuggestions(sugRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  };

  const startPromote = (s: Suggestion) => {
    setPrompting(s.id);
    setPromoteData({
      id: s.id,
      category_id: s.category_id,
      content: s.content,
      option_1: s.correct_answer,
      option_2: "",
      option_3: "",
      correct_option: "1",
    });
  };

  const setPrompting = (id: string | null) => {
    setPromoting(id);
  };

  const cancelPromote = () => {
    setPromoting(null);
    setPromoteData(null);
  };

  const confirmPromote = async () => {
    if (!promoteData) return;
    if (
      !promoteData.option_1 ||
      !promoteData.option_2 ||
      !promoteData.option_3
    ) {
      alert("Please fill all three options.");
      return;
    }

    // Insert into questions table
    const { error: insertErr } = await supabase.from("questions").insert({
      category_id: promoteData.category_id,
      type: "text",
      content: promoteData.content,
      option_1: promoteData.option_1,
      option_2: promoteData.option_2,
      option_3: promoteData.option_3,
      correct_option: parseInt(promoteData.correct_option),
    });

    if (insertErr) {
      alert("Failed to create question: " + insertErr.message);
      return;
    }

    // Mark suggestion as accepted
    await supabase
      .from("suggested_questions")
      .update({ status: "accepted" })
      .eq("id", promoteData.id);

    // Send thank-you email via API route
    const suggestion = suggestions.find((s) => s.id === promoteData.id);
    if (suggestion) {
      await fetch("/api/thank-you", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: suggestion.user_id,
          questionContent: suggestion.content,
        }),
      });
    }

    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === promoteData.id ? { ...s, status: "accepted" } : s,
      ),
    );
    cancelPromote();
  };

  const rejectSuggestion = async (id: string) => {
    if (!confirm("Reject this suggestion?")) return;
    await supabase
      .from("suggested_questions")
      .update({ status: "rejected" })
      .eq("id", id);
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "rejected" } : s)),
    );
  };

  const pending = suggestions.filter((s) => s.status === "pending");
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const reviewed = suggestions.filter(
    (s) => s.status !== "pending" && new Date(s.created_at) >= sevenDaysAgo,
  );

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push("/admin")}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ← Back
          </button>
          <h1 className="font-bold text-lg">Suggested Questions</h1>
          <span className="text-sm text-[var(--muted)] ml-auto">
            {pending.length} pending
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : pending.length === 0 && reviewed.length === 0 ? (
          <div className="text-center py-20 text-[var(--muted)]">
            No suggestions yet.
          </div>
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[var(--muted)]">
                  Pending Review
                </h3>
                {pending.map((s) => (
                  <div
                    key={s.id}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-xs text-[var(--muted)]">
                          {s.categories?.name} · by{" "}
                          {s.profiles?.display_name || "Unknown"}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--muted)] shrink-0">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">{s.content}</p>
                    <p className="text-xs text-[var(--muted)] mb-3">
                      Suggested answer: {s.correct_answer}
                    </p>

                    {promoting === s.id && promoteData ? (
                      /* Promote form */
                      <div className="bg-[var(--background)] rounded-lg p-4 space-y-3 border border-[var(--border)]">
                        <p className="text-xs text-[var(--muted)] font-medium">
                          Fill in the 3 answer options and pick the correct one:
                        </p>
                        <div>
                          <label className="block text-xs text-[var(--muted)] mb-1">
                            Category
                          </label>
                          <select
                            value={promoteData.category_id}
                            onChange={(e) =>
                              setPromoteData({
                                ...promoteData,
                                category_id: e.target.value,
                              })
                            }
                            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-[var(--muted)] mb-1">
                            Question Text
                          </label>
                          <textarea
                            value={promoteData.content}
                            onChange={(e) =>
                              setPromoteData({
                                ...promoteData,
                                content: e.target.value,
                              })
                            }
                            rows={2}
                            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                          />
                        </div>
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="correct"
                              value={n}
                              checked={promoteData.correct_option === String(n)}
                              onChange={(e) =>
                                setPromoteData({
                                  ...promoteData,
                                  correct_option: e.target.value,
                                })
                              }
                              className="accent-[var(--accent)]"
                            />
                            <input
                              type="text"
                              placeholder={`Option ${n}`}
                              value={
                                promoteData[
                                  `option_${n}` as keyof typeof promoteData
                                ]
                              }
                              onChange={(e) =>
                                setPromoteData({
                                  ...promoteData,
                                  [`option_${n}`]: e.target.value,
                                })
                              }
                              className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <button
                            onClick={confirmPromote}
                            className="flex-1 bg-[var(--success)] hover:opacity-90 text-white font-semibold rounded-lg px-3 py-2 text-sm transition-opacity"
                          >
                            Confirm & Add Question
                          </button>
                          <button
                            onClick={cancelPromote}
                            className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm hover:bg-[var(--card-hover)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startPromote(s)}
                          className="text-xs bg-[var(--success)]/20 text-[var(--success)] px-3 py-1.5 rounded-lg font-medium hover:bg-[var(--success)]/30 transition-colors"
                        >
                          Accept & Promote
                        </button>
                        <button
                          onClick={() => rejectSuggestion(s.id)}
                          className="text-xs bg-[var(--error)]/20 text-[var(--error)] px-3 py-1.5 rounded-lg font-medium hover:bg-[var(--error)]/30 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Reviewed */}
            {reviewed.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[var(--muted)]">
                  Reviewed
                </h3>
                {reviewed.map((s) => (
                  <div
                    key={s.id}
                    className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 opacity-60"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs text-[var(--muted)]">
                        {s.categories?.name} · by{" "}
                        {s.profiles?.display_name || "Unknown"}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                          s.status === "accepted"
                            ? "text-[var(--success)] bg-[var(--success)]/10"
                            : "text-[var(--error)] bg-[var(--error)]/10"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{s.content}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Answer: {s.correct_answer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
