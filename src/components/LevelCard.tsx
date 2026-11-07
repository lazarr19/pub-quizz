"use client";

import {
  ProgressInfo,
  formatXp,
  levelFraction,
  titleFor,
} from "@/lib/progress";

interface LevelCardProps {
  info: ProgressInfo;
  onClick?: () => void;
}

// Level, title, XP progress to the next level, and this week's XP / learned.
export default function LevelCard({ info, onClick }: LevelCardProps) {
  const title = titleFor(info.level);
  const toNext = Math.max(0, info.next_level_xp - info.xp);

  const body = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--muted)]">
            {title.emoji} {title.name}
          </div>
          <div className="text-2xl font-bold mt-0.5">Nivo {info.level}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums">
            {formatXp(info.xp)} XP
          </div>
          {info.week_xp > 0 && (
            <div className="text-xs text-[var(--success)] tabular-nums">
              +{formatXp(info.week_xp)} ove nedelje
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 bg-[var(--background)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
          style={{ width: `${levelFraction(info) * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--muted)] mt-2">
        <span>
          Još {formatXp(toNext)} XP do nivoa {info.level + 1}
        </span>
        {info.learned > 0 && (
          <span title="Pitanja koja ste naučili ponavljanjem">
            📘 {formatXp(info.learned)} naučeno
          </span>
        )}
      </div>
    </>
  );

  const className =
    "w-full text-left bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)]";
  return onClick ? (
    <button
      onClick={onClick}
      className={`${className} hover:border-[var(--accent)]/60 transition-colors`}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
