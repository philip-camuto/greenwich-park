import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Observation } from "@/lib/db/schema";

const runIngest = vi.fn();
vi.mock("@/lib/ingest", () => ({
  runIngest: (...a: unknown[]) => runIngest(...a),
}));

import { GET, POST } from "./route";

function obs(over: Partial<Observation> = {}): Observation {
  return {
    id: 1,
    observedAt: new Date("2026-06-18T12:00:00Z"),
    computedScore: 55,
    computedCategory: "yellow",
    computedConfidence: "high",
    weatherOk: true,
    trafficOk: true,
    trafficTomTomOk: true,
    mtaOk: true,
    mnrAlertsOk: true,
    ...over,
  } as unknown as Observation;
}

function req(auth?: string): Request {
  const headers = new Headers();
  if (auth !== undefined) headers.set("authorization", auth);
  return new Request("https://x/api/cron/ingest", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  runIngest.mockResolvedValue(obs());
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.restoreAllMocks();
});

describe("auth", () => {
  it("503 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "not_configured" });
    expect(runIngest).not.toHaveBeenCalled();
  });

  it("401 when the Authorization header is missing", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
    expect(runIngest).not.toHaveBeenCalled();
  });

  it("401 when the secret is wrong", async () => {
    const res = await POST(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(runIngest).not.toHaveBeenCalled();
  });
});

describe("success", () => {
  it("200 with the observation summary on a healthy ingest, degraded:false", async () => {
    const res = await POST(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.degraded).toBe(false);
    expect(body.failedSources).toEqual([]);
    expect(body.observation).toMatchObject({
      id: 1,
      score: 55,
      category: "yellow",
      confidence: "high",
    });
  });

  it("flags degraded:true and names failed sources from the persisted ok-flags", async () => {
    runIngest.mockResolvedValue(
      obs({ trafficTomTomOk: false, mtaOk: false }),
    );
    const res = await GET(req("Bearer s3cret"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.degraded).toBe(true);
    expect(body.failedSources.sort()).toEqual(["metroNorth", "tomTom"].sort());
  });

  it("treats null ok-flag columns as failed (older nullable columns)", async () => {
    runIngest.mockResolvedValue(
      obs({ mtaOk: null as unknown as boolean, mnrAlertsOk: null as unknown as boolean }),
    );
    const res = await GET(req("Bearer s3cret"));
    const body = await res.json();
    expect(body.degraded).toBe(true);
    expect(body.failedSources.sort()).toEqual(
      ["metroNorth", "metroNorthAlerts"].sort(),
    );
  });
});

describe("error handling", () => {
  it("500 with the error message when runIngest throws", async () => {
    runIngest.mockRejectedValue(new Error("neon down"));
    const res = await POST(req("Bearer s3cret"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "neon down" });
  });
});
