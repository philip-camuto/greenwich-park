import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGreenwichTownEvents } from "./townICal";

afterEach(() => vi.restoreAllMocks());

const SAMPLE_ICS = (startUtc: string) => `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-1
SUMMARY:Greenwich Holiday Stroll
DTSTART:${startUtc}
DTEND:${startUtc}
END:VEVENT
END:VCALENDAR`;

describe("fetchGreenwichTownEvents", () => {
  it("returns [] on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    expect(await fetchGreenwichTownEvents()).toEqual([]);
  });

  it("includes events within 48h window", async () => {
    // Pick a date 12 hours from now so it falls in window.
    const future = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const stamp =
      future.getUTCFullYear().toString() +
      String(future.getUTCMonth() + 1).padStart(2, "0") +
      String(future.getUTCDate()).padStart(2, "0") +
      "T" +
      String(future.getUTCHours()).padStart(2, "0") +
      String(future.getUTCMinutes()).padStart(2, "0") +
      "00Z";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(SAMPLE_ICS(stamp), { status: 200 })),
    );
    const out = await fetchGreenwichTownEvents();
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("town-ical");
    expect(out[0].name).toBe("Greenwich Holiday Stroll");
  });

  it("excludes events beyond 48h horizon", async () => {
    const farFuture = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const stamp =
      farFuture.getUTCFullYear().toString() +
      String(farFuture.getUTCMonth() + 1).padStart(2, "0") +
      String(farFuture.getUTCDate()).padStart(2, "0") +
      "T" +
      String(farFuture.getUTCHours()).padStart(2, "0") +
      String(farFuture.getUTCMinutes()).padStart(2, "0") +
      "00Z";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(SAMPLE_ICS(stamp), { status: 200 })),
    );
    expect(await fetchGreenwichTownEvents()).toEqual([]);
  });
});
