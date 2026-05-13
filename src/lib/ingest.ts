import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { observations, type Observation } from "@/lib/db/schema";
import { computeDemand } from "@/lib/model/heuristic";
import { fetchGreenwichTraffic } from "@/lib/sources/ctTravelSmart";
import { fetchGreenwichWeather } from "@/lib/sources/openWeather";
import { computeTimeFeatures } from "@/lib/sources/timeFeatures";
import { fetchTomTomFlow } from "@/lib/sources/tomTom";
import { fetchMetroNorthRidership } from "@/lib/sources/metroNorth";
import { fetchAggregatedSpecialEvents, eventsFiringAt } from "@/lib/sources/events";

// Phase 1: ingest is the single write path. Called by /api/cron/ingest
// (for scheduled or manual writes) and by /api/demand/current on cache miss.
// Same function so the DB stays consistent across both triggers.

export const STALE_AFTER_SECONDS = 15 * 60; // 15min: matches our source caches.

export async function runIngest(): Promise<Observation> {
  const [weather, traffic, tomTom, mta, aggregatedEvents] = await Promise.all([
    fetchGreenwichWeather(),
    fetchGreenwichTraffic(),
    fetchTomTomFlow(),
    fetchMetroNorthRidership(),
    fetchAggregatedSpecialEvents(),
  ]);
  const time = computeTimeFeatures();
  const now = new Date();
  const firingEvents = eventsFiringAt(aggregatedEvents, now);

  // Merge TomTom into the traffic snapshot
  const mergedTraffic = {
    ...traffic,
    currentSpeedMph: tomTom.currentSpeedMph,
    freeFlowSpeedMph: tomTom.freeFlowSpeedMph,
    speedRatio: tomTom.speedRatio,
    tomTomOk: tomTom.ok,
    // If TomTom reports closure, surface it on the merged snapshot too
    closureNearby: traffic.closureNearby || tomTom.roadClosure,
  };

  const demand = computeDemand({
    weather,
    traffic: mergedTraffic,
    time,
    specialEvents: firingEvents,
    metroNorth: mta,
  });

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
      trafficClosureNearby: mergedTraffic.closureNearby,
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
      // TomTom traffic (new in v2 sources).
      trafficCurrentSpeedMph: tomTom.currentSpeedMph,
      trafficFreeFlowSpeedMph: tomTom.freeFlowSpeedMph,
      trafficSpeedRatio: tomTom.speedRatio,
      trafficTomTomOk: tomTom.ok,
      // MTA Metro-North ridership (new in v2 sources).
      mtaRidership: mta.ridership,
      mtaVsBaseline: mta.vsBaseline,
      mtaOk: mta.ok,
      metroNorthMod: demand.breakdown.metroNorthMod,
      // Aggregated special events.
      specialEventCount: firingEvents.length,
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
