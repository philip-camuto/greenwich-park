// Normalize either a stored Observation row or a forecast slot (built by
// `buildForecast`) into one shape that BreakdownCard can render without
// caring which source it came from.

import type { Observation } from "@/lib/db/schema";
import type { ForecastPoint } from "@/lib/forecast";

export type BreakdownRow = {
  label: string;
  mod: number;
  reason: string;
};

export type BreakdownView = {
  when: "now" | "future";
  score: number;
  closureCapped: boolean;
  dayOfWeek: number;
  hour: number;
  baseline: number;
  baselineRationale: string;
  rows: BreakdownRow[];
};

// Short prose explaining the prior for a given (dow, hour). The prior matrix
// itself is hand-calibrated; this maps the same patterns to a one-liner so
// readers don't see a bare number with no context.
export function baselineRationale(
  dow: number,
  hour: number,
  baseline: number,
): string {
  const isWeekend = dow === 0 || dow === 6;
  const isLateNight = hour >= 22 || hour <= 5;
  const isEarlyMorning = hour >= 6 && hour <= 8;
  const isLunch = hour >= 11 && hour <= 14;
  const isDinner = hour >= 18 && hour <= 21;
  const isRetailPeak = hour >= 10 && hour <= 17;

  if (isLateNight) {
    return "Late night. Most retail and many restaurants closed.";
  }
  if (isEarlyMorning && !isWeekend) {
    return "Weekday early morning: coffee, gym, light retail. Commuter rush hits I-95, not the Ave.";
  }
  if (dow === 0 && isLunch && baseline >= 70) {
    return "Sunday brunch peak. Free parking on Sunday pulls more cars than weekdays.";
  }
  if (dow === 6 && isRetailPeak && baseline >= 80) {
    return "Saturday prime retail window. Shopping plus family lunch is the heaviest hour of the week.";
  }
  if (isWeekend && isRetailPeak) {
    return "Weekend retail hours, typical shopping pull.";
  }
  if (!isWeekend && isLunch) {
    return "Weekday lunch: office and salon/spa crowd, not commuter throughput.";
  }
  if (!isWeekend && isDinner && (dow === 4 || dow === 5)) {
    return "Thu/Fri dinner. The pre-weekend dinner crowd runs hotter than Mon-Wed.";
  }
  if (!isWeekend && isDinner) {
    return "Weekday dinner, moderate restaurant pull.";
  }
  if (isRetailPeak) {
    return "Midday retail hours, steady but not peak.";
  }
  return "Off-peak hours, light foot traffic on the Ave.";
}

function weatherReason(ok: boolean, tempF: number | null, condition: string | null): string {
  if (!ok) return "data unavailable";
  const temp = tempF != null ? `${Math.round(tempF)}°F` : "unknown";
  return `${temp}, ${condition ?? "unknown"}`;
}

function trafficReason(
  ok: boolean,
  tomTomOk: boolean | null,
  speedRatio: number | null,
  severity: string | null,
): string {
  if (tomTomOk && speedRatio != null) {
    if (speedRatio >= 0.9) return "free flow on I-95";
    if (speedRatio >= 0.7) return "I-95 mildly slow";
    if (speedRatio >= 0.5) return "I-95 congested";
    return "I-95 heavy";
  }
  if (!ok) return "data unavailable";
  return `${severity ?? "unknown"} I-95 conditions`;
}

function holidayReason(isHoliday: boolean, name: string | null, kind: string | null): string {
  if (!isHoliday) return "regular day";
  return `${name ?? "holiday"} (${kind ?? "unknown"})`;
}

function schoolReason(publicInSession: boolean, privateInSession: boolean): string {
  if (publicInSession && privateInSession) return "all schools in";
  if (!publicInSession && !privateInSession) return "all schools out";
  return "one cohort on break";
}

function eventReason(count: number): string {
  if (count === 0) return "no events firing";
  return `${count} event${count === 1 ? "" : "s"} firing`;
}

