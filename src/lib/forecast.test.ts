import { describe, expect, it } from "vitest";
import {
  __test__,
  buildForecast,
  FORECAST_POINT_COUNT,
  indexHourly,
  weatherForTimestamp,
  BEST_HOUR_START,
  BEST_HOUR_END,
} from "./forecast";
import type {
  HourlyForecastPoint,
} from "./sources/openWeather";
import type { TrafficSnapshot, WeatherSnapshot } from "./model/types";

const { localHourKey } = __test__;

function w(over: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    tempF: 70,
    condition: "clear",
    precipitationIn: 0,
    windMph: 5,
    isDay: true,
    fetchedAt: "2026-05-12T20:00:00Z",
    ok: true,
    ...over,
  };
}
function tr(over: Partial<TrafficSnapshot> = {}): TrafficSnapshot {
  return {
    severity: "none",
    greenwichRelevantEvents: 0,
    i95EventsTotal: 0,
    northboundAffected: false,
    southboundAffected: false,
    closureNearby: false,
    fetchedAt: "2026-05-12T20:00:00Z",
    ok: true,
    ...over,
  };
}

describe("localHourKey", () => {
  it("returns Greenwich-local YYYY-MM-DDTHH:00", () => {
    // 2026-05-12 16:30 ET == 2026-05-12 20:30 UTC (EDT)
    expect(localHourKey(new Date("2026-05-12T20:30:00Z"))).toBe("2026-05-12T16:00");
  });
  it("pads to 2 digits", () => {
    expect(localHourKey(new Date("2026-05-12T13:00:00Z"))).toBe("2026-05-12T09:00");
  });
});

describe("weatherForTimestamp", () => {
  const hourly: HourlyForecastPoint[] = [
    {
      timestamp: "2026-05-12T16:00",
      tempF: 65,
      condition: "rain",
      precipitationIn: 0.05,
    },
  ];
  const idx = indexHourly(hourly);

  it("uses matching hourly slot", () => {
    const out = weatherForTimestamp(new Date("2026-05-12T20:30:00Z"), idx, w());
    expect(out.condition).toBe("rain");
    expect(out.tempF).toBe(65);
  });
  it("falls back to current when no match", () => {
    const out = weatherForTimestamp(new Date("2026-05-13T05:00:00Z"), idx, w());
    expect(out.condition).toBe("clear");
    expect(out.tempF).toBe(70);
  });
});

describe("buildForecast", () => {
  const now = new Date("2026-05-09T16:00:00Z"); // Sat 12:00pm ET
  const hourly: HourlyForecastPoint[] = [
    { timestamp: "2026-05-09T12:00", tempF: 75, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-09T13:00", tempF: 76, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-09T14:00", tempF: 77, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-09T15:00", tempF: 78, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-09T16:00", tempF: 78, condition: "clear", precipitationIn: 0 },
  ];

  it("produces 25 points spanning 12 hours in 30-min steps", () => {
    const f = buildForecast({ now, currentWeather: w(), traffic: tr(), hourly });
    expect(f.points).toHaveLength(FORECAST_POINT_COUNT);
    expect(f.points).toHaveLength(25);
    expect(f.stepMinutes).toBe(30);
    expect(f.windowHours).toBe(12);
  });

  it("timestamps are strictly increasing", () => {
    const f = buildForecast({ now, currentWeather: w(), traffic: tr(), hourly });
    for (let i = 1; i < f.points.length; i++) {
      expect(new Date(f.points[i].timestamp).getTime()).toBeGreaterThan(
        new Date(f.points[i - 1].timestamp).getTime(),
      );
    }
  });

  it("bestTime is the lowest-score point within recommendable hours (8am-9pm)", () => {
    const f = buildForecast({ now, currentWeather: w(), traffic: tr(), hourly });
    const candidates = f.points.filter(
      (p) => p.localHour >= BEST_HOUR_START && p.localHour < BEST_HOUR_END,
    );
    const minScore = Math.min(...candidates.map((p) => p.score));
    expect(f.bestTime?.score).toBe(minScore);
  });

  it("never recommends an overnight best time, even when overnight is the global minimum", () => {
    // Sat noon + 12h crosses midnight; overnight priors (~5) are the global
    // minimum, but a 2am parking recommendation is useless.
    const f = buildForecast({ now, currentWeather: w(), traffic: tr(), hourly });
    expect(f.bestTime).not.toBeNull();
    expect(f.bestTime!.localHour).toBeGreaterThanOrEqual(BEST_HOUR_START);
    expect(f.bestTime!.localHour).toBeLessThan(BEST_HOUR_END);
  });

  it("snaps every slot after the first to the half-hour grid", () => {
    const offGrid = new Date("2026-05-09T16:09:23Z"); // 12:09:23pm ET
    const f = buildForecast({ now: offGrid, currentWeather: w(), traffic: tr(), hourly });
    expect(f.points[0].timestamp).toBe(offGrid.toISOString());
    for (const pt of f.points.slice(1)) {
      const d = new Date(pt.timestamp);
      expect(d.getUTCMinutes() % 30).toBe(0);
      expect(d.getUTCSeconds()).toBe(0);
    }
  });

  it("rain forecast pulls scores down", () => {
    const rainyHourly: HourlyForecastPoint[] = hourly.map((h) => ({
      ...h,
      condition: "rain",
      precipitationIn: 0.1,
    }));
    const clear = buildForecast({ now, currentWeather: w(), traffic: tr(), hourly });
    const rainy = buildForecast({
      now,
      currentWeather: w(),
      traffic: tr(),
      hourly: rainyHourly,
    });
    expect(rainy.points[8].score).toBeLessThan(clear.points[8].score);
  });

  it("falls back to current weather when hourly is empty", () => {
    const f = buildForecast({
      now,
      currentWeather: w({ condition: "rain", tempF: 60 }),
      traffic: tr(),
      hourly: [],
    });
    expect(f.points).toHaveLength(25);
    // All points should still have valid scores (no NaN, no crash).
    for (const p of f.points) {
      expect(Number.isFinite(p.score)).toBe(true);
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("buildForecast (future startAt)", () => {
  const futureStart = new Date("2026-05-14T12:00:00Z"); // Thu 8am ET
  const hourly: HourlyForecastPoint[] = [
    { timestamp: "2026-05-14T08:00", tempF: 70, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-14T09:00", tempF: 72, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-14T10:00", tempF: 74, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-14T11:00", tempF: 75, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-14T12:00", tempF: 76, condition: "clear", precipitationIn: 0 },
  ];

  it("starts the first point at the supplied startAt", () => {
    const f = buildForecast({ now: futureStart, currentWeather: w(), traffic: tr(), hourly });
    expect(f.points[0].timestamp).toBe(futureStart.toISOString());
  });
  it("walks 30 minutes per step", () => {
    const f = buildForecast({ now: futureStart, currentWeather: w(), traffic: tr(), hourly });
    const delta =
      new Date(f.points[1].timestamp).getTime() - new Date(f.points[0].timestamp).getTime();
    expect(delta).toBe(30 * 60 * 1000);
  });
});
