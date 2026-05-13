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
import { fetchMetroNorthRidership } from "@/lib/sources/metroNorth";
import { fetchMetroNorthAlerts } from "@/lib/sources/metroNorthAlerts";
import {
  eventsFiringAt,
  fetchAggregatedSpecialEvents,
} from "@/lib/sources/events";
import { computeTimeFeatures } from "@/lib/sources/timeFeatures";
import { GREENWICH_TZ } from "@/lib/utils/time";

// 4-hour rolling forecast in 15-min increments. We re-run the same heuristic
// for each future timestamp, swapping in:
//   - time features computed in Greenwich-local time at that timestamp
//     (handles midnight/holiday/school boundaries automatically)
//   - the matching hourly weather slice from Open-Meteo
//   - current traffic snapshot (no traffic forecast is available)
//
// PRD specifies 4-hour horizon explicitly because compounding error past
// that window makes the curve untrustworthy.

export const FORECAST_HOURS = 4;
export const FORECAST_STEP_MINUTES = 15;
export const FORECAST_POINT_COUNT =
  (FORECAST_HOURS * 60) / FORECAST_STEP_MINUTES + 1; // include current = 17

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
  if (!base.ok || i === 0) return base;
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
    isDay: current.isDay, // approximation; good enough for 4-hour horizon
    fetchedAt: current.fetchedAt,
    ok: current.ok,
  };
}

export function buildForecast({
  now,
  currentWeather,
  traffic,
  hourly,
  metroNorth,
  metroNorthAlerts,
  aggregatedEvents,
}: {
  now: Date;
  currentWeather: WeatherSnapshot;
  traffic: TrafficSnapshot;
  hourly: HourlyForecastPoint[];
  metroNorth?: MetroNorthInput | null;
  metroNorthAlerts?: MetroNorthAlertsInput | null;
  aggregatedEvents?: SpecialEvent[];
}): Forecast {
  const idx = indexHourly(hourly);
  const points: ForecastPoint[] = [];
  const events = aggregatedEvents ?? [];

  for (let i = 0; i < FORECAST_POINT_COUNT; i++) {
    const t = new Date(now.getTime() + i * FORECAST_STEP_MINUTES * 60 * 1000);
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
    const demand = computeDemand({
      weather,
      traffic: slotTraffic,
      time,
      specialEvents,
      metroNorth,
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
        metroNorth: metroNorth ?? null,
        metroNorthAlerts: metroNorthAlerts ?? null,
        eventCount: specialEvents.length,
        dayOfWeek: time.dayOfWeek,
      },
    });
  }

  // Best time = lowest demand inside the window. Tie-break to earliest.
  let bestTime: Forecast["bestTime"] = null;
  for (const p of points) {
    if (bestTime === null || p.score < bestTime.score) {
      bestTime = { timestamp: p.timestamp, localHour: p.localHour, score: p.score };
    }
  }

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
  const [traffic, hourly, metroNorth, metroNorthAlerts, aggregatedEvents] =
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
  // Future-day traffic snapshot is meaningless (we have no traffic forecast).
  // Mark it ok:false so the heuristic drops confidence accordingly.
  const isFuture = startAt.getTime() - Date.now() > 60 * 60 * 1000;
  const trafficForDay: TrafficSnapshot = isFuture
    ? { ...traffic, ok: false }
    : traffic;
  return buildForecast({
    now: startAt,
    currentWeather,
    traffic: trafficForDay,
    hourly,
    metroNorth,
    metroNorthAlerts,
    aggregatedEvents,
  });
}

export const __test__ = { localHourKey };
