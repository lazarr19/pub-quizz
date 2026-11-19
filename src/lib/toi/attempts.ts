const CLIENT_KEY = "kzz-client-id";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// A random id that stays in this browser, so repeat attempts from one person
// can be told apart from many different people. It identifies no one.
export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return newId();
  }
}

export interface AttemptPayload {
  attemptId: string;
  testId: string;
  correct: number;
  wrong: number;
  dontKnow: number;
  blank: number;
  durationMs: number;
  timedOut: boolean;
  // question id -> "a".."e" or "n"; unanswered questions are left out
  answers: Record<string, string>;
}

// Returns true once the attempt is stored. Re-sending the same attemptId is
// harmless (the database ignores duplicates), so callers can simply retry.
export async function recordTestAttempt(p: AttemptPayload): Promise<boolean> {
  try {
    // Loaded on demand to keep the Supabase client out of the initial bundle.
    const { createClient } = await import("@/lib/supabase/client");
    const { error } = await createClient().rpc("record_test_attempt", {
      p_attempt_id: p.attemptId,
      p_test_id: p.testId,
      p_client_id: getClientId(),
      p_correct: p.correct,
      p_wrong: p.wrong,
      p_dont_know: p.dontKnow,
      p_blank: p.blank,
      p_duration_ms: Math.round(p.durationMs),
      p_timed_out: p.timedOut,
      p_answers: p.answers,
    });
    return !error;
  } catch {
    return false;
  }
}
