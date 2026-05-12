import { NextResponse } from "next/server";
import { buildForecastForGreenwich } from "@/lib/forecast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const forecast = await buildForecastForGreenwich();
    return NextResponse.json(forecast, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "forecast_unavailable";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