function mtaReason(ok: boolean, vsBaseline: number | null): string {
  if (!ok || vsBaseline == null) return "data unavailable";
  if (vsBaseline > 1.1) return "ridership well above baseline";
  if (vsBaseline < 0.8) return "ridership well below baseline";
  return "ridership near baseline";
}

function alertsReason(ok: boolean, status: string | null): string {
  if (!ok) return "data unavailable";
  switch (status) {
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
      return "unknown";
  }
}

export function breakdownViewFromObservation(obs: Observation): BreakdownView {
  const rows: BreakdownRow[] = [
    {
      label: "Weather",
      mod: obs.weatherMod,
      reason: weatherReason(obs.weatherOk, obs.weatherTempF, obs.weatherCondition),
    },
    {
      label: "Traffic",
      mod: obs.trafficMod,
      reason: trafficReason(
        obs.trafficOk,
        obs.trafficTomTomOk,
        obs.trafficSpeedRatio,
        obs.trafficSeverity,
      ),
    },
    {
      label: "Holidays",
      mod: obs.holidayMod,
      reason: holidayReason(obs.isHoliday, obs.holidayName, obs.holidayKind),
    },
    {
      label: "School calendar",
      mod: obs.schoolMod,
      reason: schoolReason(obs.publicInSession, obs.privateInSession),
    },
    {
      label: "Local events",
      mod: obs.eventMod,
      reason: eventReason(obs.specialEventCount ?? 0),
    },
    {
      label: "Metro-North ridership",
      mod: obs.metroNorthMod ?? 0,
      reason: mtaReason(obs.mtaOk ?? false, obs.mtaVsBaseline),
    },
    {
      label: "New Haven Line alerts",
      mod: obs.metroNorthAlertsMod ?? 0,
      reason: alertsReason(obs.mnrAlertsOk ?? false, obs.mnrAlertsStatus),
    },
  ];
  return {
    when: "now",
    score: obs.computedScore,
    closureCapped: obs.closureCapped,
    dayOfWeek: obs.dayOfWeek,
    hour: obs.hour,
    baseline: obs.basePrior,
    baselineRationale: baselineRationale(obs.dayOfWeek, obs.hour, obs.basePrior),
    rows,
  };
}

export function breakdownViewFromForecastPoint(point: ForecastPoint): BreakdownView | null {
  const b = point.breakdown;
  const inp = point.inputs;
  if (!b || !inp) return null;

  const weather = inp.weather;
  const traffic = inp.traffic;
  const mta = inp.metroNorth;
  const alerts = inp.metroNorthAlerts;

  const rows: BreakdownRow[] = [
    {
      label: "Weather",
      mod: b.weatherMod,
      reason: weatherReason(weather.ok, weather.tempF, weather.condition),
    },
    {
      label: "Traffic",
      mod: b.trafficMod,
      reason: trafficReason(
        traffic.ok,
        traffic.tomTomOk ?? false,
        traffic.speedRatio ?? null,
        traffic.severity,
      ),
    },
    {
      label: "Holidays",
      mod: b.holidayMod,
      reason: "",
    },
    {
      label: "School calendar",
      mod: b.schoolMod,
      reason: "",
    },
    {
      label: "Local events",
      mod: b.eventMod,
      reason: eventReason(inp.eventCount),
    },
    {
      label: "Metro-North ridership",
      mod: b.metroNorthMod,
      reason: mtaReason(mta?.ok ?? false, mta?.vsBaseline ?? null),
    },
    {
      label: "New Haven Line alerts",
      mod: b.metroNorthAlertsMod,
      reason: alertsReason(
        alerts?.ok ?? false,
        alerts?.newHavenLineStatus ?? null,
      ),
    },
  ];
  return {
    when: "future",
    score: point.score,
    closureCapped: b.closureCapped,
    dayOfWeek: inp.dayOfWeek,
    hour: point.localHour,
    baseline: b.base,
    baselineRationale: baselineRationale(inp.dayOfWeek, point.localHour, b.base),
    rows,
  };
}
