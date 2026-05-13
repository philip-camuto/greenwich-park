// MTA Daily Ridership dataset on data.ny.gov (Socrata). No key required.
// Endpoint returns systemwide Metro-North daily totals. We use the most
// recent day available as a proxy for "are commuters taking the train".
//
// Higher train ridership → fewer commuters driving in → lower demand on
// downtown Greenwich Ave streets. The inverse is also true.

const ENDPOINT = "https://data.ny.gov/resource/sayj-mze2.json";
const REVALIDATE_SECONDS = 3600; // hourly is plenty — dataset updates daily

export const MTA_WEEKDAY_BASELINE = 120_000; // hand-tuned, pre-pandemic-ish

export type MetroNorthRidership = {
  date: string | null;
  ridership: number | null;
  vsBaseline: number | null; // ratio: ridership / MTA_WEEKDAY_BASELINE
  ok: boolean;
  fetchedAt: string;
};

type SocrataRow = {
  date?: string;
  metro_north_railroad_total_estimated_ridership?: string;
};

export async function fetchMetroNorthRidership(): Promise<MetroNorthRidership> {
  try {
    const url = `${ENDPOINT}?$select=date,metro_north_railroad_total_estimated_ridership&$order=date DESC&$limit=1`;
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return empty();
    const rows = (await res.json()) as SocrataRow[];
    const row = rows[0];
    if (!row) return empty();
    const ridership = Number(row.metro_north_railroad_total_estimated_ridership);
    if (!Number.isFinite(ridership)) return empty();
    return {
      date: row.date ?? null,
      ridership,
      vsBaseline: ridership / MTA_WEEKDAY_BASELINE,
      ok: true,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
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
