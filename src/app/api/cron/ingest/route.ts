import { NextResponse } from "next/server";

// On-demand ingest (also reachable as a cron target later).
// Phase 1 strategy: callable from the demand routes on cache miss.
// Adding Pro/GHA cron later just hits this same endpoint.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // TODO Step 5: fetch sources, run model, write observation row.
  return NextResponse.json({ ok: true, wrote: 0 });
}
