import { desc } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { observations, type Observation } from "@/lib/db/schema";
import { computeDemand } from "@/lib/model/heuristic";
import { fetchGreenwichTraffic } from "@/lib/sources/ctTravelSmart";
import { fetchGreenwichWeather } from "@/lib/sources/openWeather";
import { computeTimeFeatures } from "@/lib/sources/timeFeatures";
import { fetchTomTomFlow } from "@/lib/sources/tomTom";
import {
  fetchMetroNorthRidership,
  metroNorthCurrentInput,
} from "@/lib/sources/metroNorth";
import { fetchMetroNorthAlerts } from "@/lib/sources/metroNorthAlerts";
import { fetchAggregatedSpecialEvents, eventsFiringAt } from "@/lib/sources/events";

// Phase 1: ingest is the single write path. Called by /api/cron/ingest
// (for scheduled or manual writes) and by /api/demand/current on cache miss.
// Same function so the DB stays consistent across both triggers.

export const STALE_AFTER_SECONDS = 15 * 60; // 15min: matches our source caches.
export const MAX_STALE_DISPLAY_SECONDS = 60 * 60; // after 1h, block for fresh data.
// Don't write more than once per minute. Also dedupes the cold-start race
// where two simultaneous cache-miss requests on different serverless
// instances would each insert a row ~100ms apart.
export const MIN_INGEST_INTERVAL_MS = 60_000;

let backgroundRefresh: Promise<Observation> | null = null;

export async function runIngest(): Promise<Observation> {
  // Short-circuit if a fresh row was written in the last MIN_INGEST_INTERVAL_MS.
  // Defends against: (a) cron + on-demand racing, (b) leaked CRON_SECRET being
  // hammered against /api/cron/ingest, (c) two cold-start instances racing.
  const latest = await getLatestObservation();
  if (latest && Date.now() - new Date(latest.observedAt).getTime() < MIN_INGEST_INTERVAL_MS) {
    return latest;
  }

  const [weather, traffic, tomTom, mta, mnrAlerts, aggregatedEvents] = await Promise.all([
    fetchGreenwichWeather(),
    fetchGreenwichTraffic(),
    fetchTomTomFlow(),
    fetchMetroNorthRidership(),
    fetchMetroNorthAlerts(),
    fetchAggregatedSpecialEvents(),
  ]);
  const time = computeTimeFeatures();
  const now = new Date();
  const firingEvents = eventsFiringAt(aggregatedEvents, now);

  // Derive the live ridership anomaly: most recent actual day vs its own
  // day-of-week trailing median (see metroNorth.ts).
  const mtaInput = metroNorthCurrentInput(mta);

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
    metroNorth: mtaInput,
    metroNorthAlerts: mnrAlerts,
  });

  // Surface a degraded ingest. The row is still persisted (low-confidence
  // rows are training signal — see below), but a silently-dark feed is an
  // operational problem: emit a structured log naming every source that
  // returned ok:false so a degraded run is visible in logs/alerting rather
  // than only discoverable by querying confidence after the fact.
  // Each source object carries its own `ok` flag (false on upstream error
  // or missing key). Special events have no ok flag — they degrade to an
  // empty list internally — so they aren't tracked here.
  const failedSources = [
    !weather.ok && "weather",
    !traffic.ok && "traffic",
    !tomTom.ok && "tomTom",
    !mta.ok && "metroNorth",
    !mnrAlerts.ok && "metroNorthAlerts",
  ].filter((s): s is string => typeof s === "string");

  if (failedSources.length > 0) {
    // Matches the codebase's "[module] message:" + payload logging pattern
    // (see src/lib/sources/*). console.error (not warn) because one or more
    // live feeds went dark, which lowers the confidence of every row written
    // until it recovers.
    console.error("[ingest] degraded observation — source(s) failed:", {
      failedSources,
      failedCount: failedSources.length,
      totalSources: 5,
      confidence: demand.confidence,
      category: demand.category,
      score: demand.score,
      observedAt: now.toISOString(),
    });
  }

  // Always insert, even when every source returned ok:false. Low-confidence
  // rows are training-time signal ("data was unavailable at this timestamp")
  // and the Phase 2 trainer filters by computedConfidence. Skipping outages
  // would create gaps that look like cron failures instead of real states.
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
      // MTA Metro-North ridership (latest actual day vs trailing same-DOW median).
      mtaRidership: mtaInput.ridership,
      mtaVsBaseline: mtaInput.vsBaseline,
      mtaOk: mtaInput.ok,
      metroNorthMod: demand.breakdown.metroNorthMod,
      // MTA real-time alerts (NH Line family).
      mnrAlertsStatus: mnrAlerts.newHavenLineStatus,
      mnrAlertsActiveCount: mnrAlerts.activeAlertCount,
      mnrAlertsOk: mnrAlerts.ok,
      metroNorthAlertsMod: demand.breakdown.metroNorthAlertsMod,
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

export function isTooOldForDisplay(obs: Observation, nowMs = Date.now()): boolean {
  const age = nowMs - new Date(obs.observedAt).getTime();
  return age > MAX_STALE_DISPLAY_SECONDS * 1000;
}

function scheduleRefresh(): void {
  if (backgroundRefresh) return;
  after(() => {
    backgroundRefresh = runIngest().finally(() => {
      backgroundRefresh = null;
    });
  });
}

// On-demand pattern: read latest; if stale or missing, refresh. This is what
// /api/demand/current hits.
//
// Stale-but-displayable rows are served immediately and refreshed AFTER the
// response (scheduleRefresh) rather than inline. Two reasons:
//   1. The visitor isn't held hostage by six upstream fetches.
//   2. Inline refreshes ran concurrently with the page render's own source
//      fetches on a cold instance, and that contention produced observations
//      where every input was marked failed (the June 2026 "running blind"
//      incident). Post-response, the instance is otherwise idle.
// Only a missing or too-old-to-display row blocks on a synchronous ingest.
export async function getOrRefreshObservation(): Promise<{
  observation: Observation;
  refreshed: boolean;
}> {
  const latest = await getLatestObservation();
  if (latest && !isStale(latest)) {
    return { observation: latest, refreshed: false };
  }
  if (latest && !isTooOldForDisplay(latest)) {
    scheduleRefresh();
    return { observation: latest, refreshed: false };
  }
  const fresh = await runIngest();
  return { observation: fresh, refreshed: true };
}

// UI read pattern: render quickly from the latest row when it is still
// reasonably fresh, then refresh after the response. This avoids making the
// user stare at a loading shell while every upstream signal responds.
export async function getObservationForDisplay(): Promise<{
  observation: Observation;
  refreshed: boolean;
  refreshScheduled: boolean;
}> {
  const latest = await getLatestObservation();
  if (!latest || isTooOldForDisplay(latest)) {
    const fresh = await runIngest();
    return { observation: fresh, refreshed: true, refreshScheduled: false };
  }

  const stale = isStale(latest);
  if (stale) scheduleRefresh();
  return {
    observation: latest,
    refreshed: false,
    refreshScheduled: stale,
  };
}
