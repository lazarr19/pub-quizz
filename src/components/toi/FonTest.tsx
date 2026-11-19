"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { track } from "@vercel/analytics";
import testData from "@/content/toi/fon-probni-test-1.json";
import NotifyForm from "@/components/toi/NotifyForm";
import { newId, recordTestAttempt } from "@/lib/toi/attempts";

type Letter = "a" | "b" | "c" | "d" | "e";
type Answer = Letter | "n";

interface TestQuestion {
  id: number;
  topic: string;
  question: string;
  options: Record<Letter, string>;
  correct: Letter;
  explanation: string;
}

interface Saved {
  startedAt: number;
  answers: Record<number, Answer>;
  flagged: number[];
  current: number;
  finishedAt: number | null;
  attemptId?: string;
  timedOut?: boolean;
  recorded?: boolean;
}

const LETTERS: Letter[] = ["a", "b", "c", "d", "e"];
const TEST = testData as unknown as { id: string; questions: TestQuestion[] };
const QUESTIONS = TEST.questions;
const TOTAL = QUESTIONS.length;
const DURATION_MS = 45 * 60 * 1000;
const STORAGE_KEY = "kzz-toi-fon-1";

const GROUPS = [
  {
    label: "Ekonomija i menadžment",
    topics: ["ekonomija", "marketing", "menadzment", "finansije"],
  },
  { label: "Informatika", topics: ["informatika"] },
  { label: "Društvo i pravo", topics: ["drustvo"] },
  { label: "Jezik", topics: ["jezik"] },
  {
    label: "Opšta kultura i nauka",
    topics: ["nauka", "istorija", "geografija", "knjizevnost", "umetnost"],
  },
];

// An area counts as "weak" below this share of correct answers.
const WEAK_BELOW = 0.7;

// Placeholder score distribution until real submissions are stored: a normal
// curve over the possible score range. Replace with real data later.
const DIST_MEAN = 14;
const DIST_SD = 5.5;
const DIST_MIN = -2;
const DIST_MAX = 30;
const DIST_BIN = 2;
const DIST_BINS = (DIST_MAX - DIST_MIN) / DIST_BIN;

function trackSafe(name: string, props?: Record<string, string | number>) {
  try {
    track(name, props);
  } catch {
    // analytics must never break the test
  }
}

function scoreOf(answers: Record<number, Answer>) {
  let correct = 0;
  let wrong = 0;
  let dontKnow = 0;
  let blank = 0;
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (!a) blank++;
    else if (a === "n") dontKnow++;
    else if (a === q.correct) correct++;
    else wrong++;
  }
  // Work in tenths of a point so -0.1 steps never accumulate float error.
  const tenths = correct * 10 - wrong - blank;
  return { correct, wrong, dontKnow, blank, tenths };
}

