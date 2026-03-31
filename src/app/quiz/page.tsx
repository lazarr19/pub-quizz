"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import QuestionCard from "@/components/QuestionCard";
import confetti from "canvas-confetti";

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
  const [fetchError, setFetchError] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showStreak10, setShowStreak10] = useState(false);
  const [showStreak30, setShowStreak30] = useState(false);
  const [bestStreak, setBestStreak] = useState(0);
  const [showSessionReport, setShowSessionReport] = useState(false);
  const queueRef = useRef<Question[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const BATCH_SIZE = 10;
  const PREFETCH_THRESHOLD = 2;
  const categoryIds = searchParams.get("categories")?.split(",") || [];
  const isPractice = searchParams.get("mode") === "mistakes";
  const seenIdsRef = useRef<Set<string>>(new Set());
  const prefetchingRef = useRef(false);
  const fetchingRef = useRef(false);

  const fetchBatch = useCallback(async (): Promise<Question[]> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return [];
    }

    const rpcName = isPractice
      ? "get_next_mistake_question"
      : "get_next_question";
    const { data, error } = await supabase.rpc(rpcName, {
      p_user_id: user.id,
      p_category_ids: categoryIds,
      p_limit: BATCH_SIZE,
      p_exclude_ids: Array.from(seenIdsRef.current),
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      const batch = data as Question[];
      batch.forEach((q) => seenIdsRef.current.add(q.id));
      return batch;
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefetchIfNeeded = useCallback(async () => {
    if (
      queueRef.current.length <= PREFETCH_THRESHOLD &&
      !prefetchingRef.current &&
      !fetchingRef.current
    ) {
      prefetchingRef.current = true;
      try {
        const batch = await fetchBatch();
        if (batch.length > 0) {
          // Dedupe against anything added while we were fetching
          const newQuestions = batch.filter(
            (q) => !queueRef.current.some((existing) => existing.id === q.id),
          );
          queueRef.current.push(...newQuestions);
        }
      } catch (error) {
        console.error("Error prefetching questions:", error);
      } finally {
        prefetchingRef.current = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBatch]);

  const showNextFromQueue = useCallback(
    async (forceRefetch = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        setAnswered(false);
        setSelectedOption(null);
        setFetchError(false);

        if (queueRef.current.length === 0 || forceRefetch) {
          setLoading(true);
          const batch = await fetchBatch();
          if (batch.length === 0) {
            setQuestion(null);
            setAllComplete(true);
            setLoading(false);
            return;
          }
          queueRef.current = forceRefetch
            ? batch
            : [...queueRef.current, ...batch];
        }

        const next = queueRef.current.shift()!;
        setQuestion(next);
        setAllComplete(false);
        setLoading(false);

        // Trigger prefetch in background if queue is getting low
        prefetchIfNeeded();
      } catch {
        setFetchError(true);
        setLoading(false);
      } finally {
        fetchingRef.current = false;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [fetchBatch, prefetchIfNeeded],
  );

  useEffect(() => {
    if (categoryIds.length > 0) {
      showNextFromQueue(true);
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
    if (questionCount + 1 === 30) {
      setShowStreak30(true);
      setTimeout(() => setShowStreak30(false), 4000);
      const end = Date.now() + 4000;
      const frame = () => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 90,
          origin: { x: 0, y: 0.5 },
          colors: ["#a855f7", "#ec4899", "#facc15", "#f97316"],
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 90,
          origin: { x: 1, y: 0.5 },
          colors: ["#a855f7", "#ec4899", "#facc15", "#f97316"],
        });
        confetti({
          particleCount: 40,
          angle: 90,
          spread: 60,
          origin: { x: 0.5, y: 0.3 },
          colors: ["#a855f7", "#ec4899", "#facc15"],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
    if (correct) {
      setCorrectCount((c) => c + 1);
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        if (next === 5) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
        }
        if (next === 10) {
          setShowStreak10(true);
          setTimeout(() => setShowStreak10(false), 3000);
          const end = Date.now() + 2000;
          const frame = () => {
            confetti({
              particleCount: 60,
              angle: 60,
              spread: 70,
              origin: { x: 0, y: 0.6 },
              colors: ["#f97316", "#facc15", "#fb923c"],
            });
            confetti({
              particleCount: 60,
              angle: 120,
              spread: 70,
              origin: { x: 1, y: 0.6 },
              colors: ["#f97316", "#facc15", "#fb923c"],
            });
            if (Date.now() < end) requestAnimationFrame(frame);
          };
          frame();
        }
        return next;
      });
    } else {
      setStreak(0);
    }

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
    showNextFromQueue();
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
    setStreak(0);
    queueRef.current = [];
    seenIdsRef.current.clear();
    showNextFromQueue(true);
  };

  const getSessionMessage = (total: number, accuracy: number) => {
    if (total === 0)
      return {
        emoji: "😴",
        text: "Niste odgovorili ni na jedno pitanje ovaj put!",
      };
    if (total < 5) {
      if (accuracy === 100)
        return { emoji: "⚡", text: "Kratak ali savršen start!" };
      return {
        emoji: "👣",
        text: "Tek ste zagrejali motore. Sledeći put duže!",
      };
    }
    if (accuracy >= 90) {
      if (total >= 30)
        return {
          emoji: "🏆",
          text: "Legendarno! Maraton sa skoro savršenom preciznošću!",
        };
      if (total >= 15)
        return {
          emoji: "🥇",
          text: "Izvanredno! Vrhunska preciznost tokom cele sesije!",
        };
      return { emoji: "🌟", text: "Odlično! Skoro savršen rezultat!" };
    }
    if (accuracy >= 75) {
      if (total >= 30)
        return {
          emoji: "💪",
          text: "Sjajan maraton! Solidna preciznost kroz celu sesiju.",
        };
      return { emoji: "😎", text: "Sjajan rezultat! Nastavite ovim tempom." };
    }
    if (accuracy >= 50) {
      if (total >= 20)
        return {
          emoji: "📈",
          text: "Duga sesija, ima prostora za rast. Vežbajte dalje!",
        };
      return {
        emoji: "🙂",
        text: "Solidan nastup. Malo više vežbanja i bićete neustavljivi!",
      };
    }
    if (total >= 20)
      return {
        emoji: "🔄",
        text: "Duga sesija - upornošću do pobede! Greške su lekcije.",
      };
    return {
      emoji: "📚",
      text: "Ima prostora za napredak. Vežbajte greške i pokušajte ponovo!",
    };
  };

  if (categoryIds.length === 0) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <p className="text-[var(--muted)]">Niste izabrali kategorije.</p>
          <button
            onClick={() => router.push("/lobby")}
            className="mt-4 text-[var(--accent)] hover:underline"
          >
            Nazad na početnu
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {showStreak10 && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-orange-500 text-white rounded-2xl px-8 py-5 text-center shadow-2xl animate-bounce">
            <div className="text-4xl mb-1">🔥🔥🔥</div>
            <div className="text-2xl font-bold tracking-wide">10 zaredom!</div>
            <div className="text-sm mt-1 opacity-90">Nestvarna serija!</div>
          </div>
        </div>
      )}
      {showSessionReport &&
        (() => {
          const total = questionCount + (answered ? 0 : 0);
          const accuracy =
            total > 0 ? Math.round((correctCount / total) * 100) : 0;
          const { emoji, text } = getSessionMessage(total, accuracy);
          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
                <div className="text-5xl mb-3">{emoji}</div>
                <h2 className="text-xl font-bold mb-1">Izveštaj sesije</h2>
                <p className="text-[var(--muted)] text-sm mb-5">{text}</p>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-[var(--bg)] rounded-xl py-3">
                    <div className="text-2xl font-bold">{total}</div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      Pitanja
                    </div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-xl py-3">
                    <div className="text-2xl font-bold">{accuracy}%</div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      Tačnost
                    </div>
                  </div>
                  <div className="bg-[var(--bg)] rounded-xl py-3">
                    <div className="text-2xl font-bold text-orange-400">
                      {bestStreak}
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-1">
                      Maks. niz
                    </div>
                  </div>
                </div>
                <div className="text-sm text-[var(--muted)] mb-5">
                  {correctCount} tačno / {total - correctCount} netačno
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push("/lobby")}
                    className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
                  >
                    Nazad na početnu
                  </button>
                  <button
                    onClick={() => setShowSessionReport(false)}
                    className="w-full bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
                  >
                    Nastavi kviz
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      {showStreak30 && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white rounded-2xl px-10 py-6 text-center shadow-2xl animate-bounce">
            <div className="text-5xl mb-2">👑🔥👑</div>
            <div className="text-3xl font-bold tracking-wide">30 pitanja!</div>
            <div className="text-sm mt-2 opacity-90">Pravi kviz maratonac!</div>
          </div>
        </div>
      )}
      {loading ? (
        <div className="space-y-4">
          {/* Session counter row skeleton */}
          <div className="flex items-center justify-between">
            <div className="skeleton h-3.5 w-20" />
            <div className="skeleton h-3.5 w-24" />
          </div>
          {/* Question card skeleton */}
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
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[var(--muted)] mb-4">
            Došlo je do greške pri učitavanju pitanja.
          </p>
          <button
            onClick={() => showNextFromQueue(true)}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
          >
            Pokušaj ponovo
          </button>
        </div>
      ) : allComplete ? (
        /* All Complete Screen */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-6xl mb-4">{isPractice ? "💪" : "🎉"}</div>
          <h2 className="text-2xl font-bold mb-2">
            {isPractice ? "Sve je rešeno!" : "Kategorija završena!"}
          </h2>
          <p className="text-[var(--muted)] mb-2">
            {isPractice
              ? "Ispravili ste sve greške u izabranim kategorijama."
              : "Odgovorili ste na sva pitanja u izabranim kategorijama."}
          </p>
          {questionCount > 0 && (
            <p className="text-sm text-[var(--muted)] mb-6">
              Ova sesija: {correctCount}/{questionCount} tačno (
              {Math.round((correctCount / questionCount) * 100)}%)
            </p>
          )}
          <div className="space-y-3 w-full max-w-xs">
            {!isPractice && (
              <button
                onClick={handleReset}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
              >
                Resetuj i ponovi sve
              </button>
            )}
            <button
              onClick={() => router.push("/lobby")}
              className={`w-full font-semibold rounded-xl px-4 py-3 text-sm transition-colors ${
                isPractice
                  ? "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
                  : "bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-white"
              }`}
            >
              Nazad na početnu
            </button>
          </div>
        </div>
      ) : question ? (
        <div className="space-y-4">
          {/* Session counter */}
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>Pitanje #{questionCount + (answered ? 0 : 1)}</span>
            <div className="flex items-center gap-3">
              {streak >= 2 && (
                <span
                  className={`font-semibold transition-all ${streak >= 10 ? "text-yellow-400 text-base scale-110 inline-block" : "text-orange-400"}`}
                >
                  🔥 {streak}
                </span>
              )}
              {questionCount > 0 && (
                <span>
                  {correctCount}/{questionCount} tačno
                </span>
              )}
              <button
                onClick={() => setShowSessionReport(true)}
                className="text-[var(--error)] hover:text-[var(--error)]/80 font-medium transition-colors"
              >
                Završi sesiju
              </button>
            </div>
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
                Sledeće pitanje →
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="skeleton h-3.5 w-20" />
              <div className="skeleton h-3.5 w-24" />
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
        </AppShell>
      }
    >
      <QuizContent />
    </Suspense>
  );
}
