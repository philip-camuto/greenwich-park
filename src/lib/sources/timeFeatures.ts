import type {
  HolidayKind,
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

  return null;
}

// Greenwich Public Schools calendar. Approximated — Phase 2 model learns
// from actual observations and corrects whatever this gets wrong.
function isSchoolInSession(p: LocalParts): boolean {
  const { month, day, weekday } = p;
  if (weekday === 0 || weekday === 6) return false; // weekend
  if (month === 7 || month === 8) return false; // summer
  // Winter break: ~Dec 22 - Jan 2.
  if (month === 12 && day >= 22) return false;
  if (month === 1 && day <= 2) return false;
  // February break: third week (Presidents' Day week-ish).
  if (month === 2 && day >= 16 && day <= 22) return false;
  // April break: ~third week.
  if (month === 4 && day >= 13 && day <= 19) return false;
  // Edge weeks: school typically starts after Labor Day, ends mid-late June.
  if (month === 6 && day > 16) return false;
  if (month === 9 && day < 4) return false;
  return true;
}

export function computeTimeFeatures(at: Date = new Date()): TimeFeatures {
  const p = localParts(at);
  const hit = classifyHoliday(p);
  return {
    hour: p.hour,
    dayOfWeek: p.weekday,
    isWeekend: p.weekday === 0 || p.weekday === 6,
    isHoliday: hit !== null,
    holidayKind: hit?.kind ?? "none",
    holidayName: hit?.name ?? null,
    isSchoolInSession: isSchoolInSession(p),
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
  classifyHoliday,
  isSchoolInSession,
};
