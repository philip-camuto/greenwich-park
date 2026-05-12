import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CTEvent,
  exitRangeOverlapsGreenwich,
  fetchGreenwichTraffic,
  isGreenwichRelevant,
  summarize,
} from "./ctTravelSmart";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CT_TRAVEL_SMART_API_KEY;
});

const baseEvent: CTEvent = {
  ID: 1,
  RoadwayName: "I-95",
  DirectionOfTravel: "Northbound",
  Description: "",
  Latitude: 41.026,
  Longitude: -73.628,
  EventType: "trafficConditions",
  EventSubType: "Queue",
  IsFullClosure: false,
};

describe("exitRangeOverlapsGreenwich", () => {
  it("parses 'between Exits A and B'", () => {
    expect(exitRangeOverlapsGreenwich("between Exits 7 and 24")).toBe(false);
    expect(exitRangeOverlapsGreenwich("between Exits 1 and 5")).toBe(true);
    expect(exitRangeOverlapsGreenwich("between Exits 3 and 12")).toBe(true);
  });
  it("returns false on no match", () => {
    expect(exitRangeOverlapsGreenwich("traffic ahead")).toBe(false);
    expect(exitRangeOverlapsGreenwich(null)).toBe(false);
  });
});

describe("isGreenwichRelevant", () => {
  it("requires I-95", () => {
    expect(isGreenwichRelevant({ ...baseEvent, RoadwayName: "RT-15" })).toBe(false);
  });
  it("accepts events within Greenwich radius (no exit range)", () => {
    expect(isGreenwichRelevant({ ...baseEvent, Description: "Disabled vehicle" }))
      .toBe(true);
  });
  it("rejects far events with non-overlapping exit range", () => {
    expect(
      isGreenwichRelevant({
        ...baseEvent,
        Latitude: 41.3,
        Longitude: -72.9,
        Description: "I-95 NB between Exits 40 and 50",
      }),
    ).toBe(false);
  });
  it("accepts events whose exit range overlaps Greenwich (regardless of distance)", () => {
    expect(
      isGreenwichRelevant({
        ...baseEvent,
        Latitude: 41.3,
        Longitude: -72.9,
        Description: "I-95 NB between Exits 3 and 12",
      }),
    ).toBe(true);
  });
  it("rejects nearby event-start with explicit non-overlapping exit range (Westport queue)", () => {
    // Real-world case: Westport NB queue starts at ~41.05 (4.7mi from Greenwich)
    // but the queue actually covers Exits 7-24, north of Greenwich.
    expect(
      isGreenwichRelevant({
        ...baseEvent,
        Latitude: 41.047,
        Longitude: -73.542,
        Description: "I-95 NB is congested between Exits 7 and 24",
      }),
    ).toBe(false);
  });
});

describe("summarize", () => {
  it("derives severity from event count + closures", () => {
    expect(summarize([]).severity).toBe("none");
    expect(summarize([baseEvent]).severity).toBe("light");
    expect(summarize([baseEvent, { ...baseEvent, ID: 2 }]).severity).toBe("moderate");
    expect(
      summarize([
        baseEvent,
        { ...baseEvent, ID: 2 },
        { ...baseEvent, ID: 3 },
      ]).severity,
    ).toBe("heavy");
    expect(
      summarize([{ ...baseEvent, IsFullClosure: true }]).severity,
    ).toBe("heavy");
  });
  it("tracks direction flags", () => {
    const snap = summarize([
      baseEvent,
      { ...baseEvent, ID: 2, DirectionOfTravel: "Southbound" },
    ]);
    expect(snap.northboundAffected).toBe(true);
    expect(snap.southboundAffected).toBe(true);
  });
  it("counts only I-95 events for total", () => {
    const snap = summarize([
      baseEvent,
      { ...baseEvent, ID: 2, RoadwayName: "RT-15" },
    ]);
    expect(snap.i95EventsTotal).toBe(1);
  });
});

describe("fetchGreenwichTraffic", () => {
  it("returns empty snapshot when API key missing", async () => {
    const snap = await fetchGreenwichTraffic();
    expect(snap.severity).toBe("none");
    expect(snap.greenwichRelevantEvents).toBe(0);
  });

  it("returns empty snapshot on non-2xx upstream", async () => {
    process.env.CT_TRAVEL_SMART_API_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate-limited", { status: 429 })),
    );
    const snap = await fetchGreenwichTraffic();
    expect(snap.severity).toBe("none");
  });

  it("parses live-shape response", async () => {
    process.env.CT_TRAVEL_SMART_API_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            {
              ID: 1,
              RoadwayName: "I-95",
              DirectionOfTravel: "Northbound",
              Description: "I-95 NB between Exits 3 and 12",
              Latitude: 41.3,
              Longitude: -72.9,
              EventType: "trafficConditions",
              EventSubType: "Queue",
              IsFullClosure: false,
            },
          ]),
          { status: 200 },
        ),
      ),
    );
    const snap = await fetchGreenwichTraffic();
    expect(snap.greenwichRelevantEvents).toBe(1);
    expect(snap.severity).toBe("light");
    expect(snap.northboundAffected).toBe(true);
  });
});
