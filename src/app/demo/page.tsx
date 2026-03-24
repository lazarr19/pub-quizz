"use client";

import { useState } from "react";
import Link from "next/link";
import QuestionCard from "@/components/QuestionCard";

const DEMO_QUESTIONS = [
  {
    id: "demo-1",
    category_id: "demo",
    type: "text" as const,
    content: "Koji je glavni grad Australije?",
    image_url: null,
    option_1: "Sidnej",
    option_2: "Kanbera",
    option_3: "Melburn",
    correct_option: 2,
  },
  {
    id: "demo-2",
    category_id: "demo",
    type: "text" as const,
    content: "Ko je napisao roman 'Na Drini ćuprija'?",
    image_url: null,
    option_1: "Meša Selimović",
    option_2: "Ivo Andrić",
    option_3: "Danilo Kiš",
    correct_option: 2,
  },
  {
    id: "demo-3",
    category_id: "demo",
    type: "text" as const,
    content: "Koja je najveća planeta u Sunčevom sistemu?",
    image_url: null,
    option_1: "Saturn",
    option_2: "Neptun",
    option_3: "Jupiter",
    correct_option: 3,
  },
  {
    id: "demo-4",
    category_id: "demo",
    type: "text" as const,
    content: "Koje godine je počeo Prvi svetski rat?",
    image_url: null,
    option_1: "1914",
    option_2: "1918",
    option_3: "1912",
    correct_option: 1,
  },
  {
    id: "demo-5",
    category_id: "demo",
    type: "text" as const,
    content: "Koji hemijski element ima simbol 'Fe'?",
    image_url: null,
    option_1: "Fluor",
    option_2: "Gvožđe",
    option_3: "Fosfor",
    correct_option: 2,
  },
  {
    id: "demo-6",
    category_id: "demo",
    type: "text" as const,
    content: "Na kojoj reci leži Prijepolje?",
    image_url: null,
    option_1: "Lim",
    option_2: "Južna Morava",
    option_3: "Tara",
    correct_option: 1,
  },
  {
    id: "demo-7",
    category_id: "demo",
    type: "text" as const,
    content: "Ko je bio prvi čovek na Mesecu?",
    image_url: null,
    option_1: "Baz Oldrin",
    option_2: "Nil Armstrong",
    option_3: "Jurij Gagarin",
    correct_option: 2,
  },
  {
    id: "demo-8",
    category_id: "demo",
    type: "text" as const,
    content: "Koliko kostiju ima odrastao čovek?",
    image_url: null,
    option_1: "206",
    option_2: "186",
    option_3: "256",
    correct_option: 1,
  },
  {
    id: "demo-9",
    category_id: "demo",
    type: "text" as const,
    content: "Koja je najveća dubina izmerena u Marijanskom rovu (približno)?",
    image_url: null,
    option_1: "10.994 metara",
    option_2: "12.562 metara",
    option_3: "14.848 metara",
    correct_option: 1,
  },
  {
    id: "demo-10",
    category_id: "demo",
    type: "text" as const,
    content: "Ko je naslikao Mona Lizu?",
    image_url: null,
    option_1: "Mikelanđelo",
    option_2: "Leonardo da Vinči",
    option_3: "Rafael",
    correct_option: 2,
  },
  {
    id: "demo-11",
    category_id: "demo",
    type: "text" as const,
    content: "Koja je najveća pustinja na svetu?",
    image_url: null,
    option_1: "Sahara",
    option_2: "Gobi",
    option_3: "Antarktik",
    correct_option: 3,
  },
  {
    id: "demo-12",
    category_id: "demo",
    type: "text" as const,
    content: "Koji srpski naučnik je poznat po radu na naizmeničnoj struji?",
    image_url: null,
    option_1: "Mihajlo Pupin",
    option_2: "Nikola Tesla",
    option_3: "Milutin Milanković",
    correct_option: 2,
  },
  {
    id: "demo-13",
    category_id: "demo",
    type: "text" as const,
    content: "Koja planina u Srbiji nosi nadimak 'Srpski Olimp'?",
    image_url: null,
    option_1: "Kopaonik",
    option_2: "Suva planina",
    option_3: "Rtanj",
    correct_option: 3,
  },
  {
    id: "demo-14",
    category_id: "demo",
    type: "text" as const,
    content: "Koji je najduži tok reke u Evropi?",
    image_url: null,
    option_1: "Dunav",
    option_2: "Volga",
    option_3: "Rajna",
    correct_option: 2,
  },
  {
    id: "demo-15",
    category_id: "demo",
    type: "text" as const,
    content:
      "Ko je bio prvi guverner Narodne banke Srbije, osnovane 1884. godine?",
    image_url: null,
    option_1: "Aleksa Spasić",
    option_2: "Đorđe Vajfert",
    option_3: "Čedomilj Mijatović",
    correct_option: 1,
  },
  {
    id: "demo-16",
    category_id: "demo",
    type: "text" as const,
    content: "Koji je hemijski simbol za zlato?",
    image_url: null,
    option_1: "Ag",
    option_2: "Au",
    option_3: "Zn",
    correct_option: 2,
  },
  {
    id: "demo-17",
    category_id: "demo",
    type: "text" as const,
    content: "Koje godine je Srbija dobila nezavisnost od Osmanskog carstva?",
    image_url: null,
    option_1: "1878",
    option_2: "1804",
    option_3: "1918",
    correct_option: 1,
  },
  {
    id: "demo-18",
    category_id: "demo",
    type: "text" as const,
    content: "Koja je najmanja država na svetu po površini?",
    image_url: null,
    option_1: "Monako",
    option_2: "Vatikan",
    option_3: "San Marino",
    correct_option: 2,
  },
  {
    id: "demo-19",
    category_id: "demo",
    type: "text" as const,
    content: "Koji gas čini najveći deo Zemljine atmosfere?",
    image_url: null,
    option_1: "Kiseonik",
    option_2: "Ugljen-dioksid",
    option_3: "Azot",
    correct_option: 3,
  },
  {
    id: "demo-20",
    category_id: "demo",
    type: "text" as const,
    content:
      "Koja država ima najveći broj aktivnih vulkana na svojoj teritoriji?",
    image_url: null,
    option_1: "Japan",
    option_2: "SAD",
    option_3: "Indonezija",
    correct_option: 3,
  },
];

