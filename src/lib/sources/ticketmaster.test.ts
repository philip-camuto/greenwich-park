import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTicketmasterGreenwichEvents } from "./ticketmaster";

beforeEach(() => {
  delete process.env.TICKETMASTER_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TICKETMASTER_API_KEY;
});

describe("fetchTicketmasterGreenwichEvents", () => {
  it("returns [] when no key", async () => {
    expect(await fetchTicketmasterGreenwichEvents()).toEqual([]);
  });

  it("returns [] when _embedded missing", async () => {
    process.env.TICKETMASTER_API_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );
    expect(await fetchTicketmasterGreenwichEvents()).toEqual([]);
  });

  it("maps events into SpecialEvent shape", async () => {
    process.env.TICKETMASTER_API_KEY = "k";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            _embedded: {
              events: [
                {
                  id: "1",
                  name: "Greenwich Symphony",
                  url: "https://tm/x",
                  dates: { start: { dateTime: "2026-05-13T23:00:00Z", localDate: "2026-05-13" } },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const out = await fetchTicketmasterGreenwichEvents();
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("ticketmaster");
    expect(out[0].date).toBe("2026-05-13");
  });
});
