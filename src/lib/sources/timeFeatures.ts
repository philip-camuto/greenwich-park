import type {
  HolidayKind,
  SchoolStatus,
  SpecialEvent,
  TimeFeatures,
} from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

// All computations are in America/New_York local time. The server runs UTC,
// so naive Date methods would give the wrong hour and (around midnight)
// wrong day of week for the few hours that straddle midnight ET.

type LocalParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  weekday: number; // 0=Sun..6=Sat
  isoDate: string; // YYYY-MM-DD
};

function localParts(at: Date): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(at).map((p) => [p.type, p.value]),
  );
  const year = parseInt(parts.year, 10);
  const month = parseInt(parts.month, 10);
  const day = parseInt(parts.day, 10);
  // hour12:false sometimes yields "24" at midnight depending on engine; normalize.
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[parts.weekday] ?? 0;
  const isoDate = `${parts.year}-${parts.month}-${parts.day}`;
  return { year, month, day, hour, weekday, isoDate };
}

// nth occurrence of a weekday in a month (n is 1-indexed).
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  // Find the first instance of `weekday` in this month, then add 7*(n-1) days.
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}

function lastWeekday(year: number, month: number, weekday: number): number {
  // Find the last day of the month, then walk back to `weekday`.
  const last = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this month
  const lastDay = last.getUTCDate();
  const lastWd = last.getUTCDay();
  const offset = (lastWd - weekday + 7) % 7;
  return lastDay - offset;
}

// Easter Sunday for a Gregorian year (Anonymous Gregorian / Meeus computus).
// Returns 1-indexed month (3=March, 4=April) and day.
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

type HolidayHit = { name: string; kind: HolidayKind };

function classifyHoliday(p: LocalParts): HolidayHit | null {
  const { year, month, day } = p;

  // Fixed-date holidays.
  if (month === 1 && day === 1) return { name: "New Year's Day", kind: "closure" };
  if (month === 6 && day === 19) return { name: "Juneteenth", kind: "observed" };
  if (month === 7 && day === 4) return { name: "Independence Day", kind: "observed" };
  if (month === 11 && day === 11) return { name: "Veterans Day", kind: "observed" };
  if (month === 10 && day === 31) return { name: "Halloween", kind: "observed" };
  if (month === 12 && day === 24) return { name: "Christmas Eve", kind: "retail-spike" };
  if (month === 12 && day === 25) return { name: "Christmas Day", kind: "closure" };
  if (month === 12 && day === 31) return { name: "New Year's Eve", kind: "retail-spike" };

  // Nth-weekday holidays.
  if (month === 1 && day === nthWeekday(year, 1, 1, 3))
    return { name: "MLK Day", kind: "observed" };
  if (month === 2 && day === nthWeekday(year, 2, 1, 3))
    return { name: "Presidents' Day", kind: "observed" };
  if (month === 5 && day === nthWeekday(year, 5, 0, 2))
    return { name: "Mother's Day", kind: "retail-spike" };
  if (month === 5 && day === lastWeekday(year, 5, 1))
    return { name: "Memorial Day", kind: "retail-spike" };
  if (month === 6 && day === nthWeekday(year, 6, 0, 3))
    return { name: "Father's Day", kind: "retail-spike" };
  if (month === 9 && day === nthWeekday(year, 9, 1, 1))
    return { name: "Labor Day", kind: "observed" };
  if (month === 10 && day === nthWeekday(year, 10, 1, 2))
    return { name: "Columbus Day", kind: "observed" };

  // Thanksgiving + Black Friday.
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  if (month === 11 && day === thanksgiving)
    return { name: "Thanksgiving", kind: "closure" };
  if (month === 11 && day === thanksgiving + 1)
    return { name: "Black Friday", kind: "retail-spike" };

  // Easter weekend (moveable feast; Gregorian computus). The Ave is largely
  // shut Easter Sunday (boutiques + restaurants closed) — closure caps it to
  // the quiet floor instead of the normal-busy Sunday base. Good Friday lands
  // in the enforcement window: markets/most schools closed but shops open, so
  // a mild "observed" bump, not a closure. Holy Saturday is named but neutral —
  // the already-high Saturday base captures Easter-eve shopping. The Good
  // Friday / Holy Saturday calls are local-knowledge estimates, owner-tunable.
  const easter = easterSunday(year);
  const easterUTC = Date.UTC(year, easter.month - 1, easter.day);
  const goodFriday = new Date(easterUTC - 2 * 86_400_000);
  const holySaturday = new Date(easterUTC - 1 * 86_400_000);
  if (month === easter.month && day === easter.day)
    return { name: "Easter Sunday", kind: "closure" };
  if (month === goodFriday.getUTCMonth() + 1 && day === goodFriday.getUTCDate())
    return { name: "Good Friday", kind: "observed" };
  if (
    month === holySaturday.getUTCMonth() + 1 &&
    day === holySaturday.getUTCDate()
  )
    return { name: "Holy Saturday", kind: "none" };

  return null;
}

