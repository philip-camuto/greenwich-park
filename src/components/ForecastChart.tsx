"use client";

import { useId, useMemo, useState } from "react";
import type { DemandCategory } from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

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
  const gradientId = useId().replace(/:/g, "");
  const defaultIdx = Math.max(
    0,
    bestTime
      ? points.findIndex((p) => p.timestamp === bestTime.timestamp)
      : 0,
  );
  const [selectedIdx, setSelectedIdx] = useState(defaultIdx);
  const labels = useMemo(
    () => points.map((p) => timeLabel(p.timestamp)),
    [points],
  );

  if (points.length === 0) return null;

  const W = 720;
  const H = 190;
  const M = { t: 24, r: 18, b: 34, l: 18 };
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;
  const scores = points.map((p) => p.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const mid = (minScore + maxScore) / 2;
  const span = Math.max(24, maxScore - minScore + 14);
  const domainMin = Math.max(0, mid - span / 2);
  const domainMax = Math.min(100, mid + span / 2);
  const domainSpan = Math.max(1, domainMax - domainMin);

  const xAt = (i: number) =>
    M.l + (i / Math.max(1, points.length - 1)) * innerW;
  const yAt = (score: number) =>
    M.t + (1 - (score - domainMin) / domainSpan) * innerH;

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
  const selected = points[Math.min(selectedIdx, points.length - 1)] ?? points[0];
  const selectedX = xAt(selectedIdx);
  const selectedY = yAt(selected.score);
  const curvePath = path();
  const areaPath = `${curvePath} L ${xAt(points.length - 1)} ${M.t + innerH} L ${xAt(0)} ${
    M.t + innerH
  } Z`;

  const ticks: Array<{ i: number; label: string }> = [
    { i: 0, label: labels[0] ?? "Now" },
    { i: Math.floor((points.length - 1) / 2), label: labels[Math.floor((points.length - 1) / 2)] ?? "" },
    { i: points.length - 1, label: labels[points.length - 1] ?? "" },
  ].filter((t) => t.i < points.length);

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <div
        className="flex items-start justify-between gap-4"
        role="status"
        aria-label={`Selected forecast ${labels[selectedIdx]}, ${selected.score} of 100`}
      >
        <div>
          <div className="text-[13px] font-semibold text-[var(--label-secondary)]">
            {selectedIdx === 0 ? "Now" : labels[selectedIdx]}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-[28px] font-semibold leading-none tracking-normal tabular-nums text-[var(--label-primary)] lg:text-[34px]">
              {selected.score}
            </span>
            <span className="text-[15px] font-semibold text-[var(--label-secondary)] lg:text-[16px]">
              /100
            </span>
          </div>
        </div>
        {bestIdx >= 0 && (
          <div className="rounded-[10px] bg-[var(--bg-group)] px-3 py-2 text-right">
            <div className="text-[12px] font-semibold text-[var(--label-secondary)]">
              Best
            </div>
            <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--label-primary)]">
              {labels[bestIdx]}
            </div>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Four-hour parking demand forecast"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--label-primary)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--label-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1={M.l}
          y1={M.t + innerH}
          x2={W - M.r}
          y2={M.t + innerH}
          stroke="var(--separator)"
          strokeWidth="1"
        />

        <line
          x1={selectedX}
          y1={M.t}
          x2={selectedX}
          y2={M.t + innerH}
          stroke="var(--separator-inset)"
          strokeDasharray="4 6"
          strokeWidth="1"
          className="transition-all duration-200 ease-out"
        />

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={curvePath}
          fill="none"
          stroke="var(--label-primary)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />

        <circle
          cx={selectedX}
          cy={selectedY}
          r="6"
          fill="var(--bg-surface)"
          stroke="var(--label-primary)"
          strokeWidth="2"
          className="transition-all duration-200 ease-out"
        />

        {bestIdx >= 0 && bestIdx !== selectedIdx && (
          <circle
            cx={xAt(bestIdx)}
            cy={yAt(points[bestIdx].score)}
            r="4"
            fill="var(--bg-surface)"
            stroke="var(--label-secondary)"
            strokeWidth="1.5"
          />
        )}

        {points.map((p, i) => (
          <circle
            key={p.timestamp}
            cx={xAt(i)}
            cy={yAt(p.score)}
            r="10"
            fill="transparent"
            className="cursor-pointer"
            onClick={() => setSelectedIdx(i)}
            onMouseEnter={() => setSelectedIdx(i)}
          />
        ))}

        {ticks.map(({ i, label }) => (
          <text
            key={`${i}-${label}`}
            x={xAt(i)}
            y={H - 6}
            fill="var(--label-secondary)"
            fontSize="12"
            fontFamily="var(--font-text), system-ui, sans-serif"
            fontWeight="650"
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
          >
            {label}
          </text>
        ))}
      </svg>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(76px,1fr))] lg:overflow-visible">
        {points.map((p, i) => {
          const isSelected = i === selectedIdx;
          const isBest = i === bestIdx;
          return (
            <button
              key={p.timestamp}
              type="button"
              onClick={() => setSelectedIdx(i)}
              className={`min-w-[76px] rounded-[10px] border px-2.5 py-2 text-left transition-all duration-200 ease-out ${
                isSelected
                  ? "border-[var(--label-primary)] bg-[var(--label-primary)] text-[var(--bg-surface)]"
                  : "border-[var(--separator)] bg-[var(--bg-surface)] text-[var(--label-primary)] hover:bg-[var(--bg-group)]"
              }`}
              aria-pressed={isSelected}
              aria-label={`${labels[i]}, ${p.score} of 100`}
            >
              <span className="block text-[11px] font-semibold leading-none">
                {i === 0 ? "Now" : labels[i]}
              </span>
              <span className="mt-1 block text-[14px] font-semibold tabular-nums tracking-normal">
                {p.score}
                {isBest ? " best" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function timeLabel(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}
