import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTomTomFlow } from "./tomTom";

beforeEach(() => {
  delete process.env.TOMTOM_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TOMTOM_API_KEY;
});

describe("fetchTomTomFlow", () => {
  it("returns ok:false when key missing", async () => {
    const out = await fetchTomTomFlow();
    expect(out.ok).toBe(false);
    expect(out.speedRatio).toBeNull();
  });

  it("parses kph → mph and computes ratio", async () => {
    process.env.TOMTOM_API_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            flowSegmentData: {
              currentSpeed: 80, // kph
              freeFlowSpeed: 100,
              roadClosure: false,
              confidence: 0.95,
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const out = await fetchTomTomFlow();
    expect(out.ok).toBe(true);
    expect(out.currentSpeedMph).toBeCloseTo(49.7, 1);
    expect(out.freeFlowSpeedMph).toBeCloseTo(62.1, 1);
    expect(out.speedRatio).toBeCloseTo(0.8, 2);
    expect(out.roadClosure).toBe(false);
  });

  it("flags closure", async () => {
    process.env.TOMTOM_API_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            flowSegmentData: {
              currentSpeed: 0,
              freeFlowSpeed: 100,
              roadClosure: true,
              confidence: 1,
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const out = await fetchTomTomFlow();
    expect(out.roadClosure).toBe(true);
    expect(out.speedRatio).toBe(0);
  });

  it("returns ok:false on upstream error", async () => {
    process.env.TOMTOM_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    const out = await fetchTomTomFlow();
    expect(out.ok).toBe(false);
  });
});
