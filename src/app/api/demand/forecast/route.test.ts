import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buildForecastForGreenwich = vi.fn();
vi.mock("@/lib/forecast", () => ({
  buildForecastForGreenwich: (...a: unknown[]) => buildForecastForGreenwich(...a),
}));

import { GET } from "./route";

const sampleForecast = {
  generatedAt: "2026-06-18T12:00:00.000Z",
  windowHours: 12,
  stepMinutes: 30,
  points: [
    {
      timestamp: "2026-06-18T12:00:00.000Z",
      localHour: 8,
      localDate: "2026-06-18",
      score: 40,
      category: "green",
    },
  ],
  bestTime: { timestamp: "2026-06-18T12:00:00.000Z", localHour: 8, score: 40 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/demand/forecast", () => {
  it("returns the forecast payload and a 5-minute cache header", async () => {
    buildForecastForGreenwich.mockResolvedValue(sampleForecast);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.windowHours).toBe(12);
    expect(body.stepMinutes).toBe(30);
    expect(body.points).toHaveLength(1);
    expect(body.bestTime.localHour).toBe(8);
    expect(res.headers.get("Cache-Control")).toMatch(/s-maxage=300/);
  });

  it("500 with the error message when forecast build throws", async () => {
    buildForecastForGreenwich.mockRejectedValue(new Error("openmeteo down"));
    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "openmeteo down" });
  });

  it("falls back to a generic message for non-Error throws", async () => {
    buildForecastForGreenwich.mockRejectedValue("boom");
    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "forecast_unavailable" });
  });
});
