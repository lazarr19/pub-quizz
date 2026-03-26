"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const REPORT_REASONS = [
  { value: "factual_error", label: "Činjenična greška" },
  { value: "multiple_correct", label: "Više tačnih odgovora" },
  { value: "wrong_options", label: "Očigledno netačni ponuđeni odgovori" },
  { value: "ambiguous", label: "Dvosmislenost u formulaciji" },
  { value: "outdated", label: "Zastarele informacije" },
  { value: "grammar", label: "Gramatičke greške" },
] as const;

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
}

interface QuestionCardProps {
  question: Question;
  selectedOption: number | null;
  answered: boolean;
  onAnswer: (option: number) => void;
}

export default function QuestionCard({
  question,
  selectedOption,
  answered,
  onAnswer,
}: QuestionCardProps) {
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportComment, setReportComment] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const options = [
    { num: 1, text: question.option_1, label: "A" },
    { num: 2, text: question.option_2, label: "B" },
    { num: 3, text: question.option_3, label: "C" },
  ];

  const handleReport = async () => {
    if (!reportReason) return;
    setReportSubmitting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("question_reports").insert({
      user_id: user.id,
      question_id: question.id,
      reason: reportReason,
      comment: reportComment.trim() || null,
    });

    if (error) {
      alert("Greška pri slanju prijave: " + error.message);
    } else {
      setReportSent(true);
      setTimeout(() => {
        setShowReport(false);
        setReportSent(false);
        setReportReason("");
        setReportComment("");
      }, 2000);
    }
    setReportSubmitting(false);
  };

  const getOptionStyle = (optNum: number) => {
    if (!answered) {
      return "bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)] active:bg-[var(--accent)]/10";
    }

    if (optNum === question.correct_option) {
      return "bg-[var(--success)]/10 border-[var(--success)]";
    }

    if (optNum === selectedOption && optNum !== question.correct_option) {
      return "bg-[var(--error)]/10 border-[var(--error)]";
    }

    return "bg-[var(--card)] border-[var(--border)] opacity-50";
  };

  return (
    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
      {/* Question content */}
      <div className="p-5">
        {question.type === "image" && question.image_url && (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-4 bg-[var(--background)]">
            <Image
              src={question.image_url}
              alt="Slika pitanja"
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        )}

        <p className="text-base font-medium leading-relaxed">
          {question.content}
        </p>
      </div>

      {/* Answer options */}
      <div className="px-5 pb-5 space-y-2">
        {options.map((opt) => (
          <button
            key={opt.num}
            onClick={() => onAnswer(opt.num)}
            disabled={answered}
            className={`w-full text-left rounded-xl border p-4 transition-all flex items-center gap-3 ${getOptionStyle(
              opt.num,
            )}`}
          >
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                answered && opt.num === question.correct_option
                  ? "bg-[var(--success)] text-white"
                  : answered &&
                      opt.num === selectedOption &&
                      opt.num !== question.correct_option
                    ? "bg-[var(--error)] text-white"
                    : "bg-[var(--background)] text-[var(--muted)]"
              }`}
            >
              {opt.label}
            </span>
            <span className="text-sm">{opt.text}</span>
          </button>
        ))}

        {answered && (
          <div className="flex items-center justify-between mt-2">
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(question.content.replace(/["""„"''‚‛«»‹›]/g, ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
            >
              🔍 Saznaj više
            </a>
            <button
              onClick={() => setShowReport(true)}
              className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--error)] transition-colors"
            >
              ⚠️ Prijavi problem
            </button>
          </div>
        )}

        {/* Report Modal */}
        {showReport && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
            onClick={() => setShowReport(false)}
          >
            <div
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {reportSent ? (
                <div className="text-center py-4">
                  <p className="text-[var(--success)] font-medium">
                    ✓ Prijava poslata!
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Hvala na prijavi.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">Prijavite problem</h3>
                    <button
                      onClick={() => setShowReport(false)}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-2">
                    {REPORT_REASONS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setReportReason(r.value)}
                        className={`w-full text-left text-sm rounded-xl border p-3 transition-all ${
                          reportReason === r.value
                            ? "border-[var(--accent)] bg-[var(--accent)]/10"
                            : "border-[var(--border)] hover:border-[var(--accent)]/50"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--muted)] mb-1">
                      Komentar (opciono)
                    </label>
                    <textarea
                      value={reportComment}
                      onChange={(e) => setReportComment(e.target.value)}
                      rows={2}
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                      placeholder="Dodatno objašnjenje..."
                    />
                  </div>

                  <button
                    onClick={handleReport}
                    disabled={!reportReason || reportSubmitting}
                    className="w-full bg-[var(--error)] hover:opacity-90 text-white font-semibold rounded-xl px-4 py-3 text-sm transition-opacity disabled:opacity-50"
                  >
                    {reportSubmitting ? "Slanje..." : "Pošalji prijavu"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
