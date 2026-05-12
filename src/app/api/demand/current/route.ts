import { NextResponse } from "next/server";

export const revalidate = 0;

export async function GET() {
  // TODO Step 6: latest observation + stale-data fallback.
  return NextResponse.json({
    score: 0,
    category: "green",
    confidence: "low",
    observedAt: new Date().toISOString(),
    stale: true,
  });
}
