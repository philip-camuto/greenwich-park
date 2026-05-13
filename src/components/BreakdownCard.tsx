import { Card } from "./Card";
import type { Observation } from "@/lib/db/schema";

type Props = { observation: Observation };

type Row = {
  label: string;
  mod: number;
  reason: string;
};

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hourLabel(h: number): string {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
}

function weatherReason(obs: Observation): string {
  if (!obs.weatherOk) return "data unavailable";
  const temp =
    obs.weatherTempF != null ? `${Math.round(obs.weatherTempF)}°F` : "unknown";
  const cond = obs.weatherCondition ?? "unknown";
  return `${temp}, ${cond}`;
}

function trafficReason(obs: Observation): string {
  if (obs.trafficTomTomOk && obs.trafficSpeedRatio != null) {
    const r = obs.trafficSpeedRatio;
    if (r >= 0.9) return "free flow on I-95";
    if (r >= 0.7) return "I-95 mildly slow";
    if (r >= 0.5) return "I-95 congested";
    return "I-95 heavy";
  }
  if (!obs.trafficOk) return "data unavailable";
  return `${obs.trafficSeverity ?? "—"} I-95 conditions`;
}

function holidayReason(obs: Observation): string {
  if (!obs.isHoliday) return "regular day";
  return `${obs.holidayName} (${obs.holidayKind})`;
}

function schoolReason(obs: Observation): string {
  if (obs.publicInSession && obs.privateInSession) return "all schools in";
  if (!obs.publicInSession && !obs.privateInSession) return "all schools out";
  return "one cohort on break";
}

function eventReason(obs: Observation): string {
  const n = obs.specialEventCount ?? 0;
  if (n === 0) return "no events firing";
  return `${n} event${n === 1 ? "" : "s"} firing`;
}

function mtaReason(obs: Observation): string {
  if (!obs.mtaOk || obs.mtaVsBaseline == null) return "data unavailable";
  const r = obs.mtaVsBaseline;
  if (r > 1.1) return "ridership well above baseline";
  if (r < 0.8) return "ridership well below baseline";
  return "ridership near baseline";
}

function alertsReason(obs: Observation): string {
  if (!obs.mnrAlertsOk) return "data unavailable";
  switch (obs.mnrAlertsStatus) {
    case "suspended":
      return "service suspended";
    case "major-delays":
      return "major delays";
    case "minor-delays":
      return "minor delays";
    case "planned-work":
      return "planned work";
    case "normal":
      return "running normally";
    default:
      return "—";
  }
}

export function BreakdownCard({ observation: obs }: Props) {
  const dow = DOW_NAMES[obs.dayOfWeek] ?? "?";
  const base = obs.basePrior;
  const rows: Row[] = [
    { label: "Weather", mod: obs.weatherMod, reason: weatherReason(obs) },
    { label: "Traffic", mod: obs.trafficMod, reason: trafficReason(obs) },
    { label: "Holidays", mod: obs.holidayMod, reason: holidayReason(obs) },
    { label: "School calendar", mod: obs.schoolMod, reason: schoolReason(obs) },
    { label: "Local events", mod: obs.eventMod, reason: eventReason(obs) },
    {
      label: "Metro-North ridership",
      mod: obs.metroNorthMod ?? 0,
      reason: mtaReason(obs),
    },
    {
      label: "New Haven Line alerts",
      mod: obs.metroNorthAlertsMod ?? 0,
      reason: alertsReason(obs),
    },
  ];

  // Movers first (largest absolute mod), then quiet rows.
  const movers = rows
    .filter((r) => r.mod !== 0)
    .sort((a, b) => Math.abs(b.mod) - Math.abs(a.mod));
  const quiet = rows.filter((r) => r.mod === 0);

  return (
    <div>
      <div className="display mb-2 px-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--label-secondary)] lg:px-0">
        What goes into this score
      </div>
      <Card className="flex flex-col gap-4 lg:px-6 lg:py-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] text-[var(--label-secondary)]">
            Baseline for {dow} at {hourLabel(obs.hour)}
          </span>
          <span className="display text-[22px] font-semibold tabular-nums text-[var(--label-primary)]">
            {base}
          </span>
        </div>

        {movers.length > 0 && (
          <ul className="flex flex-col gap-3 border-t border-[var(--separator)] pt-3">
            {movers.map((r) => (
              <BreakdownRow key={r.label} {...r} />
            ))}
          </ul>
        )}

        {quiet.length > 0 && (
          <details className="border-t border-[var(--separator)] pt-3">
            <summary className="cursor-pointer list-none text-[13px] font-medium text-[var(--label-secondary)]">
              {quiet.length} signal{quiet.length === 1 ? "" : "s"} held the line
              <span aria-hidden className="ml-1">›</span>
            </summary>
            <ul className="mt-3 flex flex-col gap-3">
              {quiet.map((r) => (
                <BreakdownRow key={r.label} {...r} muted />
              ))}
            </ul>
          </details>
        )}

        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--separator)] pt-3">
          <span className="text-[14px] text-[var(--label-secondary)]">
            {obs.closureCapped ? "Score (closure-capped at 20)" : "Score"}
          </span>
          <span className="display text-[28px] font-semibold tabular-nums text-[var(--label-primary)]">
            {obs.computedScore}
          </span>
        </div>
      </Card>
    </div>
  );
}

function BreakdownRow({
  label,
  mod,
  reason,
  muted = false,
}: Row & { muted?: boolean }) {
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
          className={`text-[14px] font-medium ${
            muted ? "text-[var(--label-secondary)]" : "text-[var(--label-primary)]"
          }`}
        >
          {label}
        </span>
        <span className="text-[13px] text-[var(--label-tertiary)]">{reason}</span>
      </div>
      <span
        className={`display text-[18px] font-semibold tabular-nums ${moverClass}`}
      >
        {muted ? "0" : `${sign}${magnitude}`}
      </span>
    </li>
  );
}
