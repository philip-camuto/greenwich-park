import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchMetroNorthRidership,
  metroNorthCurrentInput,
  metroNorthForecastInput,
} from "./metroNorth";

afterEach(() => vi.restoreAllMocks());

// Build a date-DESC daily ridership response (Socrata long format). Weekday
// vs weekend get distinct flat values so per-DOW medians are exact and the
// tests are deterministic. 2026-06-15 is a Monday.
function dailyRows(
  opts: {
    days?: number;
    weekday?: number;
    weekend?: number;
    anchor?: string;
    latestOverride?: number;
  } = {},
): { date: string; count: string }[] {
  const days = opts.days ?? 120;
  const weekday = opts.weekday ?? 250_000;
  const weekend = opts.weekend ?? 120_000;
  const anchor = new Date(`${opts.anchor ?? "2026-06-15"}T00:00:00.000Z`);
  const rows: { date: string; count: string }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() - i);
    const dow = d.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    rows.push({
      date: `${d.toISOString().slice(0, 10)}T00:00:00.000`,
      count: String(isWeekend ? weekend : weekday),
    });
  }
  if (opts.latestOverride != null) rows[0].count = String(opts.latestOverride);
  return rows;
}

function stubFetch(rows: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(rows), { status })),
  );
}

describe("fetchMetroNorthRidership — trailing per-DOW medians", () => {
  it("computes a median for each day-of-week from the window", async () => {
    stubFetch(dailyRows());
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(true);
    // Monday (1) and Saturday (6) land on their flat weekday/weekend values.
    expect(out.medianByDow[1]).toBe(250_000);
    expect(out.medianByDow[6]).toBe(120_000);
    expect(out.latestRidership).toBe(250_000); // anchor Monday
  });

  it("excludes the latest day from its own DOW median", async () => {
    // 5 Mondays, latest is a huge outlier. Peers (excluding latest) =
    // [200k,200k,300k,300k] → median 250k. If the latest were *included* the
    // median would be 300k, so 4.0 (=1M/250k) proves the exclusion.
    const rows = [
      { date: "2026-06-15T00:00:00.000", count: "1000000" },
      { date: "2026-06-08T00:00:00.000", count: "300000" },
      { date: "2026-06-01T00:00:00.000", count: "300000" },
      { date: "2026-05-25T00:00:00.000", count: "200000" },
      { date: "2026-05-18T00:00:00.000", count: "200000" },
    ];
    stubFetch(rows);
    const out = await fetchMetroNorthRidership();
    const cur = metroNorthCurrentInput(out);
    expect(cur.ok).toBe(true);
    expect(cur.vsBaseline).toBeCloseTo(4.0, 4);
  });
});

describe("metroNorthCurrentInput — anomaly vs recent same-DOW norm", () => {
  it("reads typical when the latest day matches its DOW median", async () => {
    stubFetch(dailyRows());
    const cur = metroNorthCurrentInput(await fetchMetroNorthRidership());
    expect(cur.ok).toBe(true);
    expect(cur.vsBaseline).toBeCloseTo(1.0, 4); // 250k / 250k
  });

  it("flags an unusually high latest day", async () => {
    stubFetch(dailyRows({ latestOverride: 320_000 })); // Monday, median 250k
    const cur = metroNorthCurrentInput(await fetchMetroNorthRidership());
    expect(cur.ok).toBe(true);
    expect(cur.vsBaseline).toBeCloseTo(1.28, 2);
    expect(cur.vsBaseline! > 1.1).toBe(true); // → modifier -8, "unusually high"
  });

  it("is ok:false when the window is too sparse to trust a median", async () => {
    // 10 consecutive days → each DOW has < MIN_SAMPLES_PER_DOW samples.
    stubFetch(dailyRows({ days: 10 }));
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(false);
    expect(metroNorthCurrentInput(out).ok).toBe(false);
  });
});

describe("metroNorthForecastInput — predicted typical day", () => {
  it("returns vsBaseline 1.0 (typical) for a DOW with a median", async () => {
    const out = await (async () => {
      stubFetch(dailyRows());
      return fetchMetroNorthRidership();
    })();
    const sat = metroNorthForecastInput(out, 6); // Saturday → weekend median
    expect(sat.ok).toBe(true);
    expect(sat.vsBaseline).toBe(1.0); // median / median → modifier 0
    expect(sat.ridership).toBe(120_000);
  });

  it("returns ok:false for a DOW with no trusted median", async () => {
    stubFetch(dailyRows({ days: 10 }));
    const out = await fetchMetroNorthRidership();
    expect(metroNorthForecastInput(out, 3).ok).toBe(false);
  });
});

describe("fetchMetroNorthRidership — degraded inputs", () => {
  it("returns ok:false on empty array", async () => {
    stubFetch([]);
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(false);
    expect(out.latestRidership).toBeNull();
  });

  it("returns ok:false on non-2xx", async () => {
    stubFetch("err", 500);
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(false);
  });

  it("drops malformed rows but still uses the valid ones", async () => {
    const rows = dailyRows();
    rows[3].count = "n/a"; // one bad row in the middle
    stubFetch(rows);
    const out = await fetchMetroNorthRidership();
    expect(out.ok).toBe(true);
    expect(out.medianByDow[1]).toBe(250_000);
  });
});
