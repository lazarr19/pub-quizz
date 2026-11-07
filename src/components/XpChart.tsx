"use client";

import { useMemo, useState } from "react";
import { formatXp } from "@/lib/progress";

interface XpChartProps {
  history: { day: string; xp: number }[]; // only days with XP
  days: number;
}

const W = 320; // viewBox units; the SVG scales to the container width
const H = 150;
const PAD = { top: 12, right: 6, bottom: 20, left: 6 };
const BAR = "var(--accent-text)"; // validated vs --card: lightness, chroma, contrast pass

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Belgrade" });
}

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

// One series (XP per day): no legend - the card title names it. Each bar is
// its own hover/tap target; days without XP are empty slots, not hidden.
export default function XpChart({ history, days }: XpChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(() => {
    const byDay = new Map(history.map((h) => [h.day, h.xp]));
    return Array.from({ length: days }, (_, i) => {
      const day = isoDaysAgo(days - 1 - i);
      return { day, xp: byDay.get(day) ?? 0 };
    });
  }, [history, days]);

  const max = Math.max(...series.map((s) => s.xp));
  if (max === 0) {
    return (
      <p className="text-sm text-[var(--muted)] py-6 text-center">
        Igrajte da biste ovde videli svoj XP po danima.
      </p>
    );
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / series.length;
  const barW = Math.min(slot - 2, 24); // 2px gap between bars, capped width
  const yMax = Math.ceil(max / 50) * 50;
  const y = (v: number) => PAD.top + (1 - v / yMax) * plotH;
  const baseline = PAD.top + plotH;
  const total = series.reduce((a, s) => a + s.xp, 0);
  const active = series.filter((s) => s.xp > 0).length;

  // Bar path: 4px rounded top, square at the baseline.
  const barPath = (x: number, top: number) => {
    const h = baseline - top;
    const r = Math.min(4, barW / 2, h);
    return `M${x},${baseline} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${baseline} Z`;
  };

  const h = hover !== null ? series[hover] : null;
  const hx = hover !== null ? PAD.left + hover * slot + slot / 2 : 0;

  return (
    <div className="relative">
      <div className="flex gap-4 text-xs text-[var(--muted)] mb-2">
        <span>
          Ukupno:{" "}
          <span className="text-[var(--foreground)] font-semibold tabular-nums">
            {formatXp(total)} XP
          </span>
        </span>
        <span>
          Aktivnih dana:{" "}
          <span className="text-[var(--foreground)] font-semibold tabular-nums">
            {active}/{days}
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label={`XP po danima, poslednjih ${days} dana: ukupno ${total} XP, ${active} aktivnih dana`}
      >
        {/* Recessive gridline at the top value + baseline */}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(yMax)} y2={y(yMax)} stroke="var(--border)" strokeWidth={1} />
        <text x={W - PAD.right} y={y(yMax) - 3} fontSize={9} fill="var(--muted)" textAnchor="end">
          {formatXp(yMax)} XP
        </text>
        <line x1={PAD.left} x2={W - PAD.right} y1={baseline} y2={baseline} stroke="var(--border)" strokeWidth={1} />

        {series.map((s, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          return (
            <g key={s.day}>
              {s.xp > 0 && (
                <path
                  d={barPath(x, Math.min(y(s.xp), baseline - 2))}
                  fill={BAR}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {/* Hit target: the whole slot, taller than the bar */}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            </g>
          );
        })}

        {[0, Math.floor(series.length / 2), series.length - 1].map((i, k) => (
          <text
            key={i}
            x={PAD.left + i * slot + slot / 2}
            y={H - 5}
            fontSize={9}
            fill="var(--muted)"
            textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
          >
            {fmtDay(series[i].day)}
          </text>
        ))}
      </svg>

      {h && (
        <div
          className="absolute pointer-events-none bg-[var(--background)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={{
            left: `${(hx / W) * 100}%`,
            top: 24,
            transform: `translateX(${hx / W > 0.6 ? "-105%" : "5%"})`,
          }}
        >
          <div className="text-[var(--muted)]">{fmtDay(h.day)}</div>
          <div className="font-semibold tabular-nums">
            {h.xp > 0 ? `+${formatXp(h.xp)} XP` : "Bez igre"}
          </div>
        </div>
      )}

      <details className="mt-2">
        <summary className="text-xs text-[var(--muted)] cursor-pointer">
          Prikaži kao tabelu
        </summary>
        <table className="mt-2 w-full text-xs tabular-nums">
          <thead>
            <tr className="text-[var(--muted)]">
              <th className="text-left font-normal py-1">Dan</th>
              <th className="text-right font-normal py-1">XP</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().filter((s) => s.xp > 0).map((s) => (
              <tr key={s.day} className="border-t border-[var(--border)]">
                <td className="py-1">{fmtDay(s.day)}</td>
                <td className="py-1 text-right">{formatXp(s.xp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
