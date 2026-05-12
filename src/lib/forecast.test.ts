import { describe, expect, it } from "vitest";
import {
  __test__,
  buildForecast,
  FORECAST_POINT_COUNT,
  indexHourly,
  weatherForTimestamp,
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

  it("produces 17 points spanning 4 hours in 15-min steps", () => {
    const f = buildForecast({ now, currentWeather: w(), traffic: tr(), hourly });
    expect(f.points).toHaveLength(FORECAST_POINT_COUNT);
    expect(f.points).toHaveLength(17);
    expect(f.stepMinutes).toBe(15);
    expect(f.windowHours).toBe(4);
  });

  it("timestamps are strictly increasing", () => {
    const f = buildForecast({ now, currentWeather: w(), traffic: tr(), hourly });
    for (let i = 1; i < f.points.length; i++) {
      expect(new Date(f.points[i].timestamp).getTime()).toBeGreaterThan(
        new Date(f.points[i - 1].timestamp).getTime(),
      );
    }
  });

  it("bestTime is the lowest-score point in the window", () => {
    const f = buildForecast({ now, currentWeather: w(), traffic: tr(), hourly });
    const minScore = Math.min(...f.points.map((p) => p.score));
    expect(f.bestTime?.score).toBe(minScore);
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
    expect(f.points).toHaveLength(17);
    // All points should still have valid scores (no NaN, no crash).
    for (const p of f.points) {
      expect(Number.isFinite(p.score)).toBe(true);
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(100);
    }
  });
});
