import { GREENWICH_TZ } from "@/lib/utils/time";

export type DayParam =
  | { kind: "today" }
  | { kind: "future"; startAt: Date; isoDate: string };

const MAX_FUTURE_DAYS = 7;

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

function eightAmGreenwichOnDate(isoDate: string): Date {
  // Compute the UTC moment that corresponds to 8:00 AM Greenwich-local on
  // the given ISO date. We probe noon UTC, read what hour Greenwich saw at
  // that moment, derive the offset, and translate 8 AM Greenwich back to UTC.
  // Works across EST/EDT without hardcoding.
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
  const utcHour = (8 + offsetHours + 24) % 24;
  const hh = String(utcHour).padStart(2, "0");
  return new Date(`${isoDate}T${hh}:00:00.000Z`);
}

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function parseDayParam(
  raw: string | undefined,
  now: Date = new Date(),
): DayParam {
  if (!raw || raw === "today") return { kind: "today" };

  let isoDate: string;
  if (raw === "tomorrow") {
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
  if (isoDate <= todayISO) return { kind: "today" };

  const max = new Date(`${todayISO}T12:00:00.000Z`);
  max.setUTCDate(max.getUTCDate() + MAX_FUTURE_DAYS);
  const maxISO = greenwichLocalYMD(max);
  if (isoDate > maxISO) return { kind: "today" };

  return { kind: "future", startAt: eightAmGreenwichOnDate(isoDate), isoDate };
}
