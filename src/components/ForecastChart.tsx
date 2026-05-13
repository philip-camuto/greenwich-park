import type { DemandCategory } from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

// Apple-Weather-style intensity bar for the 4-hour forecast.
// Bands map to our existing 3-tier model (green ≤40, yellow ≤70, red >70).
// A white dot marks NOW; an outline ring marks BEST inside the window.
// Below the bar: 5 relative ticks (NOW, +1H, +2H, +3H, +4H) and a one-line
// plain-English callout that summarizes the curve.

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

const BAND_COLOR: Record<DemandCategory, string> = {
  green: "var(--state-quiet)",
  yellow: "var(--state-busy)",
  red: "var(--state-tough)",
};

function timeLabel(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

function calloutFor(points: Point[], bestTime: Props["bestTime"]): string {
  if (points.length === 0) return "";
  const current = points[0];
  const last = points[points.length - 1];

  if (!bestTime || bestTime.timestamp === current.timestamp) {
    if (current.category === "green") {
      return "Plenty of spots through the next 4 hours.";
    }
    if (current.category === "yellow") {
      return "Moderately busy through the next 4 hours.";
    }
    return "Tight right now and not easing in the next 4 hours.";
  }

  const bestAt = timeLabel(bestTime.timestamp);
  const gap = current.score - bestTime.score;

  if (current.category === "red") {
    return gap > 30
      ? `Tight now. Much easier by ${bestAt}.`
      : `Tight now. Eases by ${bestAt}.`;
  }
  if (current.category === "green" && last.category !== "green") {
    return "Open now, filling later — best to come early.";
  }
  if (gap > 15) return `Easier around ${bestAt}.`;
  if (gap > 5) return `Should ease up by ${bestAt}.`;
  return "Steady — expect roughly this through the window.";
}

export function ForecastChart({ points, bestTime }: Props) {
  if (points.length === 0) return null;

  const W = 720;
  const H = 96;
  const M = { t: 12, r: 12, b: 30, l: 12 };
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;
  const barHeight = 14;
  const barY = M.t + (innerH - barHeight) / 2;

  const segWidth = innerW / points.length;
  const segX = (i: number) => M.l + i * segWidth;
  const dotX = (i: number) => segX(i) + segWidth / 2;
  const dotY = barY + barHeight / 2;

  const bestIdx = bestTime
    ? points.findIndex((p) => p.timestamp === bestTime.timestamp)
    : -1;

  // 5 ticks at i=0, ~1/4, ~1/2, ~3/4, last.
  const stepBetweenTicks = Math.max(1, Math.floor((points.length - 1) / 4));
  const ticks: Array<{ i: number; label: string }> = [
    { i: 0, label: "NOW" },
    { i: Math.min(stepBetweenTicks, points.length - 1), label: "+1H" },
    { i: Math.min(stepBetweenTicks * 2, points.length - 1), label: "+2H" },
    { i: Math.min(stepBetweenTicks * 3, points.length - 1), label: "+3H" },
    { i: points.length - 1, label: "+4H" },
  ];

  const callout = calloutFor(points, bestTime);

  return (
    <div className="flex flex-col gap-3">
      {bestTime && bestIdx > 0 && (
        <div className="flex justify-end">
          <div className="rounded-[10px] bg-[var(--bg-group)] px-3 py-1.5 text-right">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--label-tertiary)]">
              Best
            </div>
            <div className="mono text-[15px] font-semibold tabular-nums text-[var(--label-primary)]">
              {timeLabel(bestTime.timestamp)}
            </div>
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Parking demand for the next 4 hours"
      >
        {points.map((p, i) => (
          <rect
            key={p.timestamp}
            x={segX(i)}
            y={barY}
            // +0.6 overlap to avoid sub-pixel gaps between adjacent rects.
            width={segWidth + 0.6}
            height={barHeight}
            fill={BAND_COLOR[p.category]}
          />
        ))}

        {bestIdx > 0 && (
          <circle
            cx={dotX(bestIdx)}
            cy={dotY}
            r={7}
            fill="none"
            stroke="white"
            strokeWidth={2.5}
          />
        )}

        <circle
          cx={dotX(0)}
          cy={dotY}
          r={6}
          fill="white"
          stroke="var(--label-primary)"
          strokeOpacity={0.4}
          strokeWidth={1}
        />

        {ticks.map(({ i, label }) => (
          <text
            key={label}
            x={dotX(i)}
            y={H - 8}
            fontSize="11"
            fontWeight={600}
            fontFamily="var(--font-text), system-ui, sans-serif"
            fill="var(--label-secondary)"
            textAnchor={
              i === 0
                ? "start"
                : i === points.length - 1
                  ? "end"
                  : "middle"
            }
          >
            {label}
          </text>
        ))}
      </svg>

      <p className="text-[14px] leading-snug text-[var(--label-secondary)]">
        {callout}
      </p>
    </div>
  );
}
