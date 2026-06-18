import { computeDemand } from "@/lib/model/heuristic";
import type {
  DemandCategory,
  MetroNorthAlertsInput,
  MetroNorthInput,
  ScoreBreakdown,
  SpecialEvent,
  TrafficSnapshot,
  WeatherSnapshot,
} from "@/lib/model/types";
import {
  fetchGreenwichHourlyForecast,
  type HourlyForecastPoint,
} from "@/lib/sources/openWeather";
import { fetchGreenwichTraffic } from "@/lib/sources/ctTravelSmart";
import {
  fetchMetroNorthRidership,
  metroNorthCurrentInput,
  metroNorthForecastInput,
  type MetroNorthRidership,
} from "@/lib/sources/metroNorth";
import { fetchMetroNorthAlerts } from "@/lib/sources/metroNorthAlerts";
import {
  eventsFiringAt,
  fetchAggregatedSpecialEvents,
} from "@/lib/sources/events";
import { computeTimeFeatures } from "@/lib/sources/timeFeatures";
import { GREENWICH_TZ } from "@/lib/utils/time";

// 12-hour rolling forecast in 30-min increments. We re-run the same heuristic
// for each future timestamp, swapping in:
//   - time features computed in Greenwich-local time at that timestamp
//     (handles midnight/holiday/school boundaries automatically)
//   - the matching hourly weather slice from Open-Meteo
//   - current traffic snapshot (no traffic forecast is available)
//
// The longer horizon supports lunch/dinner planning while keeping the
// interaction compact enough to scan.

export const FORECAST_HOURS = 12;
export const FORECAST_STEP_MINUTES = 30;
export const FORECAST_POINT_COUNT =
  (FORECAST_HOURS * 60) / FORECAST_STEP_MINUTES + 1; // include current = 25

// "Best time" recommendations only consider hours when a trip to the Ave is
// plausible: errands through dinner. Overnight slots stay in the strip but
// are never recommended.
export const BEST_HOUR_START = 8; // 8am
export const BEST_HOUR_END = 21; // exclusive; last candidate slot is 8:30pm

// Lowest demand inside [startHour, endHour). Without an hour restriction any
// window crossing midnight recommends ~2am, because overnight priors bottom
// out at 5 while everything is closed. Tie-break to earliest. Returns null
// when no slot qualifies (e.g. a hotspot already closed for the rest of the
// window) — the BEST card hides itself. Hotspot pages pass the anchor
// business's own opening hours.
export function bestTimeWithin(
  points: ForecastPoint[],
  startHour: number = BEST_HOUR_START,
  endHour: number = BEST_HOUR_END,
): Forecast["bestTime"] {
  let best: Forecast["bestTime"] = null;
  for (const p of points) {
    if (p.localHour < startHour || p.localHour >= endHour) continue;
    if (best === null || p.score < best.score) {
      best = { timestamp: p.timestamp, localHour: p.localHour, score: p.score };
    }
  }
  return best;
}

export type ForecastSlotInputs = {
  weather: WeatherSnapshot;
  traffic: TrafficSnapshot;
  metroNorth: MetroNorthInput | null;
  metroNorthAlerts: MetroNorthAlertsInput | null;
  eventCount: number;
  dayOfWeek: number;
};

export type ForecastPoint = {
  timestamp: string; // ISO 8601 (UTC)
  localHour: number;
  localDate: string;
  score: number;
  category: DemandCategory;
  // Populated for every slot so the interactive 4h chart can render per-slot
  // weather + traffic without a second fetch. Breakdown still cheap because
  // each slot already runs computeDemand internally.
  breakdown?: ScoreBreakdown;
  inputs?: ForecastSlotInputs;
};

// Hour-of-day target speed ratio for the New England commuter pattern.
// Weekdays: AM rush 7-9, PM rush 16-19. Weekends: a shallower midday dip.
// This is a coarse synthetic projection — we have no real traffic forecast.
function targetSpeedRatio(hour: number, dayOfWeek: number): number {
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  if (isWeekday) {
    if (hour >= 7 && hour <= 9) return 0.7;
    if (hour >= 16 && hour <= 19) return 0.65;
    if (hour >= 10 && hour <= 15) return 0.9;
    return 0.95;
  }
  if (hour >= 11 && hour <= 17) return 0.85;
  return 0.95;
}

