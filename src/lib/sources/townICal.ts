// Greenwich Town iCal feed — civic events from the town calendar.
// catID=14 is the confirmed feed slug (verified via curl 2026-05-12).
// These are town events: parades, holiday lightings, RTM meetings, etc.
// Higher demand boost than commercial events because most directly affect
// downtown Greenwich Ave traffic.

import ical from "ical";
import type { SpecialEvent } from "@/lib/model/types";

const ICAL_URL =
  "https://www.greenwichct.gov/common/modules/iCalendar/iCalendar.aspx?catID=14&feed=calendar";
const REVALIDATE_SECONDS = 3600;
const TOWN_EVENT_BOOST = 12;
const WINDOW_HOURS = 48;

export async function fetchGreenwichTownEvents(): Promise<SpecialEvent[]> {
  try {
    const res = await fetch(ICAL_URL, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return [];
    const text = await res.text();
    const parsed = ical.parseICS(text);
    const now = Date.now();
    const horizon = now + WINDOW_HOURS * 60 * 60 * 1000;
    const events: SpecialEvent[] = [];
    for (const k of Object.keys(parsed)) {
      const c = parsed[k];
      if (!c || c.type !== "VEVENT") continue;
      const start = c.start instanceof Date ? c.start : new Date(c.start as unknown as string);
      const startMs = start.getTime();
      if (!Number.isFinite(startMs)) continue;
      if (startMs < now || startMs > horizon) continue;
      const summary = (c.summary as string | undefined) ?? "Town event";
      const iso = start.toISOString();
      events.push({
        date: iso.slice(0, 10),
        name: summary,
        demandBoost: TOWN_EVENT_BOOST,
        startsAt: iso,
        source: "town-ical",
      });
    }
    return events;
  } catch {
    return [];
  }
}
