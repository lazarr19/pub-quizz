// XP and levels ("Nivo"). XP is awarded on the server (migration 027);
// these helpers must match its xp_level() / xp_for_level():
//   cumulative XP to reach level L = 100 * (L - 1)^1.6

export interface ProgressInfo {
  xp: number;
  level: number;
  level_xp: number; // XP at which the current level started
  next_level_xp: number; // XP needed for the next level
  learned: number; // questions learned (missed, then correct on a due repeat)
  week_xp: number;
  week_learned: number;
  due_reviews: number; // repeats due now, all categories
  history?: { day: string; xp: number }[];
}

export interface Title {
  name: string;
  emoji: string;
  minLevel: number;
}

export const TITLES: Title[] = [
  { name: "Početnik", emoji: "🌱", minLevel: 1 },
  { name: "Kvizaš", emoji: "🎯", minLevel: 5 },
  { name: "Znalac", emoji: "📚", minLevel: 10 },
  { name: "Ekspert", emoji: "🧠", minLevel: 15 },
  { name: "Majstor", emoji: "🏅", minLevel: 20 },
  { name: "Velemajstor", emoji: "👑", minLevel: 25 },
  { name: "Ko Zna Zna", emoji: "🏆", minLevel: 30 },
];

export function xpForLevel(level: number): number {
  return Math.ceil(100 * Math.pow(Math.max(level - 1, 0), 1.6));
}

export function levelFor(xp: number): number {
  return Math.floor(Math.pow(Math.max(xp, 0) / 100, 1 / 1.6)) + 1;
}

export function titleFor(level: number): Title {
  let t = TITLES[0];
  for (const candidate of TITLES) if (level >= candidate.minLevel) t = candidate;
  return t;
}

// Progress info recomputed locally from a new XP total (after an answer).
export function withXp(info: ProgressInfo, xp: number): ProgressInfo {
  const level = levelFor(xp);
  return {
    ...info,
    xp,
    level,
    level_xp: xpForLevel(level),
    next_level_xp: xpForLevel(level + 1),
  };
}

export function levelFraction(info: ProgressInfo): number {
  const span = info.next_level_xp - info.level_xp;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (info.xp - info.level_xp) / span));
}

export function formatXp(n: number): string {
  return Math.round(n).toLocaleString("sr-Latn-RS");
}