// Blend the current TomTom snapshot toward the hour-of-day target as we walk
// forward in time. i=0 stays at observed; later slots converge to the target.
export function projectTraffic(
  base: TrafficSnapshot,
  hour: number,
  dayOfWeek: number,
  i: number,
  totalSteps: number,
): TrafficSnapshot {
  if (i === 0) return base;
  // A failed live snapshot stays flat. A future-day `projected` snapshot is
  // synthetic by design, so we still build its hour-of-day curve even though
  // base.ok is false (it scores 0 via trafficModifier — display only).
  if (!base.ok && !base.projected) return base;
  const current = base.speedRatio ?? 1.0;
  const target = targetSpeedRatio(hour, dayOfWeek);
  const blend = Math.min(1, i / Math.max(1, totalSteps - 1));
  const projected = current * (1 - blend) + target * blend;
  return { ...base, speedRatio: projected };
}

export type Forecast = {
  generatedAt: string;
  windowHours: number;
  stepMinutes: number;
  points: ForecastPoint[];
  bestTime: { timestamp: string; localHour: number; score: number } | null;
};

// Compute the "YYYY-MM-DDTHH:00" key in Greenwich local time, matching the
// shape Open-Meteo returns for hourly timestamps.
function localHourKey(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: GREENWICH_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  let hour = parts.hour;
  if (hour === "24") hour = "00";
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:00`;
}

export function indexHourly(hourly: HourlyForecastPoint[]): Map<string, HourlyForecastPoint> {
  return new Map(hourly.map((h) => [h.timestamp, h]));
}

// Map a forecast point's timestamp to the relevant hourly weather. Falls
// back to the supplied current snapshot when the hourly forecast is empty
// or doesn't cover that hour.
export function weatherForTimestamp(
  at: Date,
  hourly: Map<string, HourlyForecastPoint>,
  current: WeatherSnapshot,
): WeatherSnapshot {
  const key = localHourKey(at);
  const match = hourly.get(key);
  if (!match) return current;
  return {
    tempF: match.tempF,
    condition: match.condition,
    precipitationIn: match.precipitationIn,
    windMph: current.windMph, // hourly doesn't include wind; reuse current
    isDay: isDaylightHour(localHourOf(at)),
    fetchedAt: current.fetchedAt,
    ok: current.ok,
  };
}

// Rough daylight bounds for Greenwich CT. Without per-hour is_day data from
// the hourly feed, this stops night slots from earning the sunny-day boost
// (the old `isDay: current.isDay` gave midnight a +10 on clear 80F evenings).
export function isDaylightHour(localHour: number): boolean {
  return localHour >= 7 && localHour <= 19;
}

function localHourOf(at: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: GREENWICH_TZ,
      hour: "numeric",
      hour12: false,
    }).format(at),
  );
}

export function buildForecast({
  now,
  currentWeather,
  traffic,
  hourly,
  metroNorthData,
  metroNorthNow,
  metroNorthAlerts,
  aggregatedEvents,
}: {
  now: Date;
  currentWeather: WeatherSnapshot;
  traffic: TrafficSnapshot;
  hourly: HourlyForecastPoint[];
  // Ridership is per-day, not per-hour. Each slot's reading is derived from
  // this trailing-window data by the slot's own day-of-week (predicted =
  // recent same-weekday median → "typical"). `metroNorthNow`, when supplied,
  // overrides slot 0 (the literal "now") with the live anomaly reading so the
  // forecast strip's current slot matches the main panel.
  metroNorthData?: MetroNorthRidership | null;
  metroNorthNow?: MetroNorthInput | null;
  metroNorthAlerts?: MetroNorthAlertsInput | null;
  aggregatedEvents?: SpecialEvent[];
}): Forecast {
  const idx = indexHourly(hourly);
  const points: ForecastPoint[] = [];
  const events = aggregatedEvents ?? [];

  // Slot 0 is the literal "now"; later slots snap to the half-hour grid so
  // recommended times read "5:30 PM", not "5:09 PM" load-time precision.
  const stepMs = FORECAST_STEP_MINUTES * 60 * 1000;
  let gridStart = Math.ceil(now.getTime() / stepMs) * stepMs;
  if (gridStart === now.getTime()) gridStart += stepMs;

  for (let i = 0; i < FORECAST_POINT_COUNT; i++) {
    const t = i === 0 ? now : new Date(gridStart + (i - 1) * stepMs);
    const time = computeTimeFeatures(t);
    const weather = weatherForTimestamp(t, idx, currentWeather);
    const slotTraffic = projectTraffic(
      traffic,
      time.hour,
      time.dayOfWeek,
      i,
      FORECAST_POINT_COUNT,
    );
    const specialEvents = eventsFiringAt(events, t);
    // Slot 0 = "now" → live anomaly when provided; every other slot → the
    // predicted typical reading for that slot's day-of-week.
    const slotMetroNorth: MetroNorthInput | null =
      i === 0 && metroNorthNow
        ? metroNorthNow
        : metroNorthData
          ? metroNorthForecastInput(metroNorthData, time.dayOfWeek)
          : null;
    const demand = computeDemand({
      weather,
      traffic: slotTraffic,
      time,
      specialEvents,
      metroNorth: slotMetroNorth,
      metroNorthAlerts,
    });
    points.push({
      timestamp: t.toISOString(),
      localHour: time.hour,
      localDate: time.localDate,
      score: demand.score,
      category: demand.category,
      breakdown: demand.breakdown,
      inputs: {
        weather,
        traffic: slotTraffic,
        metroNorth: slotMetroNorth,
        metroNorthAlerts: metroNorthAlerts ?? null,
        eventCount: specialEvents.length,
        dayOfWeek: time.dayOfWeek,
      },
    });
  }

  const bestTime = bestTimeWithin(points);

  return {
    generatedAt: now.toISOString(),
    windowHours: FORECAST_HOURS,
    stepMinutes: FORECAST_STEP_MINUTES,
    points,
    bestTime,
  };
}

// Async convenience: fetches sources + runs buildForecast.
export async function buildForecastForGreenwich(
  startAt: Date = new Date(),
): Promise<Forecast> {
  const [traffic, hourly, mtaData, metroNorthAlerts, aggregatedEvents] =
    await Promise.all([
      fetchGreenwichTraffic(),
      fetchGreenwichHourlyForecast(),
      fetchMetroNorthRidership(),
      fetchMetroNorthAlerts(),
      fetchAggregatedSpecialEvents(),
    ]);
  const currentSlot = hourly.find((h) => h.timestamp === localHourKey(startAt));
  const currentWeather: WeatherSnapshot = currentSlot
    ? {
        tempF: currentSlot.tempF,
        condition: currentSlot.condition,
        precipitationIn: currentSlot.precipitationIn,
        windMph: 0,
        isDay: true,
        fetchedAt: new Date().toISOString(),
        ok: true,
      }
    : {
        tempF: 0,
        condition: "unknown",
        precipitationIn: 0,
        windMph: 0,
        isDay: true,
        fetchedAt: new Date().toISOString(),
        ok: false,
      };
  // We have no live traffic forecast. For a future day we still show a
  // synthetic hour-of-day curve (projectTraffic) labelled "(projected)", but
  // mark ok:false so confidence stays honest and `projected:true` so it scores
  // 0 (display only). speedRatio 1.0 anchors the projection to a neutral
  // free-flow start rather than carrying today's live congestion forward.
  const isFuture = startAt.getTime() - Date.now() > 60 * 60 * 1000;
  const trafficForDay: TrafficSnapshot = isFuture
    ? { ...traffic, ok: false, tomTomOk: false, projected: true, speedRatio: 1.0 }
    : traffic;
  // On the today strip, slot 0 should reflect the live ridership anomaly (same
  // as the main panel). On a future-day view there is no "now" to anchor.
  const metroNorthNow = isFuture ? null : metroNorthCurrentInput(mtaData);
  return buildForecast({
    now: startAt,
    currentWeather,
    traffic: trafficForDay,
    hourly,
    metroNorthData: mtaData,
    metroNorthNow,
    metroNorthAlerts,
    aggregatedEvents,
  });
}

export const __test__ = { localHourKey };
