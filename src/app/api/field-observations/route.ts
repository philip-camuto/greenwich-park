import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { BLOCKS } from "@/components/avenue-map-data";
import { db } from "@/lib/db/client";
import { fieldObservations } from "@/lib/db/schema";
import {
  categoryForScore,
  scoreForFieldRating,
} from "@/lib/field-calibration";
import { getObservationForDisplay } from "@/lib/ingest";
import { perBlockScores } from "@/lib/per-block";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  blockId?: unknown;
  clientElapsedMs?: unknown;
  notes?: unknown;
  rating?: unknown;
  website?: unknown;
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 18;
const MIN_HUMAN_SUBMIT_MS = 1200;
const rateBuckets = new Map<string, RateBucket>();

function cleanNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

function firstHeaderValue(value: string | null): string {
  return value?.split(",")[0]?.trim() ?? "";
}

function hashClient(req: NextRequest): string {
  const ip =
    firstHeaderValue(req.headers.get("x-forwarded-for")) ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ua = req.headers.get("user-agent") ?? "unknown";
  return createHash("sha256")
    .update(`${ip}|${ua}`)
    .digest("hex")
    .slice(0, 24);
}

function checkRateLimit(clientHash: string): boolean {
  const now = Date.now();
  const current = rateBuckets.get(clientHash);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(clientHash, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  current.count += 1;
  return current.count <= RATE_LIMIT_MAX;
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ error: "spam_rejected" }, { status: 400 });
  }

  const clientHash = hashClient(req);
  if (!checkRateLimit(clientHash)) {
    return NextResponse.json({ error: "too_many_submissions" }, { status: 429 });
  }

  const clientElapsedMs = numericValue(body.clientElapsedMs);
  if (clientElapsedMs != null && clientElapsedMs < MIN_HUMAN_SUBMIT_MS) {
    return NextResponse.json({ error: "too_fast" }, { status: 400 });
  }

  const qualityFlags = [
    clientElapsedMs == null ? "missing_elapsed" : null,
    clientElapsedMs != null && clientElapsedMs < 3000 ? "quick_submit" : null,
    req.headers.get("user-agent") ? null : "missing_user_agent",
  ].filter(Boolean);

  const blockId = typeof body.blockId === "string" ? body.blockId : "";
  if (!BLOCKS.some((b) => b.id === blockId)) {
    return NextResponse.json({ error: "invalid_block" }, { status: 400 });
  }

  const rating =
    typeof body.rating === "number"
      ? body.rating
      : typeof body.rating === "string"
        ? Number.parseInt(body.rating, 10)
        : NaN;
  const userScore = scoreForFieldRating(rating);
  if (userScore == null) {
    return NextResponse.json({ error: "invalid_rating" }, { status: 400 });
  }

  const { observation } = await getObservationForDisplay();
  const blockScores = perBlockScores(observation.computedScore, {
    hour: observation.hour,
    dayOfWeek: observation.dayOfWeek,
  });
  const block = blockScores[blockId];
  if (!block) {
    return NextResponse.json({ error: "block_unavailable" }, { status: 500 });
  }

  const [row] = await db
    .insert(fieldObservations)
    .values({
      blockId,
      clientElapsedMs,
      clientHash,
      dayOfWeek: observation.dayOfWeek,
      hour: observation.hour,
      localDate: observation.localDate,
      modelObservedAt: observation.observedAt,
      notes: cleanNotes(body.notes),
      observationId: observation.id,
      predictedCategory: block.category,
      predictedConfidence: observation.computedConfidence,
      predictedScore: block.score,
      predictionError: userScore - block.score,
      specialEventCount: observation.specialEventCount ?? 0,
      trafficSeverity: observation.trafficSeverity,
      userRating: rating,
      userScore,
      userAgent: (req.headers.get("user-agent") ?? "").slice(0, 240) || null,
      weatherCondition: observation.weatherCondition,
      weatherTempF: observation.weatherTempF,
      qualityFlags: qualityFlags.length ? qualityFlags.join(",") : null,
    })
    .returning({
      id: fieldObservations.id,
      predictionError: fieldObservations.predictionError,
      predictedScore: fieldObservations.predictedScore,
      userScore: fieldObservations.userScore,
    });

  return NextResponse.json({
    ok: true,
    observation: row,
    observedCategory: categoryForScore(userScore),
  });
}
