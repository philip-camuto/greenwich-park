import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Observation } from "@/lib/db/schema";

const getOrRefreshObservation = vi.fn();
vi.mock("@/lib/ingest", () => ({
  getOrRefreshObservation: (...a: unknown[]) => getOrRefreshObservation(...a),
}));

import { GET } from "./route";

function obs(over: Partial<Observation> = {}): Observation {
  return {
    id: 1,
    observedAt: new Date("2026-06-18T12:00:00Z"),
    computedScore: 55,
    computedCategory: "yellow",
    computedConfidence: "high",
    basePrior: 50,
    weatherMod: 2,
    trafficMod: 0,
    holidayMod: 0,
    schoolMod: 1,
    eventMod: 0,
    metroNorthMod: 1,
    metroNorthAlertsMod: 0,
    rawSum: 54,
    closureCapped: false,
    weatherTempF: 70,
    weatherCondition: "clear",
    weatherPrecipitationIn: 0,
    weatherWindMph: 5,
    weatherIsDay: true,
    weatherOk: true,
    trafficSeverity: "none",
    trafficEventsRelevant: 0,
    trafficEventsTotal: 0,
    trafficOk: true,
    trafficCurrentSpeedMph: 30,
    trafficFreeFlowSpeedMph: 35,
    trafficSpeedRatio: 0.85,
    trafficTomTomOk: true,
    mtaRidership: 1000,
    mtaVsBaseline: 0,
    mtaOk: true,
    mnrAlertsStatus: "normal",
    mnrAlertsActiveCount: 0,
    mnrAlertsOk: true,
    specialEventCount: 0,
    localDate: "2026-06-18",
    hour: 12,
    dayOfWeek: 3,
    isWeekend: false,
    isHoliday: false,
    holidayName: null,
    publicInSession: true,
    privateInSession: true,
    ...over,
  } as unknown as Observation;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/demand/current", () => {
  it("returns score, category, breakdown, inputs and the refreshed flag", async () => {
    getOrRefreshObservation.mockResolvedValue({
      observation: obs(),
      refreshed: false,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(55);
    expect(body.category).toBe("yellow");
    expect(body.confidence).toBe("high");
    expect(body.refreshed).toBe(false);
    expect(body.breakdown.base).toBe(50);
    expect(body.inputs.weather.tempF).toBe(70);
    expect(body.inputs.traffic.severity).toBe("none");
    expect(body.inputs.metroNorth.ridership).toBe(1000);
  });

  it("sets the s-maxage / SWR cache header", async () => {
    getOrRefreshObservation.mockResolvedValue({
      observation: obs(),
      refreshed: true,
    });
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toMatch(/s-maxage=60/);
    expect(res.headers.get("Cache-Control")).toMatch(/stale-while-revalidate/);
  });

  it("coalesces nullable optional fields to safe defaults", async () => {
    getOrRefreshObservation.mockResolvedValue({
      observation: obs({
        metroNorthMod: null as unknown as number,
        mtaOk: null as unknown as boolean,
        mnrAlertsStatus: null as unknown as string,
        specialEventCount: null as unknown as number,
      }),
      refreshed: false,
    });
    const body = await (await GET()).json();
    expect(body.breakdown.metroNorthMod).toBe(0);
    expect(body.inputs.metroNorth.ok).toBe(false);
    expect(body.inputs.metroNorthAlerts.newHavenLineStatus).toBe("unknown");
    expect(body.inputs.specialEventCount).toBe(0);
  });

  it("500 with the error message when the ingest layer throws", async () => {
    getOrRefreshObservation.mockRejectedValue(new Error("db unavailable"));
    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "db unavailable" });
  });
});
