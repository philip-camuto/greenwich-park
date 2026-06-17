import { describe, expect, it } from "vitest";
import {
  __test__,
  computeTimeFeatures,
  findSpecialEvent,
  getSpecialEvents,
} from "./timeFeatures";

const {
  nthWeekday,
  lastWeekday,
  easterSunday,
  classifyHoliday,
  isPublicInSession,
  isPrivateInSession,
  computeSchoolStatus,
  localParts,
} = __test__;

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

describe("easterSunday (computus)", () => {
  it("matches known Gregorian Easter dates", () => {
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
    expect(easterSunday(2028)).toEqual({ month: 4, day: 16 });
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
  it("Easter weekend (moveable, computus-derived)", () => {
    // Easter 2026 = Apr 5; Good Friday Apr 3; Holy Saturday Apr 4.
    expect(on(2026, 4, 5)).toEqual({ name: "Easter Sunday", kind: "closure" });
    expect(on(2026, 4, 3)).toEqual({ name: "Good Friday", kind: "observed" });
    expect(on(2026, 4, 4)).toEqual({ name: "Holy Saturday", kind: "none" });
    // A different year to prove the date moves: Easter 2027 = Mar 28.
    expect(on(2027, 3, 28)?.name).toBe("Easter Sunday");
    expect(on(2027, 3, 26)?.name).toBe("Good Friday");
  });
  it("returns null on non-holidays", () => {
    expect(on(2026, 5, 12)).toBeNull();
    expect(on(2026, 3, 15)).toBeNull();
  });
});

describe("isPublicInSession (GPS)", () => {
  function on(year: number, month: number, day: number, weekday: number) {
    return isPublicInSession({ year, month, day, hour: 12, weekday, isoDate: "" });
  }
  it("regular weekdays in session", () => {
    expect(on(2026, 5, 12, 2)).toBe(true); // Tue May 12
    expect(on(2026, 10, 15, 4)).toBe(true); // Thu Oct 15
  });
  it("weekends out", () => {
    expect(on(2026, 5, 9, 6)).toBe(false);
  });
  it("July-Aug summer out", () => {
    expect(on(2026, 7, 15, 3)).toBe(false);
  });
  it("Dec 22+ and Jan 1-2 are out (winter break)", () => {
    expect(on(2026, 12, 24, 4)).toBe(false);
    expect(on(2026, 1, 2, 5)).toBe(false);
  });
  it("Feb break Feb 16-20 is out", () => {
    expect(on(2026, 2, 17, 2)).toBe(false);
  });
  it("April spring break Apr 13-17 is out", () => {
    expect(on(2026, 4, 15, 3)).toBe(false);
  });
});

describe("isPrivateInSession (Brunswick / GCD / etc)", () => {
  function on(year: number, month: number, day: number, weekday: number) {
    return isPrivateInSession({ year, month, day, hour: 12, weekday, isoDate: "" });
  }
  it("regular weekdays in session", () => {
    expect(on(2026, 5, 12, 2)).toBe(true); // Tue May 12
    expect(on(2026, 4, 22, 3)).toBe(true); // Wed Apr 22 (post-spring-break)
  });
  it("ends late May", () => {
    expect(on(2026, 5, 29, 5)).toBe(false); // Fri May 29
    expect(on(2026, 6, 2, 2)).toBe(false); // Tue Jun 2 — private out, public still in
  });
  it("longer winter break than public", () => {
    expect(on(2026, 12, 18, 5)).toBe(false); // Fri Dec 18 — private out, public in
    expect(on(2026, 1, 5, 1)).toBe(false); // Mon Jan 5 — private still on break
  });
  it("2-week March spring break", () => {
    expect(on(2026, 3, 9, 1)).toBe(false);
    expect(on(2026, 3, 16, 1)).toBe(false);
    expect(on(2026, 3, 20, 5)).toBe(false);
  });
  it("no Feb break", () => {
    expect(on(2026, 2, 17, 2)).toBe(true); // Tue Feb 17 — private in, public out
  });
  it("no April break", () => {
    expect(on(2026, 4, 15, 3)).toBe(true); // Wed Apr 15 — private in, public out
  });
});

describe("computeSchoolStatus union/intersection", () => {
  function on(year: number, month: number, day: number, weekday: number) {
    return computeSchoolStatus({ year, month, day, hour: 12, weekday, isoDate: "" });
  }
  it("late May: public in, private out", () => {
    const s = on(2026, 6, 2, 2);
    expect(s.publicInSession).toBe(true);
    expect(s.privateInSession).toBe(false);
    expect(s.anyInSession).toBe(true);
    expect(s.allInSession).toBe(false);
  });
  it("mid March: public in, private on spring break", () => {
    const s = on(2026, 3, 16, 1);
    expect(s.publicInSession).toBe(true);
    expect(s.privateInSession).toBe(false);
    expect(s.allInSession).toBe(false);
  });
  it("regular weekday: both in", () => {
    const s = on(2026, 10, 14, 3);
    expect(s.allInSession).toBe(true);
  });
  it("summer: both out", () => {
    const s = on(2026, 7, 14, 2);
    expect(s.anyInSession).toBe(false);
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
    const t = computeTimeFeatures(et("2026-12-25T17:00:00Z"));
    expect(t.isHoliday).toBe(true);
    expect(t.holidayKind).toBe("closure");
    expect(t.holidayName).toBe("Christmas Day");
  });
  it("flags Thanksgiving", () => {
    const t = computeTimeFeatures(et("2026-11-26T17:00:00Z"));
    expect(t.holidayName).toBe("Thanksgiving");
  });
  it("exposes split school status (public in, private out in late May)", () => {
    const t = computeTimeFeatures(et("2026-06-02T16:00:00Z")); // Tue Jun 2 noon ET
    expect(t.schoolStatus.publicInSession).toBe(true);
    expect(t.schoolStatus.privateInSession).toBe(false);
    expect(t.isSchoolInSession).toBe(false); // mirrors allInSession
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
