"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
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

function QuizContent() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [answered, setAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [allComplete, setAllComplete] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const categoryIds = searchParams.get("categories")?.split(",") || [];
  const isPractice = searchParams.get("mode") === "mistakes";

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setAnswered(false);
    setSelectedOption(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const rpcName = isPractice
      ? "get_next_mistake_question"
      : "get_next_question";
    const { data, error } = await supabase.rpc(rpcName, {
      p_user_id: user.id,
      p_category_ids: categoryIds,
    });

    if (!error && data && data.length > 0) {
      setQuestion(data[0]);
      setAllComplete(false);
    } else {
      setQuestion(null);
      setAllComplete(true);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (categoryIds.length > 0) {
      fetchQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = async (option: number) => {
    if (answered || !question) return;

    const correct = option === question.correct_option;
    setSelectedOption(option);
    setIsCorrect(correct);
    setAnswered(true);
    setQuestionCount((c) => c + 1);
    if (correct) setCorrectCount((c) => c + 1);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (isPractice) {
      if (correct) {
        await supabase.rpc("update_practice_response", {
          p_user_id: user.id,
          p_question_id: question.id,
          p_is_correct: true,
        });
      }
    } else {
      await supabase.from("user_responses").insert({
        user_id: user.id,
        question_id: question.id,
        is_correct: correct,
      });
    }
  };

  const handleNext = () => {
    fetchQuestion();
  };

  const handleReset = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    await supabase.rpc("reset_category_responses", {
      p_user_id: user.id,
      p_category_ids: categoryIds,
    });
    setQuestionCount(0);
    setCorrectCount(0);
    fetchQuestion();
  };

  if (categoryIds.length === 0) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <p className="text-[var(--muted)]">No categories selected.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 text-[var(--accent)] hover:underline"
          >
            Go back to lobby
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      ) : allComplete ? (
        /* All Complete Screen */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-6xl mb-4">{isPractice ? "💪" : "🎉"}</div>
          <h2 className="text-2xl font-bold mb-2">
            {isPractice ? "All Caught Up!" : "Category Complete!"}
          </h2>
          <p className="text-[var(--muted)] mb-2">
            {isPractice
              ? "You\u2019ve corrected all your mistakes in the selected categories."
              : "You\u2019ve answered all questions in the selected categories."}
          </p>
          {questionCount > 0 && (
            <p className="text-sm text-[var(--muted)] mb-6">
              This session: {correctCount}/{questionCount} correct (
              {Math.round((correctCount / questionCount) * 100)}%)
            </p>
          )}
          <div className="space-y-3 w-full max-w-xs">
            {!isPractice && (
              <button
                onClick={handleReset}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
              >
                Reset & Redo All
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className={`w-full font-semibold rounded-xl px-4 py-3 text-sm transition-colors ${
                isPractice
                  ? "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
                  : "bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-white"
              }`}
            >
              Back to Lobby
            </button>
          </div>
        </div>
      ) : question ? (
        <div className="space-y-4">
          {/* Session counter */}
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>Question #{questionCount + (answered ? 0 : 1)}</span>
            {questionCount > 0 && (
              <span>
                {correctCount}/{questionCount} correct
              </span>
            )}
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
                {isCorrect ? "✓ Correct!" : "✗ Incorrect"}
                {!isCorrect && (
                  <span className="block text-xs mt-1 opacity-70">
                    Correct answer:{" "}
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
                Next Question →
              </button>
            </div>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}

export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        </AppShell>
      }
    >
      <QuizContent />
    </Suspense>
  );
}
