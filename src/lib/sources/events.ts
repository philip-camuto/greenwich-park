// Merges Eventbrite + Ticketmaster + Town iCal into a single deduped list
// of SpecialEvent. Used by the heuristic to compute eventMod.

import type { SpecialEvent } from "@/lib/model/types";
import { fetchEventbriteGreenwichEvents } from "./eventbrite";
import { fetchGreenwichTownEvents } from "./townICal";
import { fetchTicketmasterGreenwichEvents } from "./ticketmaster";
import { greenwichMarqueeEvents } from "./greenwichEvents";

// How far ahead to generate curated marquee events. Covers the 12h forecast
// window and near-term day navigation.
const MARQUEE_LOOKAHEAD_DAYS = 45;

function dedupKey(e: SpecialEvent): string {
  return `${e.date}|${e.name.trim().toLowerCase()}`;
}

export async function fetchAggregatedSpecialEvents(
  now: Date = new Date(),
): Promise<SpecialEvent[]> {
  const [eb, tm, ical] = await Promise.all([
    fetchEventbriteGreenwichEvents(),
    fetchTicketmasterGreenwichEvents(),
    fetchGreenwichTownEvents(),
  ]);
  const marquee = greenwichMarqueeEvents(
    now,
    new Date(now.getTime() + MARQUEE_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000),
  );
  // Curated marquee events first → they win dedup (highest, locally-verified
  // boosts) over anything a feed happens to also list. Town iCal next.
  const all = [...marquee, ...ical, ...eb, ...tm];
  const seen = new Map<string, SpecialEvent>();
  for (const e of all) {
    const k = dedupKey(e);
    if (!seen.has(k)) seen.set(k, e);
  }
  return Array.from(seen.values()).sort((a, b) => {
    const at = a.startsAt ?? a.date;
    const bt = b.startsAt ?? b.date;
    return at < bt ? -1 : at > bt ? 1 : 0;
  });
}

// Parking pressure builds before an event starts and lingers after it ends,
// so we pad the firing window by this much on each side of the event's span.
const FIRE_WINDOW_MS = 2 * 60 * 60 * 1000;

export function eventsFiringAt(
  events: SpecialEvent[],
  at: Date,
): SpecialEvent[] {
  const t = at.getTime();
  return events.filter((e) => {
    if (!e.startsAt) return e.date === at.toISOString().slice(0, 10);
    const start = new Date(e.startsAt).getTime();
    // Fire across [start, end] plus a pad on each side. A point event (no
    // endsAt) collapses to the old ±window around start. With endsAt set, the
    // event stops firing once it's been over for FIRE_WINDOW_MS — fixing the
    // old bug where a 2-hour event kept firing for hours after it ended.
    const end = e.endsAt ? new Date(e.endsAt).getTime() : start;
    return t >= start - FIRE_WINDOW_MS && t <= end + FIRE_WINDOW_MS;
  });
}
