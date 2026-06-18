import { describe, expect, it } from "vitest";
import { parseDayParam } from "./day-param";

describe("parseDayParam", () => {
  it("returns today when missing", () => {
    const out = parseDayParam(undefined, new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("today");
  });
  it("returns today when explicitly 'today'", () => {
    const out = parseDayParam("today", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("today");
  });
  it("anchors 'tomorrow' to the current Greenwich hour (16:00 EDT here)", () => {
    // now = 20:00 UTC = 16:00 America/New_York, inside the active window
    const out = parseDayParam("tomorrow", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("future");
    if (out.kind === "future") {
      expect(out.startAt.toISOString()).toBe("2026-05-13T20:00:00.000Z");
      // implicit anchor, not a user-set time
      expect(out.time).toBeUndefined();
    }
  });
  it("clamps an early-morning 'now' up to the 8am active-window floor", () => {
    // now = 09:00 UTC = 05:00 America/New_York → clamps to 08:00 local
    const out = parseDayParam("tomorrow", new Date("2026-05-12T09:00:00Z"));
    expect(out.kind).toBe("future");
    if (out.kind === "future") {
      expect(out.startAt.toISOString()).toBe("2026-05-13T12:00:00.000Z");
    }
  });
  it("clamps a late-night 'now' down to the 6pm active-window ceiling", () => {
    // now = 02:00 UTC = 22:00 (prev day) America/New_York → clamps to 18:00 local
    const out = parseDayParam("tomorrow", new Date("2026-05-13T02:00:00Z"));
    expect(out.kind).toBe("future");
    if (out.kind === "future") {
      expect(out.startAt.toISOString()).toBe("2026-05-13T22:00:00.000Z");
    }
  });
  it("accepts a Greenwich-local time for tomorrow", () => {
    const out = parseDayParam("tomorrow", new Date("2026-05-12T20:00:00Z"), "18:30");
    expect(out.kind).toBe("future");
    if (out.kind === "future") {
      expect(out.startAt.toISOString()).toBe("2026-05-13T22:30:00.000Z");
      expect(out.time).toBe("18:30");
    }
  });
  it("rolls late Greenwich-local times into the next UTC day", () => {
    const out = parseDayParam("tomorrow", new Date("2026-05-12T20:00:00Z"), "23:30");
    expect(out.kind).toBe("future");
    if (out.kind === "future") {
      expect(out.startAt.toISOString()).toBe("2026-05-14T03:30:00.000Z");
    }
  });
  it("accepts later today with a Greenwich-local time", () => {
    const out = parseDayParam("today", new Date("2026-05-12T20:00:00Z"), "17:45");
    expect(out.kind).toBe("future");
    if (out.kind === "future") {
      expect(out.isoDate).toBe("2026-05-12");
      expect(out.startAt.toISOString()).toBe("2026-05-12T21:45:00.000Z");
    }
  });
  it("accepts ISO date string for future days", () => {
    // now 16:00 local → default anchor 16:00 on the chosen date
    const out = parseDayParam("2026-05-15", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("future");
    if (out.kind === "future") {
      expect(out.startAt.toISOString()).toBe("2026-05-15T20:00:00.000Z");
    }
  });
  it("accepts past dates → future (caller treats as historical-style preview)", () => {
    const out = parseDayParam("2026-05-10", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("future");
    if (out.kind === "future") {
      expect(out.isoDate).toBe("2026-05-10");
    }
  });
  it("accepts > 7 days out (Open-Meteo hourly will fall back to current snapshot)", () => {
    const out = parseDayParam("2026-06-01", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("future");
    if (out.kind === "future") {
      expect(out.isoDate).toBe("2026-06-01");
    }
  });
  it("rejects malformed → falls back to today", () => {
    const out = parseDayParam("garbage", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("today");
  });
});
