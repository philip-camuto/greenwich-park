import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __test__,
  fetchGreenwichHourlyForecast,
  fetchGreenwichWeather,
} from "./openWeather";

const { codeToCondition, buildUrl } = __test__;

afterEach(() => vi.restoreAllMocks());

describe("codeToCondition (WMO)", () => {
  it("maps 0 to clear", () => {
    expect(codeToCondition(0)).toBe("clear");
  });
  it("maps 1-3 to cloudy", () => {
    expect(codeToCondition(1)).toBe("cloudy");
    expect(codeToCondition(2)).toBe("cloudy");
    expect(codeToCondition(3)).toBe("cloudy");
  });
  it("maps 45/48 to fog", () => {
    expect(codeToCondition(45)).toBe("fog");
    expect(codeToCondition(48)).toBe("fog");
  });
  it("maps drizzle/rain codes to rain", () => {
    expect(codeToCondition(51)).toBe("rain");
    expect(codeToCondition(63)).toBe("rain");
    expect(codeToCondition(80)).toBe("rain");
  });
  it("maps snow codes to snow", () => {
    expect(codeToCondition(71)).toBe("snow");
    expect(codeToCondition(86)).toBe("snow");
  });
  it("maps 95+ to thunderstorm", () => {
    expect(codeToCondition(95)).toBe("thunderstorm");
    expect(codeToCondition(99)).toBe("thunderstorm");
  });
});

describe("buildUrl", () => {
  it("uses Greenwich coordinates and imperial units", () => {
    const url = buildUrl();
    expect(url).toContain("latitude=41.0262");
    expect(url).toContain("longitude=-73.6282");
    expect(url).toContain("temperature_unit=fahrenheit");
    expect(url).toContain("wind_speed_unit=mph");
    expect(url).toContain("timezone=America%2FNew_York");
  });
  it("adds hourly fields only when requested", () => {
    expect(buildUrl(false)).not.toContain("hourly=");
    expect(buildUrl(true)).toContain("hourly=temperature_2m");
  });
});

describe("fetchGreenwichWeather", () => {
  it("maps Open-Meteo current to WeatherSnapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            current: {
              time: "2026-05-12T16:00",
              temperature_2m: 63.8,
              precipitation: 0,
              weather_code: 0,
              wind_speed_10m: 5.7,
              is_day: 1,
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const w = await fetchGreenwichWeather();
    expect(w.tempF).toBe(63.8);
    expect(w.condition).toBe("clear");
    expect(w.isDay).toBe(true);
    expect(w.windMph).toBe(5.7);
  });

  it("returns ok:false snapshot on non-2xx (graceful degradation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream", { status: 503 })),
    );
    const w = await fetchGreenwichWeather();
    expect(w.ok).toBe(false);
    expect(w.condition).toBe("unknown");
  });
});

describe("fetchGreenwichHourlyForecast", () => {
  it("expands the hourly arrays into points", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            hourly: {
              time: ["2026-05-12T00:00", "2026-05-12T01:00"],
              temperature_2m: [50, 51],
              precipitation: [0, 0.01],
              weather_code: [0, 61],
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const points = await fetchGreenwichHourlyForecast();
    expect(points).toHaveLength(2);
    expect(points[0].condition).toBe("clear");
    expect(points[1].condition).toBe("rain");
    expect(points[1].precipitationIn).toBe(0.01);
  });

  it("returns [] if hourly missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );
    expect(await fetchGreenwichHourlyForecast()).toEqual([]);
  });
});
