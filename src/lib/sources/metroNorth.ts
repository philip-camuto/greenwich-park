import { fetchWithTimeout } from "@/lib/utils/fetch";
import type { MetroNorthInput } from "@/lib/model/types";

// MTA Daily Ridership dataset on data.ny.gov (Socrata). No key required.
// Endpoint returns systemwide daily totals per mode. We filter to mode='MNR'.
//
// Higher train ridership → fewer commuters driving in → lower demand on
// downtown Greenwich Ave streets. The inverse is also true.
//
// Schema note: the dataset was refactored from one-column-per-mode to a
// long-format (date, mode, count) table. The old column name
// `metro_north_railroad_total_estimated_ridership` no longer exists.
//
// ─────────────────────────────────────────────────────────────────────────
// WHY A TRAILING MEDIAN, NOT A FIXED BASELINE
// ─────────────────────────────────────────────────────────────────────────
// This used to divide the latest day by a frozen "pre-pandemic-ish" baseline
// (220k weekday / 110k weekend). Post-pandemic weekday ridership has recovered
// past 220k, so the ratio cleared 1.1 almost every weekday and the modifier
// fired a near-constant −8 — a fixed downward bias, not a signal.
//
// Instead we now pull a trailing window and compute a per-day-of-week median.
// "vsBaseline" then means "ridership vs the recent norm for THIS weekday," so
// the modifier only fires when ridership is genuinely unusual (a strike, a
// heat wave keeping people home, a big NYC draw). The baseline self-calibrates
// as ridership drifts, so it can never get permanently stuck "above" again.
//
//   ┌── data.ny.gov (mode=MNR, last WINDOW_DAYS days, date DESC) ──┐
//   │                                                              │
//   ▼                                                              ▼
//  latest actual day                              group by day-of-week → median
//   │                                                              │
//   └── vsBaseline = latest / medianByDow[latestDow]  (anomaly today)
//       vsBaseline = median / median = 1.0           (prediction for a future day)
//
const ENDPOINT = "https://data.ny.gov/resource/sayj-mze2.json";
const REVALIDATE_SECONDS = 3600; // hourly is plenty — dataset updates daily

// ~120 calendar days yields ~17 samples per day-of-week: enough for a stable
// median while still tracking the current ridership regime.
const WINDOW_DAYS = 120;
// A day-of-week needs at least this many samples in the window before we trust
// its median. Below this the DOW reads "data unavailable" rather than anchoring
// the anomaly comparison on noise.
const MIN_SAMPLES_PER_DOW = 4;

export type MetroNorthRidership = {
  latestDate: string | null;
  latestRidership: number | null;
  // Trailing median ridership keyed by day-of-week (0=Sun..6=Sat). A DOW is
  // absent when it had fewer than MIN_SAMPLES_PER_DOW observations.
  medianByDow: Record<number, number>;
  ok: boolean; // true when the latest day's own DOW has a trusted median
  fetchedAt: string;
};

type SocrataRow = {
  date?: string;
  count?: string;
};

function dowOf(dateIso: string): number {
  return new Date(dateIso).getUTCDay();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export async function fetchMetroNorthRidership(): Promise<MetroNorthRidership> {
  try {
    const url =
      `${ENDPOINT}?$select=date,count` +
      `&$where=mode='MNR'` +
      `&$order=date DESC&$limit=${WINDOW_DAYS}`;
    const res = await fetchWithTimeout(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return empty();
    const rows = (await res.json()) as SocrataRow[];

    // Parse into {date, ridership, dow}, dropping malformed rows.
    const parsed = rows
      .filter((r): r is Required<SocrataRow> => Boolean(r.date) && r.count != null)
      .map((r) => ({ date: r.date, ridership: Number(r.count), dow: dowOf(r.date) }))
      .filter((r) => Number.isFinite(r.ridership));
    if (parsed.length === 0) return empty();

    // Rows come back date DESC, so the first is the latest actual day.
    const latest = parsed[0];

    // Per-DOW trailing medians. Exclude the latest day from its own DOW's
    // median so "is the latest day unusual?" compares it against its peers,
    // not a set that includes the very point being judged.
    const byDow: Record<number, number[]> = {};
    for (const r of parsed) {
      (byDow[r.dow] ??= []).push(r.ridership);
    }
    const medianByDow: Record<number, number> = {};
    for (const [dowKey, vals] of Object.entries(byDow)) {
      const dow = Number(dowKey);
      const peers = dow === latest.dow ? vals.slice(1) : vals;
      if (peers.length >= MIN_SAMPLES_PER_DOW) {
        medianByDow[dow] = median(peers);
      }
    }

    return {
      latestDate: latest.date,
      latestRidership: latest.ridership,
      medianByDow,
      ok: medianByDow[latest.dow] != null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[metroNorth] fetch failed:", err);
    return empty();
  }
}

function empty(): MetroNorthRidership {
  return {
    latestDate: null,
    latestRidership: null,
    medianByDow: {},
    ok: false,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Consumer adapters ──────────────────────────────────────────────────────
// The model eats a flat { ridership, vsBaseline, ok }. These two functions
// derive it for the two contexts that need different anchors.

// Live observation: how unusual is the most recent ACTUAL day vs its own
// day-of-week norm? This is what the "now" panel shows.
export function metroNorthCurrentInput(
  data: MetroNorthRidership,
): MetroNorthInput {
  if (!data.ok || data.latestRidership == null || data.latestDate == null) {
    return { ridership: data.latestRidership, vsBaseline: null, ok: false };
  }
  const med = data.medianByDow[dowOf(data.latestDate)];
  if (med == null || med <= 0) {
    return { ridership: data.latestRidership, vsBaseline: null, ok: false };
  }
  return {
    ridership: data.latestRidership,
    vsBaseline: data.latestRidership / med,
    ok: true,
  };
}

// Future forecast day: the best prediction of ridership IS that weekday's
// trailing median, so vsBaseline = median / median = 1.0 → "typical" →
// modifier 0. We can't forecast an anomaly we have no data for; this fills the
// row honestly instead of carrying today's number forward. ok:false when that
// DOW has no trusted median.
export function metroNorthForecastInput(
  data: MetroNorthRidership,
  targetDow: number,
): MetroNorthInput {
  const med = data.medianByDow[targetDow];
  if (med == null || med <= 0) {
    return { ridership: null, vsBaseline: null, ok: false };
  }
  return { ridership: Math.round(med), vsBaseline: 1.0, ok: true };
}
