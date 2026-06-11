"use client";

import { Card } from "./Card";
import { useScrubState } from "./DemandScrubProvider";
import {
  breakdownViewFromForecastPoint,
  type BreakdownRow,
  type BreakdownView,
} from "@/lib/breakdown-view";
import type { ForecastPoint } from "@/lib/forecast";

type Props = {
  // Rendered when no scrub is active (initial load, or pin cleared).
  initialView: BreakdownView;
  // Used to derive a fresh BreakdownView for whichever slot the user pins.
  forecastPoints: ForecastPoint[];
};

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hourLabel(h: number): string {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
}

export function BreakdownCard({ initialView, forecastPoints }: Props) {
  const { pinnedIdx } = useScrubState();
  // Pin at idx 0 means "Now" — keep the more-accurate initialView (which on
  // "today" comes from the live observation, not the forecast model).
  const pinnedPoint =
    pinnedIdx != null && pinnedIdx > 0 ? forecastPoints[pinnedIdx] : null;
  const view =
    (pinnedPoint && breakdownViewFromForecastPoint(pinnedPoint)) ??
    initialView;

  const dow = DOW_NAMES[view.dayOfWeek] ?? "?";
  const movers = view.rows
    .filter((r) => r.mod !== 0)
    .sort((a, b) => Math.abs(b.mod) - Math.abs(a.mod));
  const quiet = view.rows.filter((r) => r.mod === 0);
  // "Held the line" implies the signal reported and was neutral. A signal
  // whose fetch failed did neither; say so instead of claiming it held.
  const downCount = quiet.filter((r) => r.reason === "data unavailable").length;
  const heldCount = quiet.length - downCount;
  const quietSummary =
    downCount === 0
      ? `${heldCount} signal${heldCount === 1 ? "" : "s"} held the line`
      : heldCount === 0
        ? `${downCount} signal${downCount === 1 ? "" : "s"} unavailable`
        : `${heldCount} held the line, ${downCount} unavailable`;

  return (
    <div>
      <div className="mono mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
        What goes into this score
      </div>
      <Card className="flex flex-col gap-4 lg:px-5 lg:py-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-[var(--label-secondary)]">
              Baseline: {dow} at {hourLabel(view.hour)}
            </span>
            <span className="mono text-[20px] font-semibold tabular-nums text-[var(--label-primary)]">
              {view.baseline}
            </span>
          </div>
          <p className="text-[13px] leading-snug text-[var(--label-tertiary)]">
            {view.baselineRationale}
          </p>
        </div>

        {movers.length > 0 && (
          <ul className="flex flex-col gap-3 border-t border-[var(--separator)] pt-3">
            {movers.map((r) => (
              <Row key={r.label} {...r} />
            ))}
          </ul>
        )}

        {quiet.length > 0 && (
          <details className="border-t border-[var(--separator)] pt-3">
            <summary className="cursor-pointer list-none text-[13px] font-medium text-[var(--label-secondary)]">
              {quietSummary}
              <span aria-hidden className="ml-1">›</span>
            </summary>
            <ul className="mt-3 flex flex-col gap-3">
              {quiet.map((r) => (
                <Row key={r.label} {...r} muted />
              ))}
            </ul>
          </details>
        )}

        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--separator)] pt-3">
          <span className="text-[13px] text-[var(--label-secondary)]">
            {view.closureCapped
              ? "Score (closure-capped at 20)"
              : view.when === "future"
                ? "Projected score"
                : "Score"}
          </span>
          <span className="mono text-[26px] font-semibold tabular-nums text-[var(--label-primary)]">
            {view.score}
          </span>
        </div>
      </Card>
    </div>
  );
}

function Row({
  label,
  mod,
  reason,
  muted = false,
}: BreakdownRow & { muted?: boolean }) {
  const sign = mod > 0 ? "+" : mod < 0 ? "−" : "";
  const magnitude = Math.abs(mod);
  const moverClass = muted
    ? "text-[var(--label-tertiary)]"
    : mod > 0
      ? "text-[var(--state-tough)]"
      : "text-[var(--state-quiet)]";
  return (
    <li className="flex items-baseline justify-between gap-3">
      <div className="flex flex-col">
        <span
          className={`text-[13px] font-medium ${
            muted ? "text-[var(--label-secondary)]" : "text-[var(--label-primary)]"
          }`}
        >
          {label}
        </span>
        <span className="text-[13px] text-[var(--label-tertiary)]">{reason}</span>
      </div>
      <span className={`mono text-[16px] font-semibold tabular-nums ${moverClass}`}>
        {muted ? "0" : `${sign}${magnitude}`}
      </span>
    </li>
  );
}
