import { fetchWithTimeout } from "@/lib/utils/fetch";

// MTA Daily Ridership dataset on data.ny.gov (Socrata). No key required.
// Endpoint returns systemwide daily totals per mode. We filter to mode='MNR'
// and use the most recent day as a proxy for "are commuters taking the train".
//
// Higher train ridership → fewer commuters driving in → lower demand on
// downtown Greenwich Ave streets. The inverse is also true.
//
// Schema note: the dataset was refactored from one-column-per-mode to a
// long-format (date, mode, count) table. The old column name
// `metro_north_railroad_total_estimated_ridership` no longer exists.

const ENDPOINT = "https://data.ny.gov/resource/sayj-mze2.json";
const REVALIDATE_SECONDS = 3600; // hourly is plenty — dataset updates daily

// Pre-pandemic-ish baselines, segmented by weekday vs weekend because the
// two regimes differ ~2x. Comparing Mon's ~230k against a single 120k
// baseline would always trigger the modifier; that's not signal.
export const MTA_WEEKDAY_BASELINE = 220_000;
export const MTA_WEEKEND_BASELINE = 110_000;

export type MetroNorthRidership = {
  date: string | null;
  ridership: number | null;
  vsBaseline: number | null; // ratio: ridership / appropriate baseline
  ok: boolean;
  fetchedAt: string;
};

type SocrataRow = {
  date?: string;
  mode?: string;
  count?: string;
};

function baselineFor(dateIso: string): number {
  const d = new Date(dateIso);
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6 ? MTA_WEEKEND_BASELINE : MTA_WEEKDAY_BASELINE;
}

export async function fetchMetroNorthRidership(): Promise<MetroNorthRidership> {
  try {
    const url =
      `${ENDPOINT}?$select=date,count` +
      `&$where=mode='MNR'` +
      `&$order=date DESC&$limit=1`;
    const res = await fetchWithTimeout(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return empty();
    const rows = (await res.json()) as SocrataRow[];
    const row = rows[0];
    if (!row || !row.date) return empty();
    const ridership = Number(row.count);
    if (!Number.isFinite(ridership)) return empty();
    return {
      date: row.date,
      ridership,
      vsBaseline: ridership / baselineFor(row.date),
      ok: true,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[metroNorth] fetch failed:", err);
    return empty();
  }
}

function empty(): MetroNorthRidership {
  return {
    date: null,
    ridership: null,
    vsBaseline: null,
    ok: false,
    fetchedAt: new Date().toISOString(),
  };
}
