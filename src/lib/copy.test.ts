import { describe, expect, it } from "vitest";
import { verdictFor, actionCopyFor, formatGreenwichTime } from "./copy";

describe("verdictFor", () => {
  it("green → 'Plenty of spots'", () => {
    expect(verdictFor("green")).toBe("Plenty of spots");
  });
  it("yellow → 'Moderately busy'", () => {
    expect(verdictFor("yellow")).toBe("Moderately busy");
  });
  it("red → 'Tough today'", () => {
    expect(verdictFor("red")).toBe("Tough today");
  });
});

describe("formatGreenwichTime", () => {
  it("formats a UTC iso into Greenwich-local 12h", () => {
    // 2026-05-12 21:00 UTC == 2026-05-12 17:00 ET (EDT)
    expect(formatGreenwichTime("2026-05-12T21:00:00Z")).toBe("5:00 PM");
  });
  it("accepts Date input as well as string", () => {
    expect(formatGreenwichTime(new Date("2026-05-12T21:00:00Z"))).toBe("5:00 PM");
  });
});

describe("actionCopyFor", () => {
  it("no bestTime → fallback copy", () => {
    expect(actionCopyFor({ currentScore: 60, bestTime: null })).toMatch(
      /Won't get much easier/i,
    );
  });
  it("gap > 20 → 'Easier around X'", () => {
    expect(
      actionCopyFor({
        currentScore: 80,
        bestTime: { timestamp: "2026-05-12T01:00:00Z", score: 40 },
      }),
    ).toMatch(/^Easier around \d+:\d{2}\s?(AM|PM)\.$/);
  });
  it("gap in (5,20] → 'Should ease up by X'", () => {
    expect(
      actionCopyFor({
        currentScore: 60,
        bestTime: { timestamp: "2026-05-12T01:00:00Z", score: 50 },
      }),
    ).toMatch(/^Should ease up by /);
  });
  it("gap <= 5 → fallback copy", () => {
    expect(
      actionCopyFor({
        currentScore: 50,
        bestTime: { timestamp: "2026-05-12T01:00:00Z", score: 47 },
      }),
    ).toMatch(/Won't get much easier/i);
  });
  it("gap === 20 (boundary, inclusive at 20) → 'Should ease up by X'", () => {
    expect(
      actionCopyFor({
        currentScore: 70,
        bestTime: { timestamp: "2026-05-12T01:00:00Z", score: 50 },
      }),
    ).toMatch(/^Should ease up by /);
  });
});
