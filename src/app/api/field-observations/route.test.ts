import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Observation } from "@/lib/db/schema";

// Mock the ingest layer (no DB/network) and the DB insert.
const getObservationForDisplay = vi.fn();
vi.mock("@/lib/ingest", () => ({
  getObservationForDisplay: (...a: unknown[]) => getObservationForDisplay(...a),
}));

const insertReturning = vi.fn();
vi.mock("@/lib/db/client", () => {
  const returning = vi.fn(async () => [insertReturning()]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  return { db: { insert } };
});

import { POST } from "./route";

const VALID_BLOCK = "lafayette__elm";

function observation(over: Partial<Observation> = {}): Observation {
  return {
    id: 1,
    observedAt: new Date("2026-06-18T12:00:00Z"),
    computedScore: 55,
    computedConfidence: "high",
    hour: 14,
    dayOfWeek: 6,
    localDate: "2026-06-18",
    specialEventCount: 0,
    trafficSeverity: "none",
    weatherCondition: "clear",
    weatherTempF: 70,
    ...over,
  } as unknown as Observation;
}

let uaCounter = 0;
function makeReq(body: unknown, opts: { ua?: string; ip?: string } = {}): NextRequest {
  const ua = opts.ua ?? `agent-${uaCounter++}`; // distinct client per call by default
  const headers = new Headers({
    "content-type": "application/json",
    "user-agent": ua,
    "x-forwarded-for": opts.ip ?? "10.0.0.1",
  });
  return new NextRequest("https://x/api/field-observations", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getObservationForDisplay.mockResolvedValue({
    observation: observation(),
    refreshed: false,
  });
  insertReturning.mockReturnValue({
    id: 99,
    predictionError: 5,
    predictedScore: 60,
    userScore: 60,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validation", () => {
  it("400 invalid_json on a non-JSON body", async () => {
    const res = await POST(makeReq("{not json"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_json" });
  });

  it("400 spam_rejected when the honeypot website field is filled", async () => {
    const res = await POST(
      makeReq({ blockId: VALID_BLOCK, rating: 2, website: "http://spam" }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "spam_rejected" });
  });

  it("400 too_fast when the client submitted faster than a human could", async () => {
    const res = await POST(
      makeReq({ blockId: VALID_BLOCK, rating: 2, clientElapsedMs: 200 }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "too_fast" });
  });

  it("400 invalid_block for an unknown block id", async () => {
    const res = await POST(
      makeReq({ blockId: "nope", rating: 2, clientElapsedMs: 5000 }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_block" });
  });

  it("400 invalid_rating for an out-of-range rating", async () => {
    const res = await POST(
      makeReq({ blockId: VALID_BLOCK, rating: 99, clientElapsedMs: 5000 }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_rating" });
  });

  it("200 ok on a valid submission, persisting and returning the observed category", async () => {
    const res = await POST(
      makeReq({ blockId: VALID_BLOCK, rating: 3, clientElapsedMs: 5000 }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.observation.id).toBe(99);
    expect(["green", "yellow", "red"]).toContain(body.observedCategory);
    expect(insertReturning).toHaveBeenCalledOnce();
  });
});

describe("rate limiting (18 / 10min per client hash)", () => {
  it("allows 18 submissions then rejects the 19th with 429", async () => {
    const ua = "rate-limit-client";
    const ip = "10.9.9.9";
    // Use rating 0 (Easy/Empty) — irrelevant; clientElapsedMs >= 1200 to pass.
    const body = { blockId: VALID_BLOCK, rating: 1, clientElapsedMs: 5000 };

    for (let i = 1; i <= 18; i++) {
      const res = await POST(makeReq(body, { ua, ip }));
      expect(res.status, `submission ${i} should be allowed`).toBe(200);
    }

    const res19 = await POST(makeReq(body, { ua, ip }));
    expect(res19.status).toBe(429);
    await expect(res19.json()).resolves.toEqual({
      error: "too_many_submissions",
    });
  });

  it("rate limit is per client hash — a different client is unaffected", async () => {
    const body = { blockId: VALID_BLOCK, rating: 1, clientElapsedMs: 5000 };
    // Exhaust client A.
    for (let i = 0; i < 19; i++) {
      await POST(makeReq(body, { ua: "client-A", ip: "1.1.1.1" }));
    }
    // Client B (different UA + IP) still gets through.
    const res = await POST(makeReq(body, { ua: "client-B", ip: "2.2.2.2" }));
    expect(res.status).toBe(200);
  });
});
