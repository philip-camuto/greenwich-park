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

const ACCENT: Record<DemandCategory, string> = {
  green: "var(--green)",
  yellow: "var(--amber)",
  red: "var(--red)",
};

function fmtHour(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

export function ForecastChart({ points, bestTime }: Props) {
  if (points.length === 0) return null;

  // Viewbox is internal coordinates; the SVG scales to width 100%.
  const W = 360;
  const H = 180;
  const M = { t: 14, r: 12, b: 22, l: 12 };
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;

  const xAt = (i: number) =>
    M.l + (i / Math.max(1, points.length - 1)) * innerW;
  const yAt = (score: number) => M.t + (1 - score / 100) * innerH;

  // Cubic smoothing — turn the polyline into a Catmull-Rom-ish curve so the
  // chart doesn't feel sawtoothed when scores step between priors.
  function smoothPath(): string {
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

  const areaPath = `${smoothPath()} L ${xAt(points.length - 1)} ${
    M.t + innerH
  } L ${xAt(0)} ${M.t + innerH} Z`;

  const bestIdx = bestTime
    ? points.findIndex((p) => p.timestamp === bestTime.timestamp)
    : -1;

  // Axis tick hours: now, +1h, +2h, +3h, +4h
  const tickIndices = [0, 4, 8, 12, 16].filter((i) => i < points.length);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-auto block"
      style={{ height: "clamp(150px, 22vh, 240px)" }}
      role="img"
      aria-label="Four-hour parking demand forecast"
    >
      {/* baseline + ceiling hairlines */}
      <line
        x1={M.l}
        y1={M.t + innerH}
        x2={W - M.r}
        y2={M.t + innerH}
        stroke="var(--hairline)"
        strokeWidth="1"
      />
      <line
        x1={M.l}
        y1={M.t}
        x2={W - M.r}
        y2={M.t}
        stroke="var(--hairline)"
        strokeWidth="1"
        opacity="0.5"
      />

      {/* tick marks at the hour boundaries */}
      {tickIndices.map((i) => (
        <line
          key={`tick-${i}`}
          x1={xAt(i)}
          y1={M.t + innerH}
          x2={xAt(i)}
          y2={M.t + innerH + 4}
          stroke="var(--hairline)"
          strokeWidth="1"
        />
      ))}

      {/* fill under curve — very subtle, just to give the curve body */}
      <path d={areaPath} fill="var(--fg)" opacity="0.04" />

      {/* curve */}
      <path
        d={smoothPath()}
        fill="none"
        stroke="var(--fg)"
        strokeWidth="1.5"
        opacity="0.85"
      />

      {/* current-moment vertical dotted line at i=0 */}
      <line
        x1={xAt(0)}
        y1={M.t}
        x2={xAt(0)}
        y2={M.t + innerH}
        stroke="var(--fg)"
        strokeWidth="1"
        strokeDasharray="1.5 3"
        opacity="0.4"
      />

      {/* best-time marker */}
      {bestIdx > 0 && (
        <g>
          <circle
            cx={xAt(bestIdx)}
            cy={yAt(points[bestIdx].score)}
            r="4"
            fill="var(--bg)"
            stroke={ACCENT[points[bestIdx].category]}
            strokeWidth="1.5"
          />
          <line
            x1={xAt(bestIdx)}
            y1={yAt(points[bestIdx].score) - 8}
            x2={xAt(bestIdx)}
            y2={M.t + innerH}
            stroke={ACCENT[points[bestIdx].category]}
            strokeWidth="1"
            strokeDasharray="1 2"
            opacity="0.45"
          />
        </g>
      )}

      {/* hour labels along the bottom */}
      {tickIndices.map((i) => (
        <text
          key={`label-${i}`}
          x={xAt(i)}
          y={H - 6}
          fill="var(--muted)"
          fontSize="9"
          fontFamily="var(--font-mono), monospace"
          letterSpacing="0.1em"
          textAnchor={i === 0 ? "start" : i === tickIndices[tickIndices.length - 1] ? "end" : "middle"}
        >
          {i === 0 ? "NOW" : fmtHour(points[i].localHour).toUpperCase()}
        </text>
      ))}
    </svg>
  );
}
