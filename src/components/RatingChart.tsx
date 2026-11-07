"use client";

import { useMemo, useRef, useState } from "react";
import { TIERS } from "@/lib/rating";

interface Point {
  day: string; // YYYY-MM-DD (Belgrade date)
  shown: number;
}

interface RatingChartProps {
  history: Point[];
  // Value just before the window, so the line starts at the right level.
  historyStart?: number | null;
  days: number;
}

const W = 320; // viewBox units; the SVG scales to the container width
const H = 180;
const PAD = { top: 10, right: 12, bottom: 22, left: 12 };
const LINE = "var(--accent-text)"; // validated vs --card: lightness, chroma, contrast pass

function fmtDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// One series (shown rating per day) - no legend, the card title names it.
// Tier thresholds are the horizontal gridlines, labelled with tier names.
export default function RatingChart({
  history,
  historyStart,
  days,
}: RatingChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const points = useMemo(() => {
    const pts = [...history];
    if (historyStart != null && pts.length > 0) {
      pts.unshift({ day: isoDaysAgo(days), shown: historyStart });
    }
    return pts;
  }, [history, historyStart, days]);

  if (points.length < 2) {
    return (
      <p className="text-sm text-[var(--muted)] py-6 text-center">
        Odgovorite na nova pitanja u nekoliko dana da vidite kako se kreće vaš
        rejting.
      </p>
    );
  }

  const t0 = new Date(points[0].day).getTime();
  const t1 = new Date(points[points.length - 1].day).getTime();
  const span = Math.max(t1 - t0, 1);
  const values = points.map((p) => p.shown);
  const lo = Math.floor((Math.min(...values) - 15) / 50) * 50;
  const hi = Math.ceil((Math.max(...values) + 15) / 50) * 50;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (iso: string) =>
    PAD.left + ((new Date(iso).getTime() - t0) / span) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;

  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.shown).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(points[points.length - 1].day).toFixed(1)},${PAD.top + plotH} L${x(points[0].day).toFixed(1)},${PAD.top + plotH} Z`;
  const gridTiers = TIERS.filter(
    (t) => Number.isFinite(t.min) && t.min > lo && t.min < hi,
  );
  const last = points[points.length - 1];
  const xTicks = [points[0], points[Math.floor(points.length / 2)], last];

  const onPointer = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.day) - vx) < Math.abs(x(points[best].day) - vx)) best = i;
    });
    setHover(best);
  };

  const h = hover !== null ? points[hover] : null;
  const tipLeftPct = h ? (x(h.day) / W) * 100 : 0;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block touch-none select-none"
        role="img"
        aria-label={`Rejting kroz vreme: od ${points[0].shown} do ${last.shown}`}
      >
        {/* Tier thresholds as hairline gridlines */}
        {gridTiers.map((t) => (
          <g key={t.name}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t.min)}
              y2={y(t.min)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left + 2}
              y={y(t.min) - 3}
              fontSize={9}
              fill="var(--muted)"
            >
              {t.emoji} {t.name} · {t.min}
            </text>
          </g>
        ))}
        {/* Baseline */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <path d={area} fill={LINE} opacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke={LINE}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Latest value: end dot with a surface ring */}
        <circle
          cx={x(last.day)}
          cy={y(last.shown)}
          r={4}
          fill={LINE}
          stroke="var(--card)"
          strokeWidth={2}
        />
        {xTicks.map((p, i) => (
          <text
            key={`${p.day}-${i}`}
            x={x(p.day)}
            y={H - 6}
            fontSize={9}
            fill="var(--muted)"
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          >
            {fmtDay(p.day)}
          </text>
        ))}
        {/* Crosshair */}
        {h && (
          <g pointerEvents="none">
            <line
              x1={x(h.day)}
              x2={x(h.day)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--muted)"
              strokeWidth={1}
            />
            <circle
              cx={x(h.day)}
              cy={y(h.shown)}
              r={4}
              fill={LINE}
              stroke="var(--card)"
              strokeWidth={2}
            />
          </g>
        )}
        {/* Hit area larger than the line: the whole plot */}
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="transparent"
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {h && (
        <div
          className="absolute top-0 pointer-events-none bg-[var(--background)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={{
            left: `${tipLeftPct}%`,
            transform: `translateX(${tipLeftPct > 60 ? "-105%" : "5%"})`,
          }}
        >
          <div className="text-[var(--muted)]">{fmtDay(h.day)}</div>
          <div className="font-semibold tabular-nums">Rejting {h.shown}</div>
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
              <th className="text-right font-normal py-1">Rejting</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((p) => (
              <tr key={p.day} className="border-t border-[var(--border)]">
                <td className="py-1">{fmtDay(p.day)}</td>
                <td className="py-1 text-right">{p.shown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
