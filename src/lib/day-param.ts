import { GREENWICH_TZ } from "@/lib/utils/time";

export type DayParam =
  | { kind: "today" }
  | { kind: "future"; startAt: Date; isoDate: string; time?: string };
// Date navigation is unbounded both directions. Past dates fall back to the
// base-prior model with no live signals (weather/traffic/etc are not
// time-machine APIs); far-future dates outside Open-Meteo's 7-day window
// gracefully drop the hourly weather to current snapshot, which is fine.

function greenwichLocalYMD(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: GREENWICH_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Active-hours window for the *default* anchor when a future day is picked
// with no explicit time. Switching days asks "what's it like at the time I'd
// actually go", so we anchor to the current Greenwich hour rather than a flat
// 8am — but clamp into retail/enforcement hours so a 2am or 11pm "now" doesn't
// headline that day with a dead overnight slot or run the 12h window past
// midnight.
const ACTIVE_HOUR_START = 8;
const ACTIVE_HOUR_END = 18;

function greenwichLocalHour(at: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(at)
    .find((p) => p.type === "hour")?.value;
  const n = parseInt(hour ?? "8", 10);
  return n === 24 ? 0 : n;
}

function defaultAnchorTime(now: Date): string {
  const clamped = Math.min(
    ACTIVE_HOUR_END,
    Math.max(ACTIVE_HOUR_START, greenwichLocalHour(now)),
  );
  return `${String(clamped).padStart(2, "0")}:00`;
}

function greenwichLocalTimeOnDate(isoDate: string, time: string): Date {
  // Compute the UTC moment that corresponds to a Greenwich-local clock time.
  // We probe early afternoon UTC, read the local hour, derive the UTC offset,
  // and let Date.UTC handle day rollover for late evening local times.
  const probe = new Date(`${isoDate}T13:00:00.000Z`); // noon UTC-ish
  const localHourAtProbe = new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(probe)
    .find((p) => p.type === "hour")?.value;
  const localHour = parseInt(localHourAtProbe ?? "9", 10);
  const offsetHours = 13 - localHour; // UTC - local
  const [requestedHour, requestedMinute] = time.split(":").map((x) => parseInt(x, 10));
  const [year, month, day] = isoDate.split("-").map((x) => parseInt(x, 10));
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      requestedHour + offsetHours,
      requestedMinute || 0,
      0,
      0,
    ),
  );
}

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

function isValidTime(s: string | undefined): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function parseDayParam(
  raw: string | undefined,
  now: Date = new Date(),
  timeRaw?: string,
): DayParam {
  const requestedTime = isValidTime(timeRaw) ? timeRaw : undefined;
  if ((!raw || raw === "today") && !requestedTime) return { kind: "today" };

  let isoDate: string;
  if (!raw || raw === "today") {
    isoDate = greenwichLocalYMD(now);
  } else if (raw === "tomorrow") {
    const todayISO = greenwichLocalYMD(now);
    const d = new Date(`${todayISO}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    isoDate = greenwichLocalYMD(d);
  } else if (isValidIsoDate(raw)) {
    isoDate = raw;
  } else {
    return { kind: "today" };
  }

  const todayISO = greenwichLocalYMD(now);
  // "today" with no specified time renders the live observation, not a forecast.
  if (isoDate === todayISO && !requestedTime) return { kind: "today" };

  const startAt = requestedTime
    ? greenwichLocalTimeOnDate(isoDate, requestedTime)
    : greenwichLocalTimeOnDate(isoDate, defaultAnchorTime(now));
  if (isoDate === todayISO && startAt.getTime() <= now.getTime()) {
    return { kind: "today" };
  }
  return { kind: "future", startAt, isoDate, time: requestedTime };
}
