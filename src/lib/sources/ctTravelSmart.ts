import type {
  TrafficSeverity,
  TrafficSnapshot,
} from "@/lib/model/types";

// CT Travel Smart (CTDOT 511). Only the /event endpoint is exposed on our
// API key — speed sensors and camera endpoints 404. The event feed is rich
// enough to serve as an I-95-near-Greenwich congestion signal:
//
//   - "trafficConditions/Queue" events have lat/lng and an exit range like
//     "between Exits 7 and 24". Greenwich CT sits at Exits 2-5, so any event
//     whose exit range overlaps [1,6] is relevant to Greenwich-bound traffic.
//   - Closures (IsFullClosure=true) and accidents close to our exits are
//     load-bearing for the demand model — closures on I-95 near Greenwich
//     either trap inbound drivers or push them onto local streets.
//
// Rate limit per the PRD: 10 calls/60s. We cache 5 minutes via Next's data
// cache, so each warm region serves ~12 calls/hour worst case.

const BASE = "https://prod-ct.ibi511.com/api/v2/get/event";
const REVALIDATE_SECONDS = 300;

const GREENWICH_LAT = 41.026;
const GREENWICH_LON = -73.628;
const GREENWICH_RADIUS_MI = 6;
// I-95 exits in/around Greenwich CT (Byram=2, Riverside=5, Old Greenwich=5).
// Anything overlapping [1,6] is "near Greenwich" for our purposes.
const GREENWICH_EXIT_MAX = 6;

export type CTEvent = {
  ID: number;
  RoadwayName: string | null;
  DirectionOfTravel: string | null;
  Description: string | null;
  Latitude: number | null;
  Longitude: number | null;
  EventType: string | null;
  EventSubType: string | null;
  IsFullClosure?: boolean | null;
  Reported?: number | null;
};

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLambda / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Parse a description like "I-95 Northbound is congested between Exits 7 and 24"
// and decide whether the exit range overlaps Greenwich exits [1, GREENWICH_EXIT_MAX].
export function exitRangeOverlapsGreenwich(description: string | null | undefined): boolean {
  if (!description) return false;
  const m = description.match(/between\s+Exits?\s+(\d+)\s+and\s+(\d+)/i);
  if (!m) return false;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const lo = Math.min(a, b);
  return lo <= GREENWICH_EXIT_MAX;
}

export function isGreenwichRelevant(event: CTEvent): boolean {
  if (event.RoadwayName !== "I-95") return false;

  // Lat/lng within radius of Greenwich Ave area.
  if (typeof event.Latitude === "number" && typeof event.Longitude === "number") {
    const d = haversineMiles(event.Latitude, event.Longitude, GREENWICH_LAT, GREENWICH_LON);
    if (d <= GREENWICH_RADIUS_MI) return true;
  }

  // Or: an exit-range queue spanning Greenwich exits.
  if (exitRangeOverlapsGreenwich(event.Description)) return true;

  return false;
}

function severityFrom(relevant: number, anyClosure: boolean): TrafficSeverity {
  if (anyClosure || relevant >= 3) return "heavy";
  if (relevant === 2) return "moderate";
  if (relevant === 1) return "light";
  return "none";
}

export async function fetchGreenwichTraffic(): Promise<TrafficSnapshot> {
  const key = process.env.CT_TRAVEL_SMART_API_KEY;
  if (!key) {
    return emptySnapshot();
  }
  try {
    const res = await fetch(`${BASE}?key=${encodeURIComponent(key)}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      // Graceful degradation per PRD risk note (CT API may rate-limit harder
      // than documented). Return zero-signal snapshot rather than throw.
      return emptySnapshot();
    }
    const events = (await res.json()) as CTEvent[];
    return summarize(events);
  } catch {
    return emptySnapshot();
  }
}

export function summarize(events: CTEvent[]): TrafficSnapshot {
  const i95 = events.filter((e) => e.RoadwayName === "I-95");
  const relevant = i95.filter(isGreenwichRelevant);
  const nb = relevant.some((e) => /north/i.test(e.DirectionOfTravel ?? ""));
  const sb = relevant.some((e) => /south/i.test(e.DirectionOfTravel ?? ""));
  const closureNearby = relevant.some((e) => e.IsFullClosure === true);
  return {
    severity: severityFrom(relevant.length, closureNearby),
    greenwichRelevantEvents: relevant.length,
    i95EventsTotal: i95.length,
    northboundAffected: nb,
    southboundAffected: sb,
    closureNearby,
    fetchedAt: new Date().toISOString(),
  };
}

function emptySnapshot(): TrafficSnapshot {
  return {
    severity: "none",
    greenwichRelevantEvents: 0,
    i95EventsTotal: 0,
    northboundAffected: false,
    southboundAffected: false,
    closureNearby: false,
    fetchedAt: new Date().toISOString(),
  };
}
