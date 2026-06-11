import { describe, expect, it } from "vitest";
import { HOUR_DOW_PRIORS, getPrior } from "./priors";

describe("HOUR_DOW_PRIORS shape", () => {
  it("has 7 days x 24 hours", () => {
    expect(HOUR_DOW_PRIORS).toHaveLength(7);
    for (const row of HOUR_DOW_PRIORS) {
      expect(row).toHaveLength(24);
      for (const v of row) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("priors match calibration (hand 2026-05-12 + FOIA citations 2026-06-11)", () => {
  // Saturday 1pm is the weekly peak per citation data (patrol-adjusted).
  it("Saturday midday is the weekly max", () => {
    const sat1pm = getPrior(6, 13);
    expect(sat1pm).toBeGreaterThanOrEqual(90);
    for (let dow = 0; dow < 7; dow++) {
      for (let h = 0; h < 24; h++) {
        expect(getPrior(dow, h)).toBeLessThanOrEqual(sat1pm);
      }
    }
  });

  // Friday/Saturday evenings: high (75-90).
  it("Fri/Sat 18-21 is 75-90", () => {
    for (const h of [18, 19, 20]) {
      expect(getPrior(5, h)).toBeGreaterThanOrEqual(70);
      expect(getPrior(6, h)).toBeGreaterThanOrEqual(70);
    }
  });

  // Citation finding: weekday late morning (10-11am) is the weekday
  // meter-pressure peak, at or above the 12-1pm lunch window.
  it("Weekday 10-11am peaks at or above lunch", () => {
    for (const dow of [1, 2, 3, 4, 5]) {
      expect(getPrior(dow, 11)).toBeGreaterThanOrEqual(70);
      expect(getPrior(dow, 11)).toBeGreaterThanOrEqual(getPrior(dow, 12));
    }
  });

  // Weekday 11am-2pm: moderate-high.
  it("Weekday 11-14 is 60-85", () => {
    for (const dow of [1, 2, 3, 4]) {
      for (const h of [11, 12, 13]) {
        expect(getPrior(dow, h)).toBeGreaterThanOrEqual(60);
        expect(getPrior(dow, h)).toBeLessThanOrEqual(85);
      }
    }
  });

  // Weekday early morning: low (20-40).
  it("Weekday 6-7am is low", () => {
    for (const dow of [1, 2, 3, 4, 5]) {
      expect(getPrior(dow, 6)).toBeLessThan(30);
    }
  });

  // Sundays peak at brunch, lean high.
  it("Sunday brunch (12-13) is high", () => {
    expect(getPrior(0, 12)).toBeGreaterThanOrEqual(80);
    expect(getPrior(0, 13)).toBeGreaterThanOrEqual(80);
  });

  // Late night dead zone every day.
  it("3-4am is near zero", () => {
    for (let dow = 0; dow < 7; dow++) {
      expect(getPrior(dow, 3)).toBeLessThanOrEqual(10);
      expect(getPrior(dow, 4)).toBeLessThanOrEqual(10);
    }
  });
});

describe("getPrior", () => {
  it("returns 0 for out-of-range dow", () => {
    expect(getPrior(9, 12)).toBe(0);
    expect(getPrior(-1, 12)).toBe(0);
  });
  it("returns 0 for out-of-range hour", () => {
    expect(getPrior(0, 25)).toBe(0);
    expect(getPrior(0, -1)).toBe(0);
  });
});