function formatScore(tenths: number): string {
  return (tenths / 10).toFixed(1).replace(".", ",");
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function answerLabel(q: TestQuestion, a: Answer | undefined): string {
  if (!a) return "Bez odgovora";
  if (a === "n") return "Ne znam";
  return `${a.toUpperCase()}. ${q.options[a]}`;
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26).
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function ScoreDistribution({ tenths }: { tenths: number }) {
  const score = tenths / 10;

  const masses: number[] = [];
  for (let i = 0; i < DIST_BINS; i++) {
    const lo = i === 0 ? -Infinity : DIST_MIN + i * DIST_BIN;
    const hi = i === DIST_BINS - 1 ? Infinity : DIST_MIN + (i + 1) * DIST_BIN;
    masses.push(normCdf((hi - DIST_MEAN) / DIST_SD) - normCdf((lo - DIST_MEAN) / DIST_SD));
  }
  const maxMass = Math.max(...masses);

  const LEFT = 10;
  const WIDTH = 300;
  const BASE = 100;
  const MAX_H = 70;
  const barW = WIDTH / DIST_BINS;
  const span = DIST_MAX - DIST_MIN;
  const xOf = (v: number) =>
    LEFT + Math.min(1, Math.max(0, (v - DIST_MIN) / span)) * WIDTH;

  const userBin = Math.min(
    DIST_BINS - 1,
    Math.max(0, Math.floor((score - DIST_MIN) / DIST_BIN)),
  );
  const markerX = xOf(score);
  const labelX = Math.min(285, Math.max(35, markerX));
  const percentile = Math.min(
    99,
    Math.max(1, Math.round(normCdf((score - DIST_MEAN) / DIST_SD) * 100)),
  );

  return (
    <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
      <h3 className="font-semibold">Gde si u odnosu na ostale</h3>
      <svg
        viewBox="0 0 320 125"
        role="img"
        aria-label={`Raspodela rezultata. Tvoj rezultat je ${formatScore(tenths)} od 30, što je bolje od oko ${percentile}% rešavača prema okvirnoj proceni.`}
        className="w-full h-auto"
      >
        {masses.map((m, i) => {
          const h = Math.max(2, (m / maxMass) * MAX_H);
          return (
            <rect
              key={i}
              x={LEFT + i * barW + 1}
              y={BASE - h}
              width={barW - 2}
              height={h}
              rx={2}
              fill={i === userBin ? "var(--accent)" : "var(--border)"}
            />
          );
        })}
        <line
          x1={LEFT}
          x2={LEFT + WIDTH}
          y1={BASE}
          y2={BASE}
          stroke="var(--border)"
        />
        <line
          x1={markerX}
          x2={markerX}
          y1={24}
          y2={BASE}
          stroke="var(--foreground)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        <circle cx={markerX} cy={24} r={4.5} fill="var(--foreground)" />
        <text
          x={labelX}
          y={13}
          textAnchor="middle"
          fontSize={11}
          fontWeight={700}
          fill="var(--foreground)"
        >
          Ti: {formatScore(tenths)}
        </text>
        {[0, 10, 20, 30].map((v) => (
          <text
            key={v}
            x={xOf(v)}
            y={116}
            textAnchor="middle"
            fontSize={10}
            fill="var(--muted)"
          >
            {v}
          </text>
        ))}
      </svg>
      <p className="text-sm">
        Bolji/a si od oko{" "}
        <span className="font-semibold">{percentile}%</span> rešavača.
      </p>
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        Okvirna procena. Čim se skupi dovoljno rešenih testova, zamenićemo je
        stvarnom raspodelom.
      </p>
    </section>
  );
}

function SubmitModal({
  unanswered,
  onCancel,
  onConfirm,
}: {
  unanswered: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Tab") {
        // Keep focus inside the dialog.
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        className="w-full max-w-sm bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-4 shadow-2xl"
      >
        <h2 id="submit-title" className="font-bold text-lg">
          Predaješ test?
        </h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          {unanswered > 0 ? (
            <>
              Imaš{" "}
              <span className="text-[var(--foreground)] font-semibold">
                {unanswered}
              </span>{" "}
              {unanswered === 1 ? "pitanje" : "pitanja"} bez odgovora, a svako se
              računa kao netačno (−0,1). Ako ne znaš, označi „Ne znam“.
            </>
          ) : (
            "Odgovorio/la si na sva pitanja. Posle predaje nema izmena."
          )}
        </p>
        <div className="flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="flex-1 border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-medium hover:border-[var(--accent)]/50 transition-colors"
          >
            Nastavi test
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
          >
            Predaj
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function FonTest() {
  const [phase, setPhase] = useState<"intro" | "test" | "result">("intro");
  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [flagged, setFlagged] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);
  const [now, setNow] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const attemptIdRef = useRef("");
  const topRef = useRef<HTMLDivElement>(null);

  // Store the finished attempt in the database. Safe to call repeatedly: the
  // attempt id makes the server ignore duplicates.
  const submitAttempt = useCallback(
    async (
      finalAnswers: Record<number, Answer>,
      durationMs: number,
      didTimeOut: boolean,
    ) => {
      if (!attemptIdRef.current) attemptIdRef.current = newId();
      const s = scoreOf(finalAnswers);
      const ok = await recordTestAttempt({
        attemptId: attemptIdRef.current,
        testId: TEST.id,
        correct: s.correct,
        wrong: s.wrong,
        dontKnow: s.dontKnow,
        blank: s.blank,
        durationMs,
        timedOut: didTimeOut,
        answers: Object.fromEntries(
          Object.entries(finalAnswers).map(([id, a]) => [id, a]),
        ),
      });
      if (ok) setRecorded(true);
    },
    [],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Saved;
        if (s && typeof s.startedAt === "number") {
          const savedAnswers = s.answers ?? {};
          const expired =
            !s.finishedAt && Date.now() >= s.startedAt + DURATION_MS;
          if (expired && Object.keys(savedAnswers).length === 0) {
            // An abandoned, empty attempt: do not greet the visitor with a
            // negative score for a test they never really took.
            localStorage.removeItem(STORAGE_KEY);
          } else {
            attemptIdRef.current = s.attemptId ?? newId();
            setStartedAt(s.startedAt);
            setAnswers(savedAnswers);
            setFlagged(s.flagged ?? []);
            setCurrent(Math.min(Math.max(s.current ?? 0, 0), TOTAL - 1));
            setRecorded(!!s.recorded);
            if (s.finishedAt || expired) {
              const end = s.finishedAt ?? s.startedAt + DURATION_MS;
              const didTimeOut = s.finishedAt ? !!s.timedOut : true;
              setFinishedAt(end);
              setTimedOut(didTimeOut);
              setPhase("result");
              // Finished earlier but never confirmed as stored (offline, tab
              // closed mid-request, or the timer ran out while away): retry.
              if (!s.recorded) {
                void submitAttempt(
                  savedAnswers,
                  Math.min(DURATION_MS, Math.max(0, end - s.startedAt)),
                  didTimeOut,
                );
              }
            } else {
              setPhase("test");
            }
          }
        }
      }
    } catch {
      // storage unavailable or corrupt: start fresh
    }
    setNow(Date.now());
    setHydrated(true);
  }, [submitAttempt]);

  useEffect(() => {
    if (!hydrated || phase === "intro") return;
    try {
      const saved: Saved = {
        startedAt,
        answers,
        flagged,
        current,
        finishedAt,
        attemptId: attemptIdRef.current,
        timedOut,
        recorded,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // ignore
    }
  }, [
    hydrated,
    phase,
    startedAt,
    answers,
    flagged,
    current,
    finishedAt,
    timedOut,
    recorded,
  ]);

  useEffect(() => {
    if (phase !== "test") return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const finish = useCallback(
    (
      at: number,
      finalAnswers: Record<number, Answer>,
      startedAtValue: number,
      didTimeOut: boolean,
    ) => {
      const s = scoreOf(finalAnswers);
      trackSafe("toi_fon_finish", {
        score: s.tenths / 10,
        correct: s.correct,
        wrong: s.wrong,
        dontKnow: s.dontKnow,
        blank: s.blank,
      });
      setFinishedAt(at);
      setTimedOut(didTimeOut);
      setPhase("result");
      setConfirmSubmit(false);
      void submitAttempt(
        finalAnswers,
        Math.min(DURATION_MS, Math.max(0, at - startedAtValue)),
        didTimeOut,
      );
    },
    [submitAttempt],
  );

  const remainingMs = Math.max(0, startedAt + DURATION_MS - now);

  useEffect(() => {
    if (phase === "test" && now > 0 && remainingMs === 0) {
      finish(startedAt + DURATION_MS, answers, startedAt, true);
    }
  }, [phase, now, remainingMs, startedAt, answers, finish]);

  const scrollToTop = () => {
    requestAnimationFrame(() =>
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const start = () => {
    setAnswers({});
    setFlagged([]);
    setCurrent(0);
    setFinishedAt(null);
    setTimedOut(false);
    setRecorded(false);
    attemptIdRef.current = newId();
    setConfirmSubmit(false);
    setShowGrid(true);
    setStartedAt(Date.now());
    setNow(Date.now());
    setPhase("test");
    trackSafe("toi_fon_start");
    scrollToTop();
  };

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setAnswers({});
    setFlagged([]);
    setCurrent(0);
    setFinishedAt(null);
    setTimedOut(false);
    setRecorded(false);
    attemptIdRef.current = "";
    setOnlyMissed(false);
    setPhase("intro");
    scrollToTop();
  };

  const goTo = useCallback((i: number) => {
    setCurrent(Math.min(Math.max(i, 0), TOTAL - 1));
    requestAnimationFrame(() =>
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  const select = useCallback(
    (a: Answer) => {
      const q = QUESTIONS[current];
      setAnswers((prev) => {
        if (prev[q.id] === a) {
          const next = { ...prev };
          delete next[q.id];
          return next;
        }
        return { ...prev, [q.id]: a };
      });
    },
    [current],
  );

  useEffect(() => {
    if (phase !== "test" || confirmSubmit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if ((LETTERS as string[]).includes(k)) select(k as Letter);
      else if (k === "n") select("n");
      else if (e.key === "ArrowRight") goTo(current + 1);
      else if (e.key === "ArrowLeft") goTo(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, confirmSubmit, current, select, goTo]);

  const toggleFlag = () => {
    const id = QUESTIONS[current].id;
    setFlagged((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  if (phase === "intro") {
    return (
      <div
        ref={topRef}
        id="test"
        className="scroll-mt-20 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 space-y-4"
      >
        <h2 className="text-xl font-bold">Probni test - 30 pitanja</h2>
        <ul className="text-sm text-[var(--muted)] space-y-1.5 leading-relaxed">
          <li>
            ⏱ <span className="text-[var(--foreground)]">45 minuta</span>, tajmer
            radi i ako zaključaš telefon
          </li>
          <li>
            ✅ Tačan odgovor{" "}
            <span className="text-[var(--foreground)] font-semibold">+1</span>,
            netačan{" "}
            <span className="text-[var(--foreground)] font-semibold">−0,1</span>,
            „Ne znam“{" "}
            <span className="text-[var(--foreground)] font-semibold">0</span>
          </li>
          <li>
            ⚠️ Pitanje bez odgovora se računa kao netačno (−0,1), zato uvek
            označi bar „Ne znam“
          </li>
          <li>📝 Rešenja i objašnjenja dobijaš tek na kraju</li>
        </ul>
        <button
          type="button"
          onClick={start}
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold rounded-xl px-5 py-3.5 text-sm transition-colors"
        >
          Počni test
        </button>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Pitanja su originalna i izrađena u stilu prijemnog testa. Ovo nije
          zvaničan test fakulteta.
        </p>
      </div>
    );
  }

  if (phase === "test") {
    const q = QUESTIONS[current];
    const selected = answers[q.id];
    const answeredCount = QUESTIONS.filter((x) => answers[x.id]).length;
    const unanswered = TOTAL - answeredCount;
    const isFlagged = flagged.includes(q.id);
    const lowTime = remainingMs <= 5 * 60 * 1000;

    return (
      <div ref={topRef} id="test" className="scroll-mt-20 space-y-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--muted)]">
            Pitanje{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {current + 1}
            </span>
            /{TOTAL}
          </span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              lowTime ? "text-[var(--error)]" : "text-[var(--foreground)]"
            }`}
            aria-label="Preostalo vreme"
          >
            ⏱ {formatClock(remainingMs)}
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Odgovorena pitanja"
          aria-valuemin={0}
          aria-valuemax={TOTAL}
          aria-valuenow={answeredCount}
          className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden"
        >
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{ width: `${(answeredCount / TOTAL) * 100}%` }}
          />
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
          <p className="font-medium leading-relaxed">
            <span className="text-[var(--muted)] mr-1.5">{current + 1}.</span>
            {q.question}
          </p>

          <div className="grid gap-2.5">
            {LETTERS.map((l) => {
              const on = selected === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => select(l)}
                  aria-pressed={on}
                  className={`w-full flex items-start gap-3 text-left rounded-xl border px-4 py-3.5 min-h-[52px] text-sm transition-colors ${
                    on
                      ? "border-[var(--accent)] bg-[var(--accent)]/15"
                      : "border-[var(--border)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  <span
                    className={`shrink-0 w-6 h-6 mt-px rounded-full border flex items-center justify-center text-xs font-bold ${
                      on
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    {l.toUpperCase()}
                  </span>
                  <span className="leading-relaxed">{q.options[l]}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => select("n")}
              aria-pressed={selected === "n"}
              className={`w-full text-left rounded-xl border border-dashed px-4 py-3 min-h-[48px] text-sm transition-colors ${
                selected === "n"
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 font-semibold"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/50"
              }`}
            >
              Ne znam <span className="text-xs opacity-70">(0 bodova)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className="flex-1 border border-[var(--border)] rounded-xl px-3 py-3 text-sm font-medium disabled:opacity-40 hover:border-[var(--accent)]/50 transition-colors"
          >
            ← Prethodno
          </button>
          <button
            type="button"
            onClick={toggleFlag}
            aria-pressed={isFlagged}
            className={`border rounded-xl px-3 py-3 text-sm transition-colors ${
              isFlagged
                ? "border-yellow-400/60 text-yellow-400"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/50"
            }`}
            title="Označi pitanje da mu se vratiš"
          >
            {isFlagged ? "🚩 Označeno" : "🚩"}
          </button>
          {current < TOTAL - 1 ? (
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl px-3 py-3 text-sm font-semibold transition-colors"
            >
              Sledeće →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmSubmit(true)}
              className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl px-3 py-3 text-sm font-semibold transition-colors"
            >
              Predaj test
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            aria-expanded={showGrid}
            className="underline underline-offset-2 hover:text-[var(--foreground)]"
          >
            {showGrid ? "Sakrij pregled pitanja" : "Pregled pitanja"}
          </button>
          <span>
            Odgovoreno {answeredCount}/{TOTAL}
            {flagged.length > 0 && ` · označeno ${flagged.length}`}
          </span>
        </div>

        {showGrid && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
              {QUESTIONS.map((x, i) => {
                const a = answers[x.id];
                const f = flagged.includes(x.id);
                const fill = !a
                  ? "border-[var(--border)] text-[var(--muted)]"
                  : a === "n"
                    ? "border-slate-400/60 bg-slate-500/50 text-white"
                    : "border-[var(--accent)] bg-[var(--accent)] text-white";
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={i === current ? "true" : undefined}
                    aria-label={`Pitanje ${i + 1}${
                      !a ? ", bez odgovora" : a === "n" ? ", ne znam" : ", odgovoreno"
                    }${f ? ", označeno" : ""}`}
                    className={`relative h-10 rounded-lg border text-sm font-semibold tabular-nums transition-colors ${fill} ${
                      i === current
                        ? "ring-2 ring-[var(--foreground)] ring-offset-2 ring-offset-[var(--card)]"
                        : ""
                    }`}
                  >
                    {i + 1}
                    {f && (
                      <span className="absolute -top-1.5 -right-1 text-[10px]">
                        🚩
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[var(--accent)]" />
                Odgovoreno
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-500/50 border border-slate-400/60" />
                Ne znam
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-[var(--border)]" />
                Bez odgovora
              </span>
              <span>🚩 Označeno</span>
            </div>
            <button
              type="button"
              onClick={() => setConfirmSubmit(true)}
              className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm font-medium hover:border-[var(--accent)]/50 transition-colors"
            >
              Predaj test
            </button>
          </div>
        )}

        {confirmSubmit && (
          <SubmitModal
            unanswered={unanswered}
            onCancel={() => setConfirmSubmit(false)}
            onConfirm={() => finish(Date.now(), answers, startedAt, false)}
          />
        )}

        <p className="hidden sm:block text-xs text-[var(--muted)]">
          Prečice: A–E biraju odgovor, N je „Ne znam“, strelice menjaju pitanje.
        </p>
      </div>
    );
  }

  // result
  const s = scoreOf(answers);
  const usedMs = Math.min(
    DURATION_MS,
    Math.max(0, (finishedAt ?? startedAt) - startedAt),
  );
  const groupStats = GROUPS.map((g) => {
    const qs = QUESTIONS.filter((q) => g.topics.includes(q.topic));
    const ok = qs.filter((q) => answers[q.id] === q.correct).length;
    return { label: g.label, ok, total: qs.length };
  })
    .filter((g) => g.total > 0)
    // Weakest first; on a tie the area with more questions is the safer signal.
    .sort((a, b) => a.ok / a.total - b.ok / b.total || b.total - a.total);
  const weakCount = groupStats.filter((g) => g.ok / g.total < WEAK_BELOW).length;

  const reviewList = QUESTIONS.filter(
    (q) => !onlyMissed || answers[q.id] !== q.correct,
  );

  return (
    <div ref={topRef} id="test" className="scroll-mt-20 space-y-6">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-center space-y-4">
        <p className="text-sm text-[var(--muted)]">Tvoj rezultat</p>
        <p className="text-5xl font-bold tabular-nums">
          {formatScore(s.tenths)}
          <span className="text-2xl text-[var(--muted)]"> / 30</span>
        </p>
        <p className="text-xs text-[var(--muted)]">
          {s.correct} × (+1) − {s.wrong + s.blank} × 0,1 · „Ne znam“ ={" "}
          {s.dontKnow} × 0
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
          <div className="rounded-xl border border-[var(--border)] p-3">
            <div className="font-bold text-[var(--success)] tabular-nums">
              {s.correct}
            </div>
            <div className="text-xs text-[var(--muted)]">Tačno</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3">
            <div className="font-bold text-[var(--error)] tabular-nums">
              {s.wrong}
            </div>
            <div className="text-xs text-[var(--muted)]">Netačno</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3">
            <div className="font-bold tabular-nums">{s.dontKnow}</div>
            <div className="text-xs text-[var(--muted)]">Ne znam</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3">
            <div className="font-bold tabular-nums">{s.blank}</div>
            <div className="text-xs text-[var(--muted)]">Bez odgovora</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3 col-span-2 sm:col-span-1">
            <div className="font-bold tabular-nums">{formatClock(usedMs)}</div>
            <div className="text-xs text-[var(--muted)]">Utrošeno vreme</div>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm font-medium hover:border-[var(--accent)]/50 transition-colors"
        >
          Ponovi test
        </button>
      </div>

      <ScoreDistribution tenths={s.tenths} />

      <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="font-semibold">Na čemu da poradiš</h3>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            {weakCount > 0
              ? "Oblasti poređane od najslabije. Počni od prvih."
              : "Sve oblasti su ti solidne. Nastavi da vežbaš širok spektar pitanja."}
          </p>
        </div>
        <div className="space-y-4">
          {groupStats.map((g) => {
            const weak = g.ok / g.total < WEAK_BELOW;
            return (
              <div key={g.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {g.label}
                    {weak && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-yellow-400">
                        slabije
                      </span>
                    )}
                  </span>
                  <span className="text-[var(--muted)] tabular-nums shrink-0">
                    {g.ok}/{g.total}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className={`h-full ${weak ? "bg-yellow-400" : "bg-[var(--accent)]"}`}
                    style={{ width: `${(g.ok / g.total) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold">Obavesti me o novim testovima</h3>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Ostavi email i javićemo ti kad objavimo novi probni test.
        </p>
        <NotifyForm source="fon-probni-test-1-result" />
      </section>

      <section className="bg-[var(--card)] border border-[var(--accent)]/30 rounded-2xl p-5 text-center space-y-3">
        <p className="font-semibold">Vežbaj još uz Ko Zna Zna</p>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Besplatno možeš da vežbaš hiljade pitanja, a aplikacija sama ponavlja
          pitanja koja pogrešiš dok ih ne savladaš.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/login"
            className="inline-flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors"
            onClick={() => trackSafe("toi_fon_cta_signup")}
          >
            Prijavi se besplatno
          </Link>
          <Link
            href="/kategorije"
            className="inline-flex items-center justify-center border border-[var(--border)] text-sm font-medium rounded-xl px-5 py-2.5 hover:border-[var(--accent)]/50 transition-colors"
          >
            Sve kategorije
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-lg">Rešenja i objašnjenja</h3>
          <button
            type="button"
            onClick={() => setOnlyMissed((v) => !v)}
            aria-pressed={onlyMissed}
            className="text-xs border border-[var(--border)] rounded-full px-3 py-1.5 hover:border-[var(--accent)]/50 transition-colors"
          >
            {onlyMissed ? "Prikaži sva pitanja" : "Samo netačna i preskočena"}
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Klikni na pitanje da vidiš tačan odgovor i objašnjenje.
        </p>

        {reviewList.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            Sva pitanja su tačna. Bravo!
          </p>
        )}

        <ol className="space-y-2">
          {reviewList.map((q) => {
            const a = answers[q.id];
            const outcome: "correct" | "wrong" | "dontknow" =
              a === q.correct ? "correct" : a === "n" ? "dontknow" : "wrong";
            const tone =
              outcome === "correct"
                ? "text-[var(--success)]"
                : outcome === "wrong"
                  ? "text-[var(--error)]"
                  : "text-white";
            const status =
              outcome === "correct"
                ? "Tačno"
                : outcome === "dontknow"
                  ? "Ne znam"
                  : a
                    ? "Netačno"
                    : "Bez odgovora";
            return (
              <li key={q.id}>
                <details className="group bg-[var(--card)] border border-[var(--border)] rounded-2xl">
                  <summary
                    className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-start gap-3 p-4 text-sm font-medium ${tone}`}
                  >
                    <span className="shrink-0 w-6 tabular-nums font-bold">
                      {q.id}.
                    </span>
                    <span className="flex-1 leading-relaxed">{q.question}</span>
                    <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold">
                      {status}
                      <span
                        aria-hidden="true"
                        className="transition-transform group-open:rotate-90"
                      >
                        ▸
                      </span>
                    </span>
                  </summary>
                  <div className="px-4 pb-4 space-y-3">
                    <ul className="grid gap-2 text-sm">
                      {LETTERS.map((l) => {
                        const isCorrect = l === q.correct;
                        const isPicked = a === l;
                        return (
                          <li
                            key={l}
                            className={`rounded-xl border px-3.5 py-2 ${
                              isCorrect
                                ? "border-[var(--success)]/60 bg-[var(--success)]/10"
                                : isPicked
                                  ? "border-[var(--error)]/60 bg-[var(--error)]/10"
                                  : "border-[var(--border)] text-[var(--muted)]"
                            }`}
                          >
                            <span className="font-semibold mr-1.5">
                              {l.toUpperCase()}.
                            </span>
                            {q.options[l]}
                            {isCorrect && " ✓"}
                            {isPicked && !isCorrect && " ✗"}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-xs text-[var(--muted)]">
                      Tvoj odgovor:{" "}
                      <span className={tone}>{answerLabel(q, a)}</span>
                    </p>
                    <p className="text-sm leading-relaxed">{q.explanation}</p>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
