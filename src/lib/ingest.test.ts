import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MetroNorthInput,
  TrafficSnapshot,
  WeatherSnapshot,
} from "./model/types";
import type { Observation } from "./db/schema";

// ---------------------------------------------------------------------------
// Module mocks. runIngest() reaches out to six live source modules, the
// heuristic, and the Neon DB. None of those may run for real in unit tests.
// We mock each at the module boundary (no existing test needed this because
// the source-level tests stub global fetch — but ingest orchestrates whole
// modules, so we mock the modules themselves).
// ---------------------------------------------------------------------------

const fetchGreenwichWeather = vi.fn();
const fetchGreenwichTraffic = vi.fn();
const fetchTomTomFlow = vi.fn();
const fetchMetroNorthRidership = vi.fn();
const fetchMetroNorthAlerts = vi.fn();
const fetchAggregatedSpecialEvents = vi.fn();
const metroNorthCurrentInput = vi.fn();
const eventsFiringAt = vi.fn();
const computeTimeFeatures = vi.fn();
const computeDemand = vi.fn();

// DB mock. runIngest first calls getLatestObservation() (a select) and may
// short-circuit; then it inserts. We expose controllable select + insert.
const selectRows: { current: Observation[] } = { current: [] };
const insertReturning = vi.fn();

vi.mock("./db/client", () => {
  const limit = vi.fn(async () => selectRows.current);
  const orderBy = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ orderBy }));
  const select = vi.fn(() => ({ from }));

  const returning = vi.fn(async () => [insertReturning()]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));

  return { db: { select, insert } };
});

vi.mock("./sources/openWeather", () => ({
  fetchGreenwichWeather: (...a: unknown[]) => fetchGreenwichWeather(...a),
}));
vi.mock("./sources/ctTravelSmart", () => ({
  fetchGreenwichTraffic: (...a: unknown[]) => fetchGreenwichTraffic(...a),
}));
vi.mock("./sources/tomTom", () => ({
  fetchTomTomFlow: (...a: unknown[]) => fetchTomTomFlow(...a),
}));
vi.mock("./sources/metroNorth", () => ({
  fetchMetroNorthRidership: (...a: unknown[]) => fetchMetroNorthRidership(...a),
  metroNorthCurrentInput: (...a: unknown[]) => metroNorthCurrentInput(...a),
}));
vi.mock("./sources/metroNorthAlerts", () => ({
  fetchMetroNorthAlerts: (...a: unknown[]) => fetchMetroNorthAlerts(...a),
}));
vi.mock("./sources/events", () => ({
  fetchAggregatedSpecialEvents: (...a: unknown[]) =>
    fetchAggregatedSpecialEvents(...a),
  eventsFiringAt: (...a: unknown[]) => eventsFiringAt(...a),
}));
vi.mock("./sources/timeFeatures", () => ({
  computeTimeFeatures: (...a: unknown[]) => computeTimeFeatures(...a),
}));
vi.mock("./model/heuristic", () => ({
  computeDemand: (...a: unknown[]) => computeDemand(...a),
}));
// next/server's `after` runs the callback synchronously enough for our needs;
// scheduleRefresh isn't exercised by the tests below, but stub `after` so it
// never schedules real work.
vi.mock("next/server", () => ({ after: vi.fn() }));

// Import AFTER mocks so the module under test binds to them.
import {
  runIngest,
  getLatestObservation,
  isStale,
  isTooOldForDisplay,
  STALE_AFTER_SECONDS,
  MAX_STALE_DISPLAY_SECONDS,
  MIN_INGEST_INTERVAL_MS,
} from "./ingest";

