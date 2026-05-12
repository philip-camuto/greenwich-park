import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

// POST or GET both trigger a write. Bearer auth applied when CRON_SECRET is set.
// Vercel Cron on Hobby has very restricted frequency (essentially daily-only),
// so Phase 1 does NOT install a vercel.json cron — the /api/demand/current
// route hits runIngest() on cache miss instead. This endpoint remains useful
// for manual triggers, future GitHub Actions cron, or a Pro-plan upgrade.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // unprotected when no secret is set
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const obs = await runIngest();
    return NextResponse.json({
      ok: true,
      observation: {
        id: obs.id,
        observedAt: obs.observedAt,
        score: obs.computedScore,
        category: obs.computedCategory,
        confidence: obs.computedConfidence,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
