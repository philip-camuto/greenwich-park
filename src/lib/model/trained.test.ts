import { describe, expect, it } from "vitest";
import { inTrainedWindow, trainedBaseScore } from "./trained";

describe("inTrainedWindow", () => {
  it("is true inside the Mon-Sat 8am-4pm enforcement window", () => {
    expect(inTrainedWindow(1, 8)).toBe(true); // Mon 8am
    expect(inTrainedWindow(6, 13)).toBe(true); // Sat 1pm
    expect(inTrainedWindow(6, 16)).toBe(true); // Sat 4pm
  });

  it("is false on Sundays and outside enforcement hours", () => {
    expect(inTrainedWindow(0, 13)).toBe(false); // Sunday
    expect(inTrainedWindow(2, 7)).toBe(false); // Tue 7am (before window)
    expect(inTrainedWindow(2, 17)).toBe(false); // Tue 5pm (after window)
  });
});

describe("trainedBaseScore", () => {
  it("returns null outside the window (caller falls back to getPrior)", () => {
    expect(trainedBaseScore(0, 13)).toBeNull(); // Sunday
    expect(trainedBaseScore(2, 6)).toBeNull(); // Tue 6am
  });

  it("returns a 0-100 score inside the window", () => {
    const s = trainedBaseScore(6, 11); // Sat 11am, the weekly peak
    expect(s).not.toBeNull();
    expect(s as number).toBeGreaterThanOrEqual(0);
    expect(s as number).toBeLessThanOrEqual(100);
  });

  it("ranks Saturday midday as busier than a weekday late afternoon", () => {
    // The patrol adjustment is the whole point: Saturday must NOT read quiet
    // just because it gets less enforcement patrol.
    const satMidday = trainedBaseScore(6, 12) as number;
    const weekdayLate = trainedBaseScore(3, 15) as number;
    expect(satMidday).toBeGreaterThan(weekdayLate);
  });
});
