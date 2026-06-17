import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyStatusSummary,
  fetchMetroNorthAlerts,
  summarizeForNewHaven,
} from "./metroNorthAlerts";

afterEach(() => vi.restoreAllMocks());

describe("classifyStatusSummary", () => {
  it("maps delays variants", () => {
    expect(classifyStatusSummary("Some Delays")).toBe("minor-delays");
    expect(classifyStatusSummary("Delays")).toBe("minor-delays");
    expect(classifyStatusSummary("Severe Delays")).toBe("major-delays");
    expect(classifyStatusSummary("Major Delays")).toBe("major-delays");
  });

  it("maps suspensions", () => {
    expect(classifyStatusSummary("Suspended")).toBe("suspended");
    expect(classifyStatusSummary("Service Suspended")).toBe("suspended");
  });

  it("maps planned work", () => {
    expect(classifyStatusSummary("Planned - Substitute Buses")).toBe(
      "planned-work",
    );
  });

  it("treats informational notices as normal", () => {
    expect(classifyStatusSummary("Station Notice")).toBe("normal");
    expect(classifyStatusSummary("Special Schedule")).toBe("normal");
    expect(classifyStatusSummary("Boarding Change")).toBe("normal");
  });
});

describe("summarizeForNewHaven", () => {
  const now = new Date("2026-05-12T20:00:00Z");

  it("returns ok:false when no NH-family routes present", () => {
    const out = summarizeForNewHaven(
      {
        routeDetails: [
          { agency: "MNR", routeId: "MNR_1", statusDetails: [] }, // Hudson
        ],
      },
      now,
    );
    expect(out.ok).toBe(false);
    expect(out.newHavenLineStatus).toBe("unknown");
  });

  it("returns normal when NH route has no active alerts", () => {
    const out = summarizeForNewHaven(
      {
        routeDetails: [
          { agency: "MNR", routeId: "MNR_3", inService: true, statusDetails: [] },
        ],
      },
      now,
    );
    expect(out.ok).toBe(true);
    expect(out.newHavenLineStatus).toBe("normal");
    expect(out.activeAlertCount).toBe(0);
  });

  it("escalates to the worst active status across routes", () => {
    const out = summarizeForNewHaven(
      {
        routeDetails: [
          {
            agency: "MNR",
            routeId: "MNR_3",
            inService: true,
            statusDetails: [
              { statusSummary: "Some Delays" },
              { statusSummary: "Station Notice" },
            ],
          },
          {
            agency: "MNR",
            routeId: "MNR_5", // Danbury branch
            inService: true,
            statusDetails: [{ statusSummary: "Suspended" }],
          },
        ],
      },
      now,
    );
    expect(out.ok).toBe(true);
    expect(out.newHavenLineStatus).toBe("suspended");
    expect(out.activeAlertCount).toBe(3);
  });

  it("ignores alerts whose window doesn't cover now", () => {
    const out = summarizeForNewHaven(
      {
        routeDetails: [
          {
            agency: "MNR",
            routeId: "MNR_3",
            inService: true,
            statusDetails: [
              {
                statusSummary: "Severe Delays",
                startDate: "2026-05-13T00:00:00Z", // future
              },
              {
                statusSummary: "Suspended",
                endDate: "2026-05-12T19:00:00Z", // already ended
              },
            ],
          },
        ],
      },
      now,
    );
    expect(out.newHavenLineStatus).toBe("normal");
    expect(out.activeAlertCount).toBe(0);
  });

  it("flags suspended when route inService is false", () => {
    const out = summarizeForNewHaven(
      {
        routeDetails: [
          { agency: "MNR", routeId: "MNR_3", inService: false, statusDetails: [] },
        ],
      },
      now,
    );
    expect(out.newHavenLineStatus).toBe("suspended");
  });
});

describe("fetchMetroNorthAlerts", () => {
  // fetchMetroNorthAlerts now requires MTA_CAMSYS_KEY and short-circuits to
  // empty() without it (no embedded default key). The fetch-path tests need a
  // key set so they exercise the request, not the early return.
  const ORIG_KEY = process.env.MTA_CAMSYS_KEY;
  beforeEach(() => {
    process.env.MTA_CAMSYS_KEY = "test-key";
  });
  afterEach(() => {
    if (ORIG_KEY === undefined) delete process.env.MTA_CAMSYS_KEY;
    else process.env.MTA_CAMSYS_KEY = ORIG_KEY;
  });

  it("returns ok:false without calling fetch when MTA_CAMSYS_KEY is unset", async () => {
    delete process.env.MTA_CAMSYS_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const out = await fetchMetroNorthAlerts();
    expect(out.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ok:false on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("err", { status: 500 })),
    );
    const out = await fetchMetroNorthAlerts();
    expect(out.ok).toBe(false);
  });

  it("returns ok:false on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    const out = await fetchMetroNorthAlerts();
    expect(out.ok).toBe(false);
  });

  it("parses a payload with NH delay", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              routeDetails: [
                {
                  agency: "MNR",
                  routeId: "MNR_3",
                  inService: true,
                  statusDetails: [{ statusSummary: "Some Delays" }],
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const out = await fetchMetroNorthAlerts();
    expect(out.ok).toBe(true);
    expect(out.newHavenLineStatus).toBe("minor-delays");
  });
});
