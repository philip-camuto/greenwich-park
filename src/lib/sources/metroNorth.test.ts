import { afterEach, describe, expect, it, vi } from "vitest";
import { MTA_WEEKDAY_BASELINE, fetchMetroNorthRidership } from "./metroNorth";

afterEach(() => vi.restoreAllMocks());

describe("fetchMetroNorthRidership", () => {
  it("parses Socrata response and computes vsBaseline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              date: "2026-05-11T00:00:00.000",
              metro_north_railroad_total_estimated_ridership: "144000",
            },
          ]),
          { status: 200 },
        ),
      ),
    );
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(true);
    expect(out.ridership).toBe(144000);
    expect(out.vsBaseline).toBeCloseTo(144000 / MTA_WEEKDAY_BASELINE, 4);
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
});
