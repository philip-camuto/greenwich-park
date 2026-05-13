import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MTA_WEEKDAY_BASELINE,
  MTA_WEEKEND_BASELINE,
  fetchMetroNorthRidership,
} from "./metroNorth";

afterEach(() => vi.restoreAllMocks());

describe("fetchMetroNorthRidership", () => {
  it("parses Socrata long-format response and uses weekday baseline", async () => {
    // 2026-05-11 is a Monday → weekday baseline.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { date: "2026-05-11T00:00:00.000", count: "230010" },
          ]),
          { status: 200 },
        ),
      ),
    );
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(true);
    expect(out.ridership).toBe(230010);
    expect(out.vsBaseline).toBeCloseTo(230010 / MTA_WEEKDAY_BASELINE, 4);
  });

  it("uses weekend baseline on Saturdays", async () => {
    // 2026-05-09 is a Saturday.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { date: "2026-05-09T00:00:00.000", count: "116969" },
          ]),
          { status: 200 },
        ),
      ),
    );
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(true);
    expect(out.vsBaseline).toBeCloseTo(116969 / MTA_WEEKEND_BASELINE, 4);
  });

  it("returns ok:false on empty array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(false);
  });

  it("returns ok:false on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(false);
  });

  it("returns ok:false when count is not numeric", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([{ date: "2026-05-11T00:00:00.000", count: "n/a" }]),
          { status: 200 },
        ),
      ),
    );
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(false);
  });
});
