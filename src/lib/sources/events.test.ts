import { describe, expect, it } from "vitest";
import { eventsFiringAt } from "./events";
import type { SpecialEvent } from "@/lib/model/types";

const baseEvent = (over: Partial<SpecialEvent>): SpecialEvent => ({
  date: "2026-05-13",
  name: "x",
  demandBoost: 8,
  ...over,
});

describe("eventsFiringAt", () => {
  it("returns events with startsAt within ±2h of target", () => {
    const target = new Date("2026-05-13T18:00:00Z");
    const events = [
      baseEvent({ name: "in-window", startsAt: "2026-05-13T17:30:00Z" }),
      baseEvent({ name: "before-window", startsAt: "2026-05-13T15:00:00Z" }),
      baseEvent({ name: "after-window", startsAt: "2026-05-13T22:00:00Z" }),
    ];
    const out = eventsFiringAt(events, target);
    expect(out.map((e) => e.name)).toEqual(["in-window"]);
  });

  it("falls back to date match when startsAt is missing", () => {
    const target = new Date("2026-05-13T18:00:00Z");
    const events = [
      baseEvent({ name: "all-day", date: "2026-05-13" }),
      baseEvent({ name: "wrong-date", date: "2026-05-14" }),
    ];
    const out = eventsFiringAt(events, target);
    expect(out.map((e) => e.name)).toEqual(["all-day"]);
  });
});
