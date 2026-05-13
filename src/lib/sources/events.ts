// Merges Eventbrite + Ticketmaster + Town iCal into a single deduped list
// of SpecialEvent. Used by the heuristic to compute eventMod.

import type { SpecialEvent } from "@/lib/model/types";
import { fetchEventbriteGreenwichEvents } from "./eventbrite";
import { fetchGreenwichTownEvents } from "./townICal";
import { fetchTicketmasterGreenwichEvents } from "./ticketmaster";

function dedupKey(e: SpecialEvent): string {
  return `${e.date}|${e.name.trim().toLowerCase()}`;
}

export async function fetchAggregatedSpecialEvents(): Promise<SpecialEvent[]> {
  const [eb, tm, ical] = await Promise.all([
    fetchEventbriteGreenwichEvents(),
    fetchTicketmasterGreenwichEvents(),
    fetchGreenwichTownEvents(),
  ]);
  // Town iCal first → wins on dedup since it has the highest demandBoost.
  const all = [...ical, ...eb, ...tm];
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

// Used by heuristic: events firing within ±2h of the given timestamp.
const FIRE_WINDOW_MS = 2 * 60 * 60 * 1000;

export function eventsFiringAt(
  events: SpecialEvent[],
  at: Date,
): SpecialEvent[] {
  const t = at.getTime();
  return events.filter((e) => {
    if (!e.startsAt) return e.date === at.toISOString().slice(0, 10);
    const eventT = new Date(e.startsAt).getTime();
    return Math.abs(eventT - t) <= FIRE_WINDOW_MS;
  });
}
