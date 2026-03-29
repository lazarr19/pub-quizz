"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState("");
  const [editingEmoji, setEditingEmoji] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    if (data) setCategories(data);
    setLoading(false);
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setAdding(true);
    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: newName.trim(),
        description: newDescription.trim() || null,
        emoji: newEmoji.trim() || null,
      })
      .select()
      .single();

    if (!error && data) {
      setCategories((prev) =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewName("");
      setNewDescription("");
      setNewEmoji("");
    } else if (error) {
      alert("Failed: " + error.message);
    }
    setAdding(false);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingDescription(cat.description ?? "");
    setEditingEmoji(cat.emoji ?? "");
  };

  const saveCategory = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("categories")
      .update({
        description: editingDescription.trim() || null,
        emoji: editingEmoji.trim() || null,
      })
      .eq("id", id);

    if (!error) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                description: editingDescription.trim() || null,
                emoji: editingEmoji.trim() || null,
              }
            : c,
        ),
      );
      setEditingId(null);
    } else {
      alert("Failed: " + error.message);
    }
    setSaving(false);
  };

  const deleteCategory = async (id: string, name: string) => {
    if (
      !confirm(
        `Obrisati "${name}"? Ovo će obrisati i sva pitanja u ovoj kategoriji.`,
      )
    )
      return;
    await supabase.from("categories").delete().eq("id", id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push("/admin")}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ← Nazad
          </button>
          <h1 className="font-bold text-lg">Kategorije</h1>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-4">
        {/* Add category form */}
        <form onSubmit={addCategory} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              placeholder="😀"
              maxLength={2}
              className="w-16 bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-3 text-center text-lg focus:outline-none focus:border-[var(--accent)]"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Naziv nove kategorije..."
              className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-5 py-3 text-sm transition-colors disabled:opacity-50"
            >
              Dodaj
            </button>
          </div>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Opis kategorije (opciono, prikazuje se na javnoj stranici)..."
            rows={2}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
          />
        </form>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {cat.emoji && <span>{cat.emoji}</span>}
                    <span className="text-sm font-medium">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        editingId === cat.id
                          ? setEditingId(null)
                          : startEdit(cat)
                      }
                      className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-xs"
                    >
                      {editingId === cat.id ? "Otkaži" : "Uredi"}
                    </button>
                    <button
                      onClick={() => deleteCategory(cat.id, cat.name)}
                      className="text-[var(--muted)] hover:text-[var(--error)] transition-colors text-sm"
                      title="Obriši"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {editingId === cat.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingEmoji}
                        onChange={(e) => setEditingEmoji(e.target.value)}
                        placeholder="😀"
                        maxLength={2}
                        className="w-16 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-center text-lg focus:outline-none focus:border-[var(--accent)]"
                      />
                      <textarea
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        placeholder="Opis kategorije..."
                        rows={2}
                        className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={() => saveCategory(cat.id)}
                      disabled={saving}
                      className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold rounded-lg px-4 py-1.5 transition-colors disabled:opacity-50"
                    >
                      Sačuvaj
                    </button>
                  </div>
                ) : (
                  cat.description && (
                    <p className="text-xs text-[var(--muted)]">
                      {cat.description}
                    </p>
                  )
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center text-sm text-[var(--muted)] py-8">
                Nema kategorija. Dodajte jednu iznad.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