// Greenwich Public Schools calendar. Approximated — Phase 2 model learns
// from actual observations and corrects whatever this gets wrong.
function isPublicInSession(p: LocalParts): boolean {
  const { month, day, weekday } = p;
  if (weekday === 0 || weekday === 6) return false;
  if (month === 7 || month === 8) return false; // summer
  if (month === 12 && day >= 22) return false; // winter break starts
  if (month === 1 && day <= 2) return false; // winter break ends
  if (month === 2 && day >= 16 && day <= 20) return false; // Feb break
  if (month === 4 && day >= 13 && day <= 17) return false; // April spring break
  if (month === 6 && day > 16) return false; // end of year
  if (month === 9 && day < 4) return false; // starts after Labor Day
  return true;
}

// Private K-12 schools in Greenwich: Brunswick, Greenwich Country Day,
// Greenwich Academy, Sacred Heart, Whitby. Their calendars are remarkably
// aligned with each other and differ from GPS in three known ways:
//   - winter break runs longer (~Dec 18 to early Jan)
//   - long spring break in early/mid March (no Feb break of note)
//   - school year wraps in late May, ~3 weeks earlier than GPS
function isPrivateInSession(p: LocalParts): boolean {
  const { month, day, weekday } = p;
  if (weekday === 0 || weekday === 6) return false;
  if (month === 6 || month === 7 || month === 8) return false; // summer (private out all June)
  if (month === 5 && day >= 29) return false; // private school year ends ~May 28
  if (month === 9 && day < 8) return false; // private start ~week after Labor Day
  if (month === 12 && day >= 18) return false; // longer winter break
  if (month === 1 && day <= 5) return false;
  if (month === 3 && day >= 9 && day <= 22) return false; // 2-week spring break
  // No Feb break for private schools (Presidents' Day Monday is the only day off).
  return true;
}

function computeSchoolStatus(p: LocalParts): SchoolStatus {
  const publicInSession = isPublicInSession(p);
  const privateInSession = isPrivateInSession(p);
  return {
    publicInSession,
    privateInSession,
    anyInSession: publicInSession || privateInSession,
    allInSession: publicInSession && privateInSession,
  };
}

export function computeTimeFeatures(at: Date = new Date()): TimeFeatures {
  const p = localParts(at);
  const hit = classifyHoliday(p);
  const schoolStatus = computeSchoolStatus(p);
  return {
    hour: p.hour,
    dayOfWeek: p.weekday,
    isWeekend: p.weekday === 0 || p.weekday === 6,
    isHoliday: hit !== null,
    holidayKind: hit?.kind ?? "none",
    holidayName: hit?.name ?? null,
    schoolStatus,
    isSchoolInSession: schoolStatus.allInSession,
    localDate: p.isoDate,
  };
}

// Special events that boost demand (RTM nights, Greenwich Ave events, etc).
// Phase 1: empty list, manually added later. Phase 2: pulled from a managed list.
export function getSpecialEvents(): SpecialEvent[] {
  return [];
}

export function findSpecialEvent(date: string, events = getSpecialEvents()): SpecialEvent | null {
  return events.find((e) => e.date === date) ?? null;
}

// Exported for tests.
export const __test__ = {
  localParts,
  nthWeekday,
  lastWeekday,
  easterSunday,
  classifyHoliday,
  isPublicInSession,
  isPrivateInSession,
  computeSchoolStatus,
};
