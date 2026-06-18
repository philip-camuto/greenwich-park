// Curated Greenwich anchor events — the marquee local days that pack downtown
// and Greenwich Avenue. These do NOT come from any feed: the Town civic iCal
// (catID=14) is meetings-only, and the Chamber-run events (Sidewalk Sales)
// appear in no public API. So we compute them from recurrence rules.
//
// Tiers map to demandBoost (heuristic caps stacked eventMod at +20):
//   HUGE_AVE 20 — packs the Avenue itself (Sidewalk Sales)
//   HUGE     18 — fills downtown lots, street closures (Town Party)
//   LARGE    12 — big downtown-adjacent draw (Wine+Food, Art reception)
//   MODERATE  6 — recurring/brief but eats downtown parking (Farmers Market,
//                 Tree Lighting)
//
// Each event carries a Greenwich-local start/end span so eventsFiringAt lights
// it up across its hours, not just a point in time.
//
// Sources / recurrence confirmed June 2026: GTP = Sat before last Mon of May
// (May 23 2026); Sidewalk Sales = 2nd Thu–Sun of July (Jul 9–12 2026);
// Farmers Market = Saturdays ~mid-May→Dec at the Horseneck/Arch St lot.

import type { SpecialEvent } from "@/lib/model/types";
import { nthWeekday, lastWeekday } from "./timeFeatures";
import { greenwichLocalTimeOnDate } from "@/lib/day-param";

const HUGE_AVE = 20;
const HUGE = 18;
const LARGE = 12;
const MODERATE = 6;

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// First date on or after (month, day) that lands on `weekday` (0=Sun..6=Sat).
function firstWeekdayOnOrAfter(
  year: number,
  month: number,
  day: number,
  weekday: number,
): string {
  const start = new Date(Date.UTC(year, month - 1, day));
  const offset = (weekday - start.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

function span(
  date: string,
  startLocal: string,
  endLocal: string,
  name: string,
  demandBoost: number,
): SpecialEvent {
  return {
    date,
    name,
    demandBoost,
    startsAt: greenwichLocalTimeOnDate(date, startLocal).toISOString(),
    endsAt: greenwichLocalTimeOnDate(date, endLocal).toISOString(),
    source: "manual",
  };
}

// All marquee anchor events for a single calendar year.
function eventsForYear(year: number): SpecialEvent[] {
  const out: SpecialEvent[] = [];

  // Greenwich Town Party — Saturday before the last Monday (Memorial Day) of May.
  // Roger Sherman Baldwin Park, ~0.3mi from the Ave; Arch St closes, lots fill.
  {
    const memorialMonday = lastWeekday(year, 5, 1);
    const d = isoDate(year, 5, memorialMonday - 2); // the Saturday before
    out.push(span(d, "12:00", "23:00", "Greenwich Town Party", HUGE));
  }

  // Greenwich Sidewalk Sale Days — second Thursday of July through Sunday.
  // ON Greenwich Avenue, all four days. The owner's "most packed ever."
  {
    const thursday = nthWeekday(year, 7, 4, 2);
    const first = isoDate(year, 7, thursday);
    for (let i = 0; i < 4; i++) {
      const d = addDaysIso(first, i);
      out.push(span(d, "09:00", "18:00", "Greenwich Sidewalk Sale Days", HUGE_AVE));
    }
  }

  // Art to the Avenue — opening reception, first Thursday evening in May.
  // (The month-long ambient run is intentionally not modeled: too diffuse to
  // separate from the base, and it would over-fire every May evening.)
  {
    const d = isoDate(year, 5, nthWeekday(year, 5, 4, 1));
    out.push(span(d, "17:00", "21:00", "Art to the Avenue (opening)", LARGE));
  }

  // Greenwich Wine + Food Festival — late September, Fri + Sat at Roger Sherman
  // Baldwin Park. Date drifts year to year (Sept↔early Oct) — VERIFY ANNUALLY.
  // Approximated as the last Friday/Saturday of September.
  {
    const lastSat = lastWeekday(year, 9, 6);
    const sat = isoDate(year, 9, lastSat);
    const fri = addDaysIso(sat, -1);
    out.push(span(fri, "17:00", "22:00", "Greenwich Wine + Food Festival", LARGE));
    out.push(span(sat, "12:00", "22:00", "Greenwich Wine + Food Festival", LARGE));
  }

  // Greenwich Farmers Market — Saturdays 9:30–13:00, ~mid-May through December.
  // Occupies the Horseneck/Arch St commuter lot, a primary downtown parking lot.
  {
    let d = firstWeekdayOnOrAfter(year, 5, 15, 6); // first Saturday on/after May 15
    const seasonEnd = isoDate(year, 12, 20);
    while (d <= seasonEnd) {
      out.push(span(d, "09:30", "13:00", "Greenwich Farmers Market", MODERATE));
      d = addDaysIso(d, 7);
    }
  }

  // Town Hall Tree Lighting — a Friday in early December, ~4–5pm (first Friday
  // is a good approximation; e.g. Dec 6 2024, Dec 5 2025).
  {
    const d = isoDate(year, 12, nthWeekday(year, 12, 5, 1));
    out.push(span(d, "16:00", "18:00", "Town Hall Tree Lighting", MODERATE));
  }

  return out;
}

// Marquee Greenwich events whose date falls in [from, to] (inclusive, by UTC
// calendar date). Spans years at the boundary so a late-December query still
// sees early-January-adjacent events if any are added later.
export function greenwichMarqueeEvents(from: Date, to: Date): SpecialEvent[] {
  const fromIso = from.toISOString().slice(0, 10);
  const toIso = to.toISOString().slice(0, 10);
  const years = new Set<number>([from.getUTCFullYear(), to.getUTCFullYear()]);
  const all: SpecialEvent[] = [];
  for (const y of years) all.push(...eventsForYear(y));
  return all
    .filter((e) => e.date >= fromIso && e.date <= toIso)
    .sort((a, b) => {
      const at = a.startsAt ?? a.date;
      const bt = b.startsAt ?? b.date;
      return at < bt ? -1 : at > bt ? 1 : 0;
    });
}