// ---- builders ----
function weather(ok = true): WeatherSnapshot {
  return {
    tempF: 70,
    condition: "clear",
    precipitationIn: 0,
    windMph: 5,
    isDay: true,
    fetchedAt: "2026-06-18T12:00:00Z",
    ok,
  };
}
function traffic(ok = true): TrafficSnapshot {
  return {
    severity: "none",
    greenwichRelevantEvents: 0,
    i95EventsTotal: 0,
    northboundAffected: false,
    southboundAffected: false,
    closureNearby: false,
    fetchedAt: "2026-06-18T12:00:00Z",
    ok,
  };
}
function tomTom(ok = true) {
  return {
    currentSpeedMph: 30,
    freeFlowSpeedMph: 35,
    speedRatio: 0.85,
    roadClosure: false,
    confidence: 1,
    fetchedAt: "2026-06-18T12:00:00Z",
    ok,
  };
}
function ridership(ok = true) {
  return {
    latestDate: "2026-06-17",
    latestRidership: 1000,
    medianByDow: { 3: 1000 },
    ok,
    fetchedAt: "2026-06-18T12:00:00Z",
  };
}
function mnrInput(ok = true): MetroNorthInput {
  return { ridership: 1000, vsBaseline: 0, ok };
}
function alerts(ok = true) {
  return {
    newHavenLineStatus: "normal" as const,
    activeAlertCount: 0,
    ok,
    fetchedAt: "2026-06-18T12:00:00Z",
  };
}
function timeFeatures() {
  return {
    hour: 12,
    dayOfWeek: 3,
    isWeekend: false,
    isHoliday: false,
    holidayKind: "none" as const,
    holidayName: null,
    schoolStatus: {
      publicInSession: true,
      privateInSession: true,
      anyInSession: true,
      allInSession: true,
    },
    isSchoolInSession: true,
    localDate: "2026-06-18",
  };
}
function demand() {
  return {
    score: 55,
    category: "yellow" as const,
    confidence: "high" as const,
    breakdown: {
      base: 50,
      baseSource: "prior" as const,
      weatherMod: 2,
      trafficMod: 0,
      holidayMod: 0,
      schoolMod: 1,
      eventMod: 0,
      metroNorthMod: 1,
      metroNorthAlertsMod: 0,
      rawSum: 54,
      closureCapped: false,
    },
  };
}
// A persisted row as returned by the insert .returning(). We only assert on a
// handful of fields, but include the ok-flag columns the route/log read.
function persistedRow(over: Partial<Observation> = {}): Observation {
  return {
    id: 42,
    observedAt: new Date(),
    computedScore: 55,
    computedCategory: "yellow",
    computedConfidence: "high",
    weatherOk: true,
    trafficOk: true,
    trafficTomTomOk: true,
    mtaOk: true,
    mnrAlertsOk: true,
    ...over,
  } as unknown as Observation;
}

function wireHappySources() {
  fetchGreenwichWeather.mockResolvedValue(weather(true));
  fetchGreenwichTraffic.mockResolvedValue(traffic(true));
  fetchTomTomFlow.mockResolvedValue(tomTom(true));
  fetchMetroNorthRidership.mockResolvedValue(ridership(true));
  fetchMetroNorthAlerts.mockResolvedValue(alerts(true));
  fetchAggregatedSpecialEvents.mockResolvedValue([]);
  metroNorthCurrentInput.mockReturnValue(mnrInput(true));
  eventsFiringAt.mockReturnValue([]);
  computeTimeFeatures.mockReturnValue(timeFeatures());
  computeDemand.mockReturnValue(demand());
}

