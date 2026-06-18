import { describe, expect, it } from "vitest";
import { buildForecast } from "./forecast";
import { breakdownViewFromForecastPoint } from "./breakdown-view";
import type { MetroNorthRidership } from "./sources/metroNorth";
import type { TrafficSnapshot, WeatherSnapshot } from "./model/types";
import type { HourlyForecastPoint } from "./sources/openWeather";

const MTA_DATA: MetroNorthRidership = {
  latestDate: "2026-06-15T00:00:00.000",
  latestRidership: 250_000,
  medianByDow: { 0: 120_000, 1: 250_000, 2: 250_000, 3: 250_000, 4: 250_000, 5: 250_000, 6: 120_000 },
  ok: true,
  fetchedAt: "2026-06-15T12:00:00Z",
};

function w(over: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    tempF: 70, condition: "clear", precipitationIn: 0, windMph: 5,
    isDay: true, fetchedAt: "2026-05-09T16:00:00Z", ok: true, ...over,
  };
}
function tr(over: Partial<TrafficSnapshot> = {}): TrafficSnapshot {
  return {
    severity: "none", greenwichRelevantEvents: 0, i95EventsTotal: 0,
    northboundAffected: false, southboundAffected: false, closureNearby: false,
    fetchedAt: "2026-05-09T16:00:00Z", ok: true, ...over,
  };
}

const now = new Date("2026-05-09T16:00:00Z");
const hourly: HourlyForecastPoint[] = [
  { timestamp: "2026-05-09T12:00", tempF: 75, condition: "clear", precipitationIn: 0 },
];

describe("breakdown-view — forecast reasons", () => {
  it("renders predicted ridership as 'typical ridership', not 'data unavailable'", () => {
    const f = buildForecast({ now, currentWeather: w(), traffic: tr(), hourly, metroNorthData: MTA_DATA });
    const view = breakdownViewFromForecastPoint(f.points[5])!;
    const mta = view.rows.find((r) => r.label === "Metro-North ridership")!;
    expect(mta.reason).toBe("typical ridership");
    expect(mta.mod).toBe(0);
  });

  it("labels projected future traffic as '(projected)' with no score impact", () => {
    const projected = tr({ ok: false, projected: true, speedRatio: 1.0, tomTomOk: false });
    const f = buildForecast({ now, currentWeather: w(), traffic: projected, hourly });
    const view = breakdownViewFromForecastPoint(f.points[6])!;
    const traffic = view.rows.find((r) => r.label === "Traffic")!;
    expect(traffic.reason).toContain("(projected)");
    expect(traffic.reason).not.toBe("data unavailable");
    expect(traffic.mod).toBe(0);
  });
});
