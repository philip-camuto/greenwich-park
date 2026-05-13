"use client";

import { useState, type PointerEvent as RPointerEvent } from "react";
import type {
  DemandCategory,
  WeatherCondition,
} from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

// Apple-Weather-style intensity bar for the 4-hour forecast.
// Bands map to our existing 3-tier model (green ≤40, yellow ≤70, red >70).
// Hover/tap any slot to scrub through weather + traffic + score for that
// 15-min increment. A white dot marks NOW; an outline ring marks BEST.

type SlotInputs = {
  weather: {
    tempF: number;
    condition: WeatherCondition;
    precipitationIn: number;
    ok: boolean;
  };
  traffic: {
    speedRatio?: number | null;
    severity: string;
    ok: boolean;
  };
  eventCount: number;
};

type Point = {
  timestamp: string;
  localHour: number;
  score: number;
  category: DemandCategory;
  inputs?: SlotInputs;
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

const ACCENT_VAR: Record<DemandCategory, string> = {
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

function conditionLabel(c: WeatherCondition): string {
  switch (c) {
    case "clear":
      return "Clear";
    case "cloudy":
      return "Cloudy";
    case "rain":
      return "Rain";
    case "snow":
      return "Snow";
    case "thunderstorm":
      return "T-storms";
    case "fog":
      return "Fog";
    default:
      return "—";
  }
}

function trafficLabel(speedRatio: number | null | undefined): string {
  if (speedRatio == null) return "—";
  if (speedRatio >= 0.9) return "Free flow";
  if (speedRatio >= 0.75) return "Light";
  if (speedRatio >= 0.6) return "Moderate";
  return "Heavy";
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

function WeatherGlyph({ c }: { c: WeatherCondition }) {
  // Inline SVG glyphs, currentColor.
  const stroke = "currentColor";
  if (c === "rain") {
    return (
      <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
        <path
          d="M4 8a3 3 0 0 1 5.7-1.3A2.5 2.5 0 0 1 13 9.5"
          fill="none"
          stroke={stroke}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <path
          d="M6 11.5l-.7 1.5M9 11.5l-.7 1.5M12 11.5l-.7 1.5"
          stroke={stroke}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (c === "snow") {
    return (
      <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
        <path
          d="M4 8a3 3 0 0 1 5.7-1.3A2.5 2.5 0 0 1 13 9.5"
          fill="none"
          stroke={stroke}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <circle cx="6" cy="12" r="0.8" fill={stroke} />
        <circle cx="9" cy="12" r="0.8" fill={stroke} />
        <circle cx="12" cy="12" r="0.8" fill={stroke} />
      </svg>
    );
  }
  if (c === "thunderstorm") {
    return (
      <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
        <path
          d="M4 7a3 3 0 0 1 5.7-1.3A2.5 2.5 0 0 1 13 8.5"
          fill="none"
          stroke={stroke}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <path
          d="M8 9l-1.5 3h2L7 14"
          fill="none"
          stroke={stroke}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (c === "cloudy") {
    return (
      <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
        <path
          d="M3.5 10a2.5 2.5 0 0 1 2.4-2.5 3 3 0 0 1 5.8.3A2.2 2.2 0 0 1 13 12H5a2.5 2.5 0 0 1-1.5-2z"
          fill="none"
          stroke={stroke}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (c === "fog") {
    return (
      <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
        <path
          d="M3 6h10M2 9h12M3 12h10"
          stroke={stroke}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // clear / unknown → sun
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden>
      <circle cx="8" cy="8" r="3" fill="none" stroke={stroke} strokeWidth={1.4} />
      <path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ForecastChart({ points, bestTime }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

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

  const idxFromPointer = (e: RPointerEvent<SVGSVGElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xViewport = e.clientX - rect.left;
    const xSvg = (xViewport / rect.width) * W;
    const i = Math.floor((xSvg - M.l) / segWidth);
    return Math.max(0, Math.min(points.length - 1, i));
  };

  const handleMove = (e: RPointerEvent<SVGSVGElement>) => {
    setActiveIdx(idxFromPointer(e));
  };
  const handleDown = (e: RPointerEvent<SVGSVGElement>) => {
    setActiveIdx(idxFromPointer(e));
  };

  const activePoint = activeIdx != null ? points[activeIdx] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--label-tertiary)]">
            {activePoint ? "Selected" : "Now"}
          </div>
          <div
            className="mono text-[15px] font-semibold tabular-nums text-[var(--label-primary)]"
            style={{ transition: "color 250ms ease-out" }}
          >
            {activePoint
              ? timeLabel(activePoint.timestamp)
              : timeLabel(points[0].timestamp)}
          </div>
        </div>
        {bestTime && bestIdx > 0 && (
          <div className="rounded-[10px] bg-[var(--bg-group)] px-3 py-1.5 text-right">
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--label-tertiary)]">
              Best
            </div>
            <div className="mono text-[15px] font-semibold tabular-nums text-[var(--label-primary)]">
              {timeLabel(bestTime.timestamp)}
            </div>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none select-none"
        role="img"
        aria-label="Parking demand for the next 4 hours — drag to scrub"
        onPointerMove={handleMove}
        onPointerDown={handleDown}
        onPointerLeave={() => setActiveIdx(null)}
        onPointerCancel={() => setActiveIdx(null)}
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
            style={{
              transition: "fill 500ms ease-out, opacity 200ms ease-out",
              opacity: activeIdx == null || activeIdx === i ? 1 : 0.55,
            }}
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

        {activeIdx != null && (
          <g
            style={{
              transition: "transform 120ms ease-out",
              transform: `translateX(${dotX(activeIdx) - dotX(0)}px)`,
            }}
          >
            <line
              x1={dotX(0)}
              y1={barY - 6}
              x2={dotX(0)}
              y2={barY + barHeight + 6}
              stroke="var(--label-primary)"
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.85}
            />
            <circle
              cx={dotX(0)}
              cy={dotY}
              r={5}
              fill="white"
              stroke="var(--label-primary)"
              strokeWidth={2}
            />
          </g>
        )}

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

      {/* Reserved slot detail row — fixed height so the layout doesn't jump
          between hover / no-hover. */}
      <div className="grid min-h-[64px] grid-cols-3 gap-2 rounded-[10px] bg-[var(--bg-group)] px-3 py-2">
        {(() => {
          const p = activePoint ?? points[0];
          const inp = p.inputs;
          const accent = ACCENT_VAR[p.category];
          return (
            <>
              <div className="flex flex-col justify-center">
                <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--label-tertiary)]">
                  Demand
                </div>
                <div
                  className="mono text-[18px] font-semibold tabular-nums leading-tight"
                  style={{ color: accent, transition: "color 300ms ease-out" }}
                >
                  {p.score}
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--label-tertiary)]">
                  Weather
                </div>
                <div className="flex items-center gap-1.5 text-[14px] font-semibold leading-tight text-[var(--label-primary)]">
                  {inp?.weather && (
                    <span style={{ color: "var(--label-secondary)" }}>
                      <WeatherGlyph c={inp.weather.condition} />
                    </span>
                  )}
                  <span className="tabular-nums">
                    {inp?.weather?.ok
                      ? `${Math.round(inp.weather.tempF)}° ${conditionLabel(inp.weather.condition)}`
                      : "—"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--label-tertiary)]">
                  I-95 Traffic
                </div>
                <div className="text-[14px] font-semibold leading-tight text-[var(--label-primary)]">
                  {trafficLabel(inp?.traffic?.speedRatio)}
                  {inp?.traffic?.speedRatio != null && (
                    <span className="ml-1 text-[12px] font-medium tabular-nums text-[var(--label-tertiary)]">
                      {Math.round(inp.traffic.speedRatio * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </>
          );
        })()}
      </div>

      <p className="min-h-[2.6em] text-[14px] leading-snug text-[var(--label-secondary)]">
        {activePoint
          ? `${timeLabel(activePoint.timestamp)} · ${activePoint.score}/100 — drag to compare across the next 4 hours.`
          : callout}
      </p>
    </div>
  );
}
