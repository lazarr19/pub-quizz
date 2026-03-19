"use client";

import Image from "next/image";

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
  const options = [
    { num: 1, text: question.option_1, label: "A" },
    { num: 2, text: question.option_2, label: "B" },
    { num: 3, text: question.option_3, label: "C" },
  ];

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
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(question.content)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline mt-2"
          >
            🔍 Saznaj više
          </a>
        )}
      </div>
    </div>
  );
}
