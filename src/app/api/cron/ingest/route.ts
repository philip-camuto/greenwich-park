import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

// POST or GET both trigger a write. Bearer auth via CRON_SECRET is REQUIRED;
// the endpoint refuses to serve when the secret is missing so a misconfigured
// env can't accidentally expose a public write endpoint.
//
// Vercel Cron on Hobby is essentially daily-only, so Phase 1 uses a GitHub
// Actions cron (.github/workflows/ingest.yml) hitting this endpoint every
// 30 min. The route is also used for manual triggers from /debug.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuthResult = { ok: true } | { ok: false; status: number; error: string };

function authorize(request: Request): AuthResult {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/ingest] CRON_SECRET is not set — refusing to serve");
    return { ok: false, status: 503, error: "not_configured" };
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}

async function handle(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
