import { describe, expect, it } from "vitest";
import { greenwichMarqueeEvents } from "./greenwichEvents";

// Pull a whole-year window so every recurring event surfaces.
function yearEvents(year: number) {
  return greenwichMarqueeEvents(
    new Date(`${year}-01-01T00:00:00Z`),
    new Date(`${year}-12-31T23:59:59Z`),
  );
}

describe("greenwichMarqueeEvents — recurrence rules", () => {
  const e2026 = yearEvents(2026);
  const byName = (n: string) => e2026.filter((e) => e.name === n);

  it("Greenwich Town Party = Saturday before Memorial Day (May 23 2026)", () => {
    const gtp = byName("Greenwich Town Party");
    expect(gtp).toHaveLength(1);
    expect(gtp[0].date).toBe("2026-05-23");
    expect(gtp[0].demandBoost).toBe(18);
    // Saturday
    expect(new Date(gtp[0].date + "T12:00:00Z").getUTCDay()).toBe(6);
  });

  it("Sidewalk Sale Days = 2nd Thu–Sun of July (Jul 9–12 2026), boost 20", () => {
    const sw = byName("Greenwich Sidewalk Sale Days");
    expect(sw.map((e) => e.date)).toEqual([
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ]);
    expect(sw.every((e) => e.demandBoost === 20)).toBe(true);
    // First day is a Thursday.
    expect(new Date("2026-07-09T12:00:00Z").getUTCDay()).toBe(4);
  });

  it("Farmers Market fires every Saturday across the mid-May→Dec season", () => {
    const mkt = byName("Greenwich Farmers Market");
    expect(mkt.length).toBeGreaterThan(25); // ~30 Saturdays
    // All Saturdays, all in season.
    for (const e of mkt) {
      expect(new Date(e.date + "T12:00:00Z").getUTCDay()).toBe(6);
      const [, m] = e.date.split("-").map(Number);
      expect(m).toBeGreaterThanOrEqual(5);
      expect(m).toBeLessThanOrEqual(12);
    }
    expect(mkt[0].date >= "2026-05-15").toBe(true);
  });

  it("Tree Lighting = a Friday in early December", () => {
    const tl = byName("Town Hall Tree Lighting");
    expect(tl).toHaveLength(1);
    expect(new Date(tl[0].date + "T12:00:00Z").getUTCDay()).toBe(5); // Friday
    expect(tl[0].date.startsWith("2026-12-0")).toBe(true); // first week
  });

  it("every event carries a start/end span", () => {
    for (const e of e2026) {
      expect(e.startsAt).toBeTruthy();
      expect(e.endsAt).toBeTruthy();
      expect(new Date(e.endsAt!).getTime()).toBeGreaterThan(new Date(e.startsAt!).getTime());
    }
  });

  it("only returns events inside the requested window", () => {
    const julyOnly = greenwichMarqueeEvents(
      new Date("2026-07-01T00:00:00Z"),
      new Date("2026-07-31T23:59:59Z"),
    );
    expect(julyOnly.length).toBeGreaterThan(0);
    expect(julyOnly.every((e) => e.date >= "2026-07-01" && e.date <= "2026-07-31")).toBe(true);
    // The May Town Party must not leak into a July window.
    expect(julyOnly.some((e) => e.name === "Greenwich Town Party")).toBe(false);
  });
});
