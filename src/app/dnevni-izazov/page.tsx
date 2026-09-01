"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import QuestionCard from "@/components/QuestionCard";

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

interface Response {
  question_id: string;
  is_correct: boolean;
}

interface Stats {
  completed_count: number;
  avg_score: number;
}

interface DailyChallengeData {
  challenge_date: string;
  questions: Question[];
  responses: Response[];
  stats: Stats;
}

export default function DailyChallengePage() {
  const [data, setData] = useState<DailyChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [answered, setAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: result, error } = await supabase.rpc("get_daily_challenge", {
      p_user_id: user.id,
    });

    if (!error && result) {
      setData(result as DailyChallengeData);
    }
    setLoading(false);
  };

  const answeredIds = new Set((data?.responses ?? []).map((r) => r.question_id));
  const unanswered = (data?.questions ?? []).filter((q) => !answeredIds.has(q.id));
  const currentQuestion = unanswered[0] ?? null;
  const currentPosition = currentQuestion
    ? (data?.questions.findIndex((q) => q.id === currentQuestion.id) ?? 0) + 1
    : 0;
  const completed = data !== null && unanswered.length === 0;
  const correctCount = (data?.responses ?? []).filter((r) => r.is_correct).length;

  const handleAnswer = async (option: number) => {
    if (!data || !currentQuestion || answered) return;

    const correct = option === currentQuestion.correct_option;
    setSelectedOption(option);
    setIsCorrect(correct);
    setAnswered(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("daily_challenge_responses").insert({
      user_id: user.id,
      challenge_date: data.challenge_date,
      question_id: currentQuestion.id,
      is_correct: correct,
    });

    setData({
      ...data,
      responses: [
        ...data.responses,
        { question_id: currentQuestion.id, is_correct: correct },
      ],
    });
  };

  const handleNext = () => {
    setAnswered(false);
    setSelectedOption(null);
  };

  return (
    <AppShell>
      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="skeleton h-3.5 w-24" />
            <div className="skeleton h-3.5 w-16" />
          </div>
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 space-y-4">
            <div className="skeleton h-3 w-24" />
            <div className="space-y-2">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-4/5" />
              <div className="skeleton h-4 w-2/3" />
            </div>
            <div className="space-y-2 pt-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-12 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      ) : completed ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-6xl mb-4">
            {correctCount >= 8 ? "🏆" : correctCount >= 5 ? "🎉" : "💪"}
          </div>
          <h2 className="text-2xl font-bold mb-2">Izazov dana završen!</h2>
          <p className="text-[var(--muted)] mb-1">
            Osvojili ste {correctCount}/10 tačnih odgovora.
          </p>
          <p className="text-sm text-[var(--accent)] mb-6">
            🔥 Niz je sačuvan za danas!
          </p>

          {data && data.stats.completed_count > 0 && (
            <p className="text-xs text-[var(--muted)] mb-6">
              {data.stats.completed_count}{" "}
              {data.stats.completed_count === 1 ? "igrač je" : "igrača je"} danas
              završilo izazov, prosečan rezultat {data.stats.avg_score}/10.
            </p>
          )}

          <button
            onClick={() => router.push("/lobby")}
            className="w-full max-w-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
          >
            Nazad na početnu
          </button>
        </div>
      ) : currentQuestion ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>📅 Izazov dana - Pitanje {currentPosition}/10</span>
            {data && data.responses.length > 0 && (
              <span>{correctCount}/{data.responses.length} tačno</span>
            )}
          </div>

          <QuestionCard
            question={currentQuestion}
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
                    {currentQuestion.correct_option === 1
                      ? currentQuestion.option_1
                      : currentQuestion.correct_option === 2
                        ? currentQuestion.option_2
                        : currentQuestion.option_3}
                  </span>
                )}
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
              >
                {currentPosition === 10 ? "Vidi rezultate →" : "Sledeće pitanje →"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}
