import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { observations, type Observation } from "@/lib/db/schema";
import { computeDemand } from "@/lib/model/heuristic";
import { fetchGreenwichTraffic } from "@/lib/sources/ctTravelSmart";
import { fetchGreenwichWeather } from "@/lib/sources/openWeather";
import { computeTimeFeatures, findSpecialEvent } from "@/lib/sources/timeFeatures";

// Phase 1: ingest is the single write path. Called by /api/cron/ingest
// (for scheduled or manual writes) and by /api/demand/current on cache miss.
// Same function so the DB stays consistent across both triggers.

export const STALE_AFTER_SECONDS = 15 * 60; // 15min: matches our source caches.

export async function runIngest(): Promise<Observation> {
  const [weather, traffic] = await Promise.all([
    fetchGreenwichWeather(),
    fetchGreenwichTraffic(),
  ]);
  const time = computeTimeFeatures();
  const specialEvent = findSpecialEvent(time.localDate);
  const demand = computeDemand({ weather, traffic, time, specialEvent });

  const [row] = await db
    .insert(observations)
    .values({
      // Weather.
      weatherTempF: weather.tempF,
      weatherCondition: weather.condition,
      weatherPrecipitationIn: weather.precipitationIn,
      weatherWindMph: weather.windMph,
      weatherIsDay: weather.isDay,
      weatherOk: weather.ok,
      // Traffic.
      trafficSeverity: traffic.severity,
      trafficEventsRelevant: traffic.greenwichRelevantEvents,
      trafficEventsTotal: traffic.i95EventsTotal,
      trafficNorthboundAffected: traffic.northboundAffected,
      trafficSouthboundAffected: traffic.southboundAffected,
      trafficClosureNearby: traffic.closureNearby,
      trafficOk: traffic.ok,
      // Time.
      localDate: time.localDate,
      hour: time.hour,
      dayOfWeek: time.dayOfWeek,
      isWeekend: time.isWeekend,
      isHoliday: time.isHoliday,
      holidayKind: time.holidayKind,
      holidayName: time.holidayName,
      publicInSession: time.schoolStatus.publicInSession,
      privateInSession: time.schoolStatus.privateInSession,
      // Heuristic output.
      computedScore: demand.score,
      computedCategory: demand.category,
      computedConfidence: demand.confidence,
      basePrior: demand.breakdown.base,
      weatherMod: demand.breakdown.weatherMod,
      trafficMod: demand.breakdown.trafficMod,
      holidayMod: demand.breakdown.holidayMod,
      schoolMod: demand.breakdown.schoolMod,
      eventMod: demand.breakdown.eventMod,
      rawSum: demand.breakdown.rawSum,
      closureCapped: demand.breakdown.closureCapped,
    })
    .returning();
  return row;
}

export async function getLatestObservation(): Promise<Observation | null> {
  const rows = await db
    .select()
    .from(observations)
    .orderBy(desc(observations.observedAt))
    .limit(1);
  return rows[0] ?? null;
}

export function isStale(obs: Observation, nowMs = Date.now()): boolean {
  const age = nowMs - new Date(obs.observedAt).getTime();
  return age > STALE_AFTER_SECONDS * 1000;
}

// On-demand pattern: read latest; if stale or missing, write a new one.
// This is what /api/demand/current hits.
export async function getOrRefreshObservation(): Promise<{
  observation: Observation;
  refreshed: boolean;
}> {
  const latest = await getLatestObservation();
  if (latest && !isStale(latest)) {
    return { observation: latest, refreshed: false };
  }
  const fresh = await runIngest();
  return { observation: fresh, refreshed: true };
}
