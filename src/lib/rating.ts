// Player rating ("Rejting") display helpers. The rating itself is computed on
// the server (migration 026): `shown` is the cautious rating the player sees,
// `peak_shown` the highest shown value ever reached. Tiers are based on the
// peak, so an earned tier is never taken away.

export const PLACEMENT_ANSWERS = 30;

export interface Tier {
  name: string;
  emoji: string;
  min: number;
}

export const TIERS: Tier[] = [
  { name: "Početnik", emoji: "🌱", min: -Infinity },
  { name: "Kvizaš", emoji: "🎯", min: 800 },
  { name: "Znalac", emoji: "📚", min: 900 },
  { name: "Ekspert", emoji: "🧠", min: 1000 },
  { name: "Majstor", emoji: "🏅", min: 1100 },
  { name: "Velemajstor", emoji: "👑", min: 1200 },
  { name: "Ko Zna Zna", emoji: "🏆", min: 1300 },
];

// Lowest value a progress bar starts from (shown rating starts at 700).
const FLOOR = 700;

export interface RatingInfo {
  shown: number;
  rated_answers: number;
  peak_shown: number;
  week_change?: number;
  history?: { day: string; shown: number }[];
  history_start?: number | null;
}

export function tierIndex(peak: number): number {
  let idx = 0;
  TIERS.forEach((t, i) => {
    if (peak >= t.min) idx = i;
  });
  return idx;
}

export function isPlacement(info: RatingInfo): boolean {
  return info.rated_answers < PLACEMENT_ANSWERS;
}

// Tier (by peak), the next tier, how many points of shown rating are still
// missing to reach it, and the fill of a progress bar between the two.
export function tierProgress(info: RatingInfo) {
  const idx = tierIndex(info.peak_shown);
  const tier = TIERS[idx];
  const next = TIERS[idx + 1] ?? null;
  if (!next) return { tier, next, missing: 0, fraction: 1 };
  const from = Number.isFinite(tier.min) ? tier.min : FLOOR;
  const fraction = Math.min(
    1,
    Math.max(0, (info.shown - from) / (next.min - from)),
  );
  return {
    tier,
    next,
    missing: Math.max(0, Math.ceil(next.min - info.shown)),
    fraction,
  };
}

export function formatSigned(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "±0";
}
