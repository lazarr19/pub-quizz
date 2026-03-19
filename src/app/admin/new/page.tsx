"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

interface Category {
  id: string;
  name: string;
}

interface QuestionForm {
  content: string;
  category_id: string;
  type: "text" | "image";
  option_1: string;
  option_2: string;
  option_3: string;
  correct_option: string;
}

export default function NewQuestionPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<QuestionForm>({
    defaultValues: {
      type: "text",
      correct_option: "1",
    },
  });

  const questionType = watch("type");

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setCategories(data);
      });
  }, [supabase]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: QuestionForm) => {
    setSubmitting(true);
    setSuccess(false);

    let imageUrl: string | null = null;

    // Upload image if type is image
    if (data.type === "image" && imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `q_${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("question-images")
        .upload(fileName, imageFile);

      if (uploadError) {
        alert("Image upload failed: " + uploadError.message);
        setSubmitting(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("question-images").getPublicUrl(fileName);
      imageUrl = publicUrl;
    }

    const { error } = await supabase.from("questions").insert({
      content: data.content,
      category_id: data.category_id,
      type: data.type,
      image_url: imageUrl,
      option_1: data.option_1,
      option_2: data.option_2,
      option_3: data.option_3,
      correct_option: parseInt(data.correct_option),
    });

    if (error) {
      alert("Failed to create question: " + error.message);
    } else {
      setSuccess(true);
      reset();
      setImageFile(null);
      setImagePreview(null);
      setTimeout(() => setSuccess(false), 3000);
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              ← Nazad
            </button>
            <h1 className="font-bold text-lg">Novo pitanje</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        {success && (
          <div className="mb-4 bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] text-sm rounded-xl p-3 text-center">
            Pitanje je uspešno napravljeno!
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Type Toggle */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
            <label className="block text-sm text-[var(--muted)] mb-2">
              Tip pitanja
            </label>
            <div className="flex gap-2">
              {(["text", "image"] as const).map((t) => (
                <label
                  key={t}
                  className={`flex-1 text-center cursor-pointer rounded-lg py-2.5 text-sm font-medium transition-colors ${
                    questionType === t
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <input
                    type="radio"
                    value={t}
                    {...register("type")}
                    className="sr-only"
                  />
                  {t === "text" ? "📝 Tekst" : "🖼 Slika"}
                </label>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
            <label className="block text-sm text-[var(--muted)] mb-2">
              Kategorija
            </label>
            <select
              {...register("category_id", {
                required: "Kategorija je obavezna",
              })}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">Izaberite kategoriju...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category_id && (
              <p className="text-[var(--error)] text-xs mt-1">
                {errors.category_id.message}
              </p>
            )}
          </div>

          {/* Question Content */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
            <label className="block text-sm text-[var(--muted)] mb-2">
              Tekst pitanja
            </label>
            <textarea
              {...register("content", {
                required: "Tekst pitanja je obavezan",
              })}
              rows={3}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
              placeholder="Unesite pitanje..."
            />
            {errors.content && (
              <p className="text-[var(--error)] text-xs mt-1">
                {errors.content.message}
              </p>
            )}
          </div>

          {/* Image Upload */}
          {questionType === "image" && (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
              <label className="block text-sm text-[var(--muted)] mb-2">
                Slika pitanja
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[var(--accent)] file:text-white hover:file:bg-[var(--accent-hover)] file:cursor-pointer"
              />
              {imagePreview && (
                <div className="mt-3 relative aspect-video rounded-xl overflow-hidden bg-[var(--background)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Pregled"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Answer Options */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 space-y-3">
            <label className="block text-sm text-[var(--muted)]">
              Opcije odgovora
            </label>

            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center gap-2">
                <label
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer transition-colors ${
                    watch("correct_option") === String(num)
                      ? "bg-[var(--success)] text-white"
                      : "bg-[var(--background)] text-[var(--muted)]"
                  }`}
                >
                  <input
                    type="radio"
                    value={String(num)}
                    {...register("correct_option")}
                    className="sr-only"
                  />
                  {["A", "B", "C"][num - 1]}
                </label>
                <input
                  type="text"
                  {...register(
                    `option_${num}` as "option_1" | "option_2" | "option_3",
                    { required: `Opcija ${num} je obavezna` },
                  )}
                  className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
                  placeholder={`Opcija ${["A", "B", "C"][num - 1]}...`}
                />
              </div>
            ))}

            <p className="text-[10px] text-[var(--muted)]">
              Kliknite na slovo da označite tačan odgovor (zeleno = tačno)
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3.5 text-sm transition-colors disabled:opacity-50"
          >
            {submitting ? "Kreiranje..." : "Napravi pitanje"}
          </button>
        </form>
      </main>
    </div>
  );
}
