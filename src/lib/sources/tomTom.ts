// TomTom Traffic Flow API for Greenwich Avenue / I-95 corridor.
// Free tier: 2500 req/day. We cache 5 minutes via Next data cache.
// Returns currentSpeed vs freeFlowSpeed which gives us a *real* congestion
// ratio — much better than counting CT 511 events.

import { fetchWithTimeout } from "@/lib/utils/fetch";

const ENDPOINT = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json";
const REVALIDATE_SECONDS = 300;
// Pinned to Greenwich Ave / I-95 interchange area.
const POINT_LAT = 41.0262;
const POINT_LON = -73.6282;

export type TomTomFlow = {
  currentSpeedMph: number | null;
  freeFlowSpeedMph: number | null;
  speedRatio: number | null; // currentSpeed / freeFlowSpeed, 0..1+
  roadClosure: boolean;
  confidence: number; // 0..1 from TomTom
  fetchedAt: string;
  ok: boolean;
};

type TomTomResponse = {
  flowSegmentData?: {
    currentSpeed?: number; // km/h
    freeFlowSpeed?: number; // km/h
    roadClosure?: boolean;
    confidence?: number;
  };
};

function kphToMph(kph: number): number {
  return kph * 0.621371;
}

export async function fetchTomTomFlow(): Promise<TomTomFlow> {
  const key = process.env.TOMTOM_API_KEY;
  if (!key) return emptyFlow();
  try {
    const url = `${ENDPOINT}?point=${POINT_LAT},${POINT_LON}&key=${encodeURIComponent(key)}`;
    const res = await fetchWithTimeout(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return emptyFlow();
    const data = (await res.json()) as TomTomResponse;
    const d = data.flowSegmentData;
    if (!d || typeof d.currentSpeed !== "number" || typeof d.freeFlowSpeed !== "number") {
      return emptyFlow();
    }
    const currentMph = kphToMph(d.currentSpeed);
    const freeFlowMph = kphToMph(d.freeFlowSpeed);
    const ratio = freeFlowMph > 0 ? currentMph / freeFlowMph : null;
    return {
      currentSpeedMph: currentMph,
      freeFlowSpeedMph: freeFlowMph,
      speedRatio: ratio,
      roadClosure: d.roadClosure ?? false,
      confidence: d.confidence ?? 1,
      fetchedAt: new Date().toISOString(),
      ok: true,
    };
  } catch (err) {
    console.warn("[tomTom] fetch failed:", err);
    return emptyFlow();
  }
}

function emptyFlow(): TomTomFlow {
  return {
    currentSpeedMph: null,
    freeFlowSpeedMph: null,
    speedRatio: null,
    roadClosure: false,
    confidence: 0,
    fetchedAt: new Date().toISOString(),
    ok: false,
  };
}