beforeEach(() => {
  vi.clearAllMocks();
  selectRows.current = []; // no prior row → no short-circuit
  insertReturning.mockReturnValue(persistedRow());
  wireHappySources();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runIngest — happy path", () => {
  it("fetches all sources, persists, and returns the row without logging a failure", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const row = await runIngest();

    expect(fetchGreenwichWeather).toHaveBeenCalledOnce();
    expect(fetchGreenwichTraffic).toHaveBeenCalledOnce();
    expect(fetchTomTomFlow).toHaveBeenCalledOnce();
    expect(fetchMetroNorthRidership).toHaveBeenCalledOnce();
    expect(fetchMetroNorthAlerts).toHaveBeenCalledOnce();
    expect(fetchAggregatedSpecialEvents).toHaveBeenCalledOnce();
    expect(computeDemand).toHaveBeenCalledOnce();

    expect(row.id).toBe(42);
    expect(row.computedScore).toBe(55);
    // Success path must NOT emit the degraded log.
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("short-circuits and returns the latest row when one was written under the min interval", async () => {
    const recent = persistedRow({
      observedAt: new Date(Date.now() - (MIN_INGEST_INTERVAL_MS - 5_000)),
    });
    selectRows.current = [recent];

    const row = await runIngest();
    expect(row.id).toBe(42);
    // No fetch should have happened — we reused the fresh row.
    expect(fetchGreenwichWeather).not.toHaveBeenCalled();
    expect(insertReturning).not.toHaveBeenCalled();
  });

  it("does NOT short-circuit when the latest row is older than the min interval", async () => {
    selectRows.current = [
      persistedRow({
        observedAt: new Date(Date.now() - (MIN_INGEST_INTERVAL_MS + 5_000)),
      }),
    ];
    await runIngest();
    expect(fetchGreenwichWeather).toHaveBeenCalledOnce();
    expect(insertReturning).toHaveBeenCalledOnce();
  });
});

describe("runIngest — degraded path", () => {
  it("persists with ok:false flags AND emits a structured failure log when one source fails", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchTomTomFlow.mockResolvedValue(tomTom(false)); // TomTom dark

    await runIngest();

    // Still persisted (low-confidence rows are training signal).
    expect(insertReturning).toHaveBeenCalledOnce();

    // Structured log emitted naming the failed source + resulting confidence.
    expect(errSpy).toHaveBeenCalledOnce();
    const [msg, payload] = errSpy.mock.calls[0];
    expect(String(msg)).toMatch(/\[ingest\]/);
    expect(String(msg)).toMatch(/degraded/i);
    expect(payload).toMatchObject({
      failedSources: ["tomTom"],
      failedCount: 1,
      confidence: "high",
    });
  });

  it("names every failed source when several feeds go dark", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchGreenwichWeather.mockResolvedValue(weather(false));
    fetchMetroNorthRidership.mockResolvedValue(ridership(false));
    fetchMetroNorthAlerts.mockResolvedValue(alerts(false));

    await runIngest();

    const payload = errSpy.mock.calls[0][1] as {
      failedSources: string[];
      failedCount: number;
    };
    expect(payload.failedSources.sort()).toEqual(
      ["metroNorth", "metroNorthAlerts", "weather"].sort(),
    );
    expect(payload.failedCount).toBe(3);
    // Row is still written despite three dark feeds.
    expect(insertReturning).toHaveBeenCalledOnce();
  });

  it("logs a failure even when EVERY source is dark, and still persists", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchGreenwichWeather.mockResolvedValue(weather(false));
    fetchGreenwichTraffic.mockResolvedValue(traffic(false));
    fetchTomTomFlow.mockResolvedValue(tomTom(false));
    fetchMetroNorthRidership.mockResolvedValue(ridership(false));
    fetchMetroNorthAlerts.mockResolvedValue(alerts(false));

    await runIngest();
    const payload = errSpy.mock.calls[0][1] as { failedCount: number };
    expect(payload.failedCount).toBe(5);
    expect(insertReturning).toHaveBeenCalledOnce();
  });
});

describe("getLatestObservation", () => {
  it("returns the first row from the descending-by-observedAt query", async () => {
    selectRows.current = [persistedRow({ id: 7 })];
    const row = await getLatestObservation();
    expect(row?.id).toBe(7);
  });
  it("returns null when the table is empty", async () => {
    selectRows.current = [];
    expect(await getLatestObservation()).toBeNull();
  });
});

describe("staleness logic", () => {
  const at = (ageMs: number): Observation =>
    persistedRow({ observedAt: new Date(Date.now() - ageMs) });

  it("isStale is false just under the threshold and true just over", () => {
    const threshold = STALE_AFTER_SECONDS * 1000;
    expect(isStale(at(threshold - 1_000))).toBe(false);
    expect(isStale(at(threshold + 1_000))).toBe(true);
  });

  it("isStale is false exactly at the boundary (age == threshold)", () => {
    const now = 1_000_000_000_000;
    const obs = persistedRow({
      observedAt: new Date(now - STALE_AFTER_SECONDS * 1000),
    });
    // age == threshold → not strictly greater → not stale
    expect(isStale(obs, now)).toBe(false);
  });

  it("isTooOldForDisplay is false under and true over the 1h cap", () => {
    const cap = MAX_STALE_DISPLAY_SECONDS * 1000;
    expect(isTooOldForDisplay(at(cap - 1_000))).toBe(false);
    expect(isTooOldForDisplay(at(cap + 1_000))).toBe(true);
  });

  it("a fresh row is neither stale nor too old", () => {
    const fresh = at(1_000);
    expect(isStale(fresh)).toBe(false);
    expect(isTooOldForDisplay(fresh)).toBe(false);
  });

  it("a row between STALE and MAX is stale but still displayable", () => {
    const mid = at((STALE_AFTER_SECONDS + 60) * 1000);
    expect(isStale(mid)).toBe(true);
    expect(isTooOldForDisplay(mid)).toBe(false);
  });
});
