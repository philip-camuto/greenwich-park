import type { DemandCategory } from "@/lib/model/types";

type Point = {
  timestamp: string;
  localHour: number;
  score: number;
  category: DemandCategory;
};

type Props = {
  points: Point[];
  bestTime: { timestamp: string; localHour: number; score: number } | null;
};

export function ForecastChart({ points, bestTime }: Props) {
  if (points.length === 0) return null;

  const W = 360;
  const H = 140;
  const M = { t: 6, r: 4, b: 22, l: 4 };
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;

  const xAt = (i: number) =>
    M.l + (i / Math.max(1, points.length - 1)) * innerW;
  const yAt = (score: number) => M.t + (1 - score / 100) * innerH;

  // Catmull-Rom-style smoothing for a quiet, restrained curve.
  function path(): string {
    let d = `M ${xAt(0)} ${yAt(points[0].score)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const x0 = xAt(i);
      const y0 = yAt(points[i].score);
      const x1 = xAt(i + 1);
      const y1 = yAt(points[i + 1].score);
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  }

  const bestIdx = bestTime
    ? points.findIndex((p) => p.timestamp === bestTime.timestamp)
    : -1;

  // Tick labels: NOW, +2h, +4h (indices 0, 8, 16 for 15-min × 17 points)
  const ticks: Array<{ i: number; label: string }> = [
    { i: 0, label: "NOW" },
    { i: 8, label: "+2H" },
    { i: 16, label: "+4H" },
  ].filter((t) => t.i < points.length);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full block"
      style={{ height: "clamp(120px, 18vh, 180px)" }}
      role="img"
      aria-label="Four-hour parking demand forecast"
    >
      {/* baseline hairline */}
      <line
        x1={M.l}
        y1={M.t + innerH}
        x2={W - M.r}
        y2={M.t + innerH}
        stroke="var(--hairline)"
        strokeWidth="1"
      />

      {/* curve */}
      <path d={path()} fill="none" stroke="var(--fg)" strokeWidth="1" />

      {/* current-moment filled dot */}
      <circle cx={xAt(0)} cy={yAt(points[0].score)} r="3" fill="var(--fg)" />

      {/* best-time outline dot */}
      {bestIdx > 0 && (
        <circle
          cx={xAt(bestIdx)}
          cy={yAt(points[bestIdx].score)}
          r="4"
          fill="var(--bg)"
          stroke="var(--fg)"
          strokeWidth="1"
        />
      )}

      {/* tick labels */}
      {ticks.map(({ i, label }) => (
        <text
          key={label}
          x={xAt(i)}
          y={H - 6}
          fill="var(--muted)"
          fontSize="10"
          fontFamily="var(--font-mono), monospace"
          letterSpacing="0.15em"
          textAnchor={i === 0 ? "start" : i === 16 ? "end" : "middle"}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