export default function DemoPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = DEMO_QUESTIONS[currentIndex];
  const totalQuestions = DEMO_QUESTIONS.length;

  const handleAnswer = (option: number) => {
    if (answered) return;
    const correct = option === question.correct_option;
    setSelectedOption(option);
    setIsCorrect(correct);
    setAnswered(true);
    if (correct) setCorrectCount((c) => c + 1);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= totalQuestions) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setAnswered(false);
      setSelectedOption(null);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setAnswered(false);
    setSelectedOption(null);
    setCorrectCount(0);
    setFinished(false);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--card)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <img
              src="/kzz-logo.png"
              alt="KZZ"
              className="w-6 h-6 object-contain"
            />{" "}
            <span>KZZ</span>
          </Link>
          <span className="text-xs bg-[var(--accent)]/10 text-[var(--accent)] px-3 py-1 rounded-full font-semibold border border-[var(--accent)]/20">
            DEMO
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        {finished ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">Demo završen!</h2>
            <p className="text-[var(--muted)] mb-2">
              Odgovorili ste na svih {totalQuestions} pitanja.
            </p>
            <p className="text-sm text-[var(--muted)] mb-6">
              Rezultat: {correctCount}/{totalQuestions} tačno (
              {Math.round((correctCount / totalQuestions) * 100)}%)
            </p>
            <div className="space-y-3 w-full max-w-xs">
              <Link
                href="/login"
                className="block w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors text-center"
              >
                Napravi nalog za punu verziju →
              </Link>
              <button
                onClick={handleRestart}
                className="w-full bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
              >
                Ponovi demo
              </button>
              <Link
                href="/"
                className="block w-full text-center text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                ← Nazad na početnu
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress */}
            <div className="flex items-center justify-between text-sm text-[var(--muted)]">
              <span>
                Pitanje {currentIndex + 1}/{totalQuestions}
              </span>
              <div className="flex items-center gap-3">
                {currentIndex > 0 && (
                  <span>
                    {correctCount}/{currentIndex + (answered ? 1 : 0)} tačno
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-[var(--card)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                style={{
                  width: `${((currentIndex + (answered ? 1 : 0)) / totalQuestions) * 100}%`,
                }}
              />
            </div>

            <QuestionCard
              question={question}
              selectedOption={selectedOption}
              answered={answered}
              onAnswer={handleAnswer}
            />

            {answered && (
              <div className="space-y-3">
                <div
                  className={`text-center py-3 rounded-xl font-semibold text-sm ${
                    isCorrect
                      ? "bg-[var(--success)]/10 text-[var(--success)]"
                      : "bg-[var(--error)]/10 text-[var(--error)]"
                  }`}
                >
                  {isCorrect ? "✓ Tačno!" : "✗ Netačno"}
                  {!isCorrect && (
                    <span className="block text-xs mt-1 opacity-70">
                      Tačan odgovor:{" "}
                      {question.correct_option === 1
                        ? question.option_1
                        : question.correct_option === 2
                          ? question.option_2
                          : question.option_3}
                    </span>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
                >
                  {currentIndex + 1 >= totalQuestions
                    ? "Pogledaj rezultat"
                    : "Sledeće pitanje →"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
