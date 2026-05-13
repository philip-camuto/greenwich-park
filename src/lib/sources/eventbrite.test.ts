import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchEventbriteGreenwichEvents } from "./eventbrite";

beforeEach(() => {
  delete process.env.EVENTBRITE_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.EVENTBRITE_API_KEY;
});

describe("fetchEventbriteGreenwichEvents", () => {
  it("returns [] when no key", async () => {
    expect(await fetchEventbriteGreenwichEvents()).toEqual([]);
  });

  it("maps Eventbrite events into SpecialEvent shape", async () => {
    process.env.EVENTBRITE_API_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            events: [
              {
                id: "1",
                name: { text: "Greenwich Ave Wine Walk" },
                start: { utc: "2026-05-13T22:00:00Z" },
                url: "https://eventbrite/x",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const out = await fetchEventbriteGreenwichEvents();
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Greenwich Ave Wine Walk");
    expect(out[0].source).toBe("eventbrite");
    expect(out[0].date).toBe("2026-05-13");
  });

  it("returns [] on non-2xx", async () => {
    process.env.EVENTBRITE_API_KEY = "k";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    expect(await fetchEventbriteGreenwichEvents()).toEqual([]);
  });
});
