"use client";

import {
  PLACEMENT_ANSWERS,
  RatingInfo,
  formatSigned,
  isPlacement,
  tierProgress,
} from "@/lib/rating";

interface RatingCardProps {
  info: RatingInfo;
  onClick?: () => void;
}

// Lobby card: tier + shown rating + progress to the next tier, or the
// placement progress for players with fewer than 30 rated answers.
export default function RatingCard({ info, onClick }: RatingCardProps) {
  const placement = isPlacement(info);
  const { tier, next, missing, fraction } = tierProgress(info);
  const week = info.week_change ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[var(--card)] rounded-2xl p-5 border border-[var(--border)] hover:border-[var(--accent)]/60 transition-colors"
    >
      {placement ? (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">📊 Procena nivoa</div>
            <div className="text-xs text-[var(--muted)]">
              {info.rated_answers}/{PLACEMENT_ANSWERS} pitanja
            </div>
          </div>
          <div className="mt-3 h-2 bg-[var(--background)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
              style={{
                width: `${(info.rated_answers / PLACEMENT_ANSWERS) * 100}%`,
              }}
            />
          </div>
          <p className="text-xs text-[var(--muted)] mt-2">
            Odgovorite na još {PLACEMENT_ANSWERS - info.rated_answers} novih
            pitanja da otkrijete svoj nivo.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--muted)]">Rejting</div>
              <div className="text-sm font-semibold mt-0.5">
                {tier.emoji} {tier.name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums">
                {info.shown}
              </div>
              {week !== 0 && (
                <div
                  className={`text-xs tabular-nums ${
                    week > 0 ? "text-[var(--success)]" : "text-[var(--muted)]"
                  }`}
                >
                  {formatSigned(week)} ove nedelje
                </div>
              )}
            </div>
          </div>
          {next ? (
            <>
              <div className="mt-3 h-2 bg-[var(--background)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                  style={{ width: `${fraction * 100}%` }}
                />
              </div>
              <p className="text-xs text-[var(--muted)] mt-2">
                {missing > 0
                  ? `Još ${missing} do nivoa ${next.emoji} ${next.name}`
                  : `Na korak od nivoa ${next.emoji} ${next.name}`}
              </p>
            </>
          ) : (
            <p className="text-xs text-[var(--muted)] mt-2">
              Najviši nivo - svaka čast!
            </p>
          )}
        </>
      )}
    </button>
  );
}
