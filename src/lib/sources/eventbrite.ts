// Eventbrite — events near Greenwich CT, next 48 hours.
// Each event maps to a SpecialEvent that the heuristic can boost on when
// firing within the current forecast window.

import type { SpecialEvent } from "@/lib/model/types";
import { fetchWithTimeout } from "@/lib/utils/fetch";

const ENDPOINT = "https://www.eventbriteapi.com/v3/events/search/";
const REVALIDATE_SECONDS = 3600; // events change slowly
const DEFAULT_BOOST = 8;

// Sized so a single big event lands meaningfully but the +20 stack cap in
// heuristic.ts still keeps Eventbrite from drowning out other signals.
export function boostFromCapacity(capacity?: number | null): number {
  if (capacity == null) return DEFAULT_BOOST;
  if (capacity >= 500) return 15;
  if (capacity >= 100) return 10;
  if (capacity >= 20) return 8;
  return 5;
}

export async function fetchEventbriteGreenwichEvents(): Promise<SpecialEvent[]> {
  const key = process.env.EVENTBRITE_API_KEY;
  if (!key) return [];
  try {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      "location.address": "Greenwich, CT",
      "location.within": "5mi",
      "start_date.range_start": now.toISOString().slice(0, 19) + "Z",
      "start_date.range_end": in48h.toISOString().slice(0, 19) + "Z",
      expand: "venue",
    });
    const res = await fetchWithTimeout(`${ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: EventbriteEvent[] };
    return (data.events ?? []).map(eventbriteToSpecial);
  } catch (err) {
    console.warn("[eventbrite] fetch failed:", err);
    return [];
  }
}

type EventbriteEvent = {
  id: string;
  name?: { text?: string };
  start?: { utc?: string };
  url?: string;
  capacity?: number | null;
};

function eventbriteToSpecial(e: EventbriteEvent): SpecialEvent {
  const startsAt = e.start?.utc ?? new Date().toISOString();
  return {
    date: startsAt.slice(0, 10),
    name: e.name?.text ?? "Eventbrite event",
    demandBoost: boostFromCapacity(e.capacity),
    startsAt,
    source: "eventbrite",
    url: e.url,
  };
}
