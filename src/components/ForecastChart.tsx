"use client";

import {
  useEffect,
  useState,
  type KeyboardEvent as RKeyboardEvent,
  type PointerEvent as RPointerEvent,
} from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import type {
  DemandCategory,
  WeatherCondition,
} from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

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
  // Fires only when the *pinned* slot changes (tap, drag, arrow keys).
  // Hover previews stay local to the chart so the big score / breakdown /
  // modeled-time displays don't flicker when the cursor brushes past.
  onPinChange?: (idx: number | null) => void;
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
      return "-";
  }
}

function trafficLabel(speedRatio: number | null | undefined): string {
  if (speedRatio == null) return "No data";
  if (speedRatio >= 0.9) return "Free flow";
  if (speedRatio >= 0.75) return "Light";
  if (speedRatio >= 0.6) return "Moderate";
  return "Heavy";
}

function forecastWindowHours(points: Point[]): number {
  if (points.length < 2) return 0;
  const start = new Date(points[0].timestamp).getTime();
  const end = new Date(points[points.length - 1].timestamp).getTime();
  return Math.max(1, Math.round((end - start) / 3_600_000));
}

function calloutFor(
  points: Point[],
  bestTime: Props["bestTime"],
  windowHours: number,
): string {
  if (points.length === 0) return "";
  const current = points[0];
  const last = points[points.length - 1];
  const windowLabel = `${windowHours} hours`;

  if (!bestTime || bestTime.timestamp === current.timestamp) {
    if (current.category === "green") {
      return `Plenty of spots through the next ${windowLabel}.`;
    }
    if (current.category === "yellow") {
      return `Moderately busy through the next ${windowLabel}.`;
    }
    return `Tight right now and not easing in the next ${windowLabel}.`;
  }

  const bestAt = timeLabel(bestTime.timestamp);
  const gap = current.score - bestTime.score;

  if (current.category === "red") {
    return gap > 30
      ? `Tight now. Much easier by ${bestAt}.`
      : `Tight now. Eases by ${bestAt}.`;
  }
  if (current.category === "green" && last.category !== "green") {
    return "Open now, filling later - best to come early.";
  }
  if (gap > 15) return `Easier around ${bestAt}.`;
  if (gap > 5) return `Should ease up by ${bestAt}.`;
  return "Steady - expect roughly this through the window.";
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
  // clear / unknown => sun
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

export function ForecastChart({ points, bestTime, onPinChange }: Props) {
  // Two-layer state: a sticky pin (set by tap / drag / arrow keys) and a
  // transient hover preview. Hover wins for display when both exist, so a
  // mouse-over feels responsive without erasing the user's chosen pin.
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);

  // Hover preview wins for display, but pinned is the persistent state.
  const activeIdx = hoverIdx ?? pinnedIdx;

  // Notify the parent only when the pinned slot changes — hover previews stay
  // local so the score / breakdown / modeled-time don't flicker on every
  // mouse move. Declared before the early-return so hook order is stable.
  useEffect(() => {
    onPinChange?.(pinnedIdx);
  }, [pinnedIdx, onPinChange]);

  if (points.length === 0) return null;

  const W = 720;
  const H = 86;
  const M = { t: 12, r: 12, b: 30, l: 12 };
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;
  const barHeight = 10;
  const barY = M.t + (innerH - barHeight) / 2;

  const segWidth = innerW / points.length;
  const segX = (i: number) => M.l + i * segWidth;
  const dotX = (i: number) => segX(i) + segWidth / 2;
  const dotY = barY + barHeight / 2;

  const bestIdx = bestTime
    ? points.findIndex((p) => p.timestamp === bestTime.timestamp)
    : -1;

  // 5 ticks at i=0, ~1/4, ~1/2, ~3/4, last. Labels reflect the actual
  // elapsed hours from the first slot, so the same component works for any
  // window size (4h, 12h, 24h, …) without hard-coding step labels.
  const firstMs = new Date(points[0].timestamp).getTime();
  const tickFractions = [0, 0.25, 0.5, 0.75, 1];
  const ticks: Array<{ i: number; label: string }> = tickFractions.map((f) => {
    const i = Math.min(
      Math.round(f * (points.length - 1)),
      points.length - 1,
    );
    if (i === 0) return { i, label: "NOW" };
    const hours = Math.round(
      (new Date(points[i].timestamp).getTime() - firstMs) / 3_600_000,
    );
    return { i, label: `+${hours}H` };
  });

  const windowHours = forecastWindowHours(points);
  const callout = calloutFor(points, bestTime, windowHours);

  const idxFromPointer = (e: RPointerEvent<SVGSVGElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xViewport = e.clientX - rect.left;
    const xSvg = (xViewport / rect.width) * W;
    const i = Math.floor((xSvg - M.l) / segWidth);
    return Math.max(0, Math.min(points.length - 1, i));
  };

  const handleDown = (e: RPointerEvent<SVGSVGElement>) => {
    setIsPointerDown(true);
    setPinnedIdx(idxFromPointer(e));
    setHoverIdx(null);
    // Capture so we keep getting pointer events even if the finger / mouse
    // wanders outside the SVG mid-drag.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const handleMove = (e: RPointerEvent<SVGSVGElement>) => {
    const idx = idxFromPointer(e);
    if (isPointerDown) {
      setPinnedIdx(idx);
    } else {
      setHoverIdx(idx);
    }
  };
  const handleUp = (e: RPointerEvent<SVGSVGElement>) => {
    setIsPointerDown(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const handleLeave = () => {
    // Keep the pinned position; only clear the transient hover.
    setIsPointerDown(false);
    setHoverIdx(null);
  };
  const handleKeyDown = (e: RKeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      setPinnedIdx((cur) => {
        const start = cur ?? 0;
        return Math.max(0, Math.min(points.length - 1, start + delta));
      });
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setPinnedIdx(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setPinnedIdx(points.length - 1);
      return;
    }
    if (e.key === "Escape") {
      setPinnedIdx(null);
      setHoverIdx(null);
    }
  };

  const activePoint = activeIdx != null ? points[activeIdx] : null;
  const sliderIdx = activeIdx ?? 0;
  const sliderPoint = points[sliderIdx];
  // Stays mounted while scrubbing (dimmed via the group opacity below) so
  // the marker the BEST card points at doesn't blink in and out.
  const showBestMarker = bestIdx > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
            {activePoint ? "Selected" : "Now"}
          </div>
          <div
            className="mt-1 text-[15px] font-semibold tabular-nums text-[var(--label-primary)]"
            style={{ transition: "color 250ms ease-out" }}
          >
            {activePoint
              ? timeLabel(activePoint.timestamp)
              : timeLabel(points[0].timestamp)}
          </div>
        </div>
        {bestTime && bestIdx > 0 && (
          <div className="rounded-[6px] border border-[var(--separator)] bg-[var(--bg-elevated)] px-3 py-1.5 text-right">
            <div className="mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
              Best
            </div>
            <div className="mt-1 text-[15px] font-semibold tabular-nums text-[var(--label-primary)]">
              {timeLabel(bestTime.timestamp)}
            </div>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--label-secondary)]"
        role="slider"
        aria-label={`Parking demand forecast for the next ${windowHours} hours`}
        aria-valuemin={0}
        aria-valuemax={points.length - 1}
        aria-valuenow={sliderIdx}
        aria-valuetext={`${timeLabel(sliderPoint.timestamp)}, ${sliderPoint.score} of 100`}
        tabIndex={0}
        onPointerMove={handleMove}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerLeave={handleLeave}
        onPointerCancel={handleUp}
        onKeyDown={handleKeyDown}
      >
        {points.map((p, i) => (
          <rect
            key={p.timestamp}
            className="forecast-bar"
            x={segX(i)}
            y={barY}
            // +0.6 overlap to avoid sub-pixel gaps between adjacent rects.
            width={segWidth + 0.6}
            height={barHeight}
            fill={BAND_COLOR[p.category]}
            style={{
              transition: "fill 500ms ease-out, opacity 200ms ease-out",
              opacity: activeIdx == null || activeIdx === i ? 1 : 0.42,
              animationDelay: `${i * 22}ms`,
            }}
          />
        ))}

        {showBestMarker && (
          <g
            style={{
              opacity: activeIdx == null ? 1 : 0.3,
              transition: "opacity 140ms ease-out",
            }}
          >
            <circle
              className="forecast-best-ring"
              cx={dotX(bestIdx)}
              cy={dotY}
              r={6}
              fill="none"
              stroke="var(--label-primary)"
              strokeWidth={1.5}
            />
            <text
              x={Math.max(M.l + 12, Math.min(W - M.r - 12, dotX(bestIdx)))}
              y={barY - 7}
              fontSize="11"
              fontWeight={600}
              fontFamily="var(--font-mono), ui-monospace, monospace"
              fill="var(--label-secondary)"
              textAnchor="middle"
              letterSpacing="0.1em"
            >
              BEST
            </text>
          </g>
        )}

        <g className="forecast-scrubber">
          <line
            x1={dotX(sliderIdx)}
            y1={barY - 6}
            x2={dotX(sliderIdx)}
            y2={barY + barHeight + 6}
            stroke="var(--label-secondary)"
            strokeWidth={1}
            strokeLinecap="round"
            opacity={activeIdx == null ? 0 : 0.85}
            style={{ transition: "x1 140ms ease-out, x2 140ms ease-out, opacity 140ms ease-out" }}
          />
          <circle
            cx={dotX(sliderIdx)}
            cy={dotY}
            r={4.5}
            fill="var(--label-primary)"
            stroke="var(--bg-surface)"
            strokeWidth={1.5}
            // Hidden at rest like the line above — otherwise it sits parked
            // at NOW and reads as a second, unexplained dot beside the ring.
            opacity={activeIdx == null ? 0 : 1}
            style={{ transition: "cx 140ms ease-out, opacity 140ms ease-out" }}
          />
        </g>

        {ticks.map(({ i, label }) => (
          <text
            key={label}
            x={dotX(i)}
            y={H - 8}
            fontSize="11"
            fontWeight={600}
            fontFamily="var(--font-mono), ui-monospace, monospace"
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
          between hover / no-hover. Numbers use AnimatedNumber so scrubbing
          glides instead of snapping. */}
      <SlotDetail point={activePoint ?? points[0]} />

      <p className="min-h-[2.4em] text-[12px] leading-relaxed text-[var(--label-secondary)]">
        {activePoint
          ? `Showing ${timeLabel(activePoint.timestamp)} - tap, drag, or use arrow keys to scrub.`
          : `${callout} Tap the bar to pin a time.`}
      </p>
    </div>
  );
}

function SlotDetail({ point }: { point: Point }) {
  const inp = point.inputs;
  const accent = ACCENT_VAR[point.category];
  const tempF = inp?.weather?.ok ? Math.round(inp.weather.tempF) : null;
  const conditionText = inp?.weather?.ok ? conditionLabel(inp.weather.condition) : "-";
  const speedRatio = inp?.traffic?.speedRatio;
  const trafficPct =
    speedRatio != null ? Math.max(0, Math.min(100, Math.round(speedRatio * 100))) : null;

  return (
    <div className="grid min-h-[62px] grid-cols-1 gap-3 rounded-[6px] border border-[var(--separator)] bg-[var(--bg-elevated)] px-3 py-2 sm:grid-cols-3 sm:gap-2">
      <div className="flex flex-col justify-center">
        <div className="mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
          Demand
        </div>
        <AnimatedNumber
          value={point.score}
          className="mono text-[18px] font-semibold tabular-nums leading-tight"
          style={{ color: accent, transition: "color 300ms ease-out" }}
        />
      </div>
      <div className="flex flex-col justify-center">
        <div className="mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
          Weather
        </div>
        <div className="flex items-center gap-1.5 text-[14px] font-semibold leading-tight text-[var(--label-primary)]">
          {inp?.weather && (
            <span style={{ color: "var(--label-secondary)" }}>
              <WeatherGlyph c={inp.weather.condition} />
            </span>
          )}
          {tempF != null ? (
            <span className="flex items-baseline gap-1">
              <span className="flex items-baseline tabular-nums">
                <AnimatedNumber value={tempF} />
                <span>°</span>
              </span>
              <span>{conditionText}</span>
            </span>
          ) : (
            <span className="text-[var(--label-tertiary)]">No data</span>
          )}
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <div className="mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
          I-95 Traffic
        </div>
        <div className="flex items-baseline gap-1 text-[14px] font-semibold leading-tight text-[var(--label-primary)]">
          <span>{trafficLabel(speedRatio)}</span>
          {trafficPct != null && (
            <span className="text-[12px] font-medium tabular-nums text-[var(--label-tertiary)]">
              <AnimatedNumber value={trafficPct} />%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
