import { describe, expect, it } from "vitest";
import {
  __test__,
  computeTimeFeatures,
  findSpecialEvent,
  getSpecialEvents,
} from "./timeFeatures";

const { nthWeekday, lastWeekday, classifyHoliday, isSchoolInSession, localParts } =
  __test__;

// Build a Date for an exact moment in Greenwich (America/New_York) time.
// May-Nov is EDT (UTC-4); Nov-Mar is EST (UTC-5). Use ISO with offset to be safe.
function et(iso: string): Date {
  return new Date(iso);
}

describe("localParts (America/New_York)", () => {
  it("returns Greenwich local hour even when UTC is on a different day", () => {
    // 2026-05-13 03:30 UTC is 2026-05-12 23:30 ET (EDT=UTC-4).
    const p = localParts(et("2026-05-13T03:30:00Z"));
    expect(p.year).toBe(2026);
    expect(p.month).toBe(5);
    expect(p.day).toBe(12);
    expect(p.hour).toBe(23);
  });
  it("Saturday weekday=6, Sunday=0", () => {
    // 2026-05-09 12:00 ET is a Saturday.
    expect(localParts(et("2026-05-09T16:00:00Z")).weekday).toBe(6);
    expect(localParts(et("2026-05-10T16:00:00Z")).weekday).toBe(0);
  });
});

describe("nthWeekday / lastWeekday", () => {
  it("MLK Day 2026 = 3rd Monday Jan = Jan 19", () => {
    expect(nthWeekday(2026, 1, 1, 3)).toBe(19);
  });
  it("Memorial Day 2026 = last Monday May = May 25", () => {
    expect(lastWeekday(2026, 5, 1)).toBe(25);
  });
  it("Thanksgiving 2026 = 4th Thursday Nov = Nov 26", () => {
    expect(nthWeekday(2026, 11, 4, 4)).toBe(26);
  });
  it("Labor Day 2026 = 1st Monday Sep = Sep 7", () => {
    expect(nthWeekday(2026, 9, 1, 1)).toBe(7);
  });
});

describe("classifyHoliday", () => {
  function on(year: number, month: number, day: number) {
    return classifyHoliday({ year, month, day, hour: 12, weekday: 0, isoDate: "" });
  }
  it("fixed-date holidays", () => {
    expect(on(2026, 1, 1)?.name).toBe("New Year's Day");
    expect(on(2026, 7, 4)?.name).toBe("Independence Day");
    expect(on(2026, 12, 25)?.kind).toBe("closure");
    expect(on(2026, 12, 24)?.kind).toBe("retail-spike");
  });
  it("movable holidays", () => {
    expect(on(2026, 11, 26)?.name).toBe("Thanksgiving");
    expect(on(2026, 11, 27)?.name).toBe("Black Friday");
    expect(on(2026, 5, 25)?.name).toBe("Memorial Day");
    expect(on(2026, 5, 10)?.name).toBe("Mother's Day");
    expect(on(2026, 6, 21)?.name).toBe("Father's Day");
  });
  it("returns null on non-holidays", () => {
    expect(on(2026, 5, 12)).toBeNull();
    expect(on(2026, 3, 15)).toBeNull();
  });
});

describe("isSchoolInSession", () => {
  function on(year: number, month: number, day: number, weekday: number) {
    return isSchoolInSession({ year, month, day, hour: 12, weekday, isoDate: "" });
  }
  it("weekdays during school year are in session", () => {
    expect(on(2026, 5, 12, 2)).toBe(true); // Tue May 12
    expect(on(2026, 10, 15, 4)).toBe(true); // Thu Oct 15
  });
  it("weekends are out", () => {
    expect(on(2026, 5, 9, 6)).toBe(false);
    expect(on(2026, 5, 10, 0)).toBe(false);
  });
  it("summer is out", () => {
    expect(on(2026, 7, 15, 3)).toBe(false);
    expect(on(2026, 8, 5, 3)).toBe(false);
  });
  it("winter break is out", () => {
    expect(on(2026, 12, 24, 4)).toBe(false);
    expect(on(2026, 1, 2, 5)).toBe(false);
  });
});

describe("computeTimeFeatures", () => {
  it("returns full feature object", () => {
    const t = computeTimeFeatures(et("2026-05-09T18:00:00Z")); // Sat 2pm ET
    expect(t.dayOfWeek).toBe(6);
    expect(t.hour).toBe(14);
    expect(t.isWeekend).toBe(true);
    expect(t.isHoliday).toBe(false);
    expect(t.holidayKind).toBe("none");
    expect(t.holidayName).toBeNull();
  });
  it("flags Christmas Day", () => {
    const t = computeTimeFeatures(et("2026-12-25T17:00:00Z")); // noon ET
    expect(t.isHoliday).toBe(true);
    expect(t.holidayKind).toBe("closure");
    expect(t.holidayName).toBe("Christmas Day");
  });
  it("flags Thanksgiving", () => {
    const t = computeTimeFeatures(et("2026-11-26T17:00:00Z")); // noon ET
    expect(t.holidayName).toBe("Thanksgiving");
  });
});

describe("special events", () => {
  it("starts empty", () => {
    expect(getSpecialEvents()).toEqual([]);
  });
  it("findSpecialEvent returns null when none match", () => {
    expect(findSpecialEvent("2026-05-12")).toBeNull();
  });
  it("findSpecialEvent finds matching event from list", () => {
    const events = [
      { date: "2026-05-12", name: "Greenwich Ave Fair", demandBoost: 15 },
    ];
    expect(findSpecialEvent("2026-05-12", events)?.demandBoost).toBe(15);
  });
});
