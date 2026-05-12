import { NextResponse } from "next/server";
import { getOrRefreshObservation } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { observation, refreshed } = await getOrRefreshObservation();
    return NextResponse.json(
      {
        score: observation.computedScore,
        category: observation.computedCategory,
        confidence: observation.computedConfidence,
        observedAt: observation.observedAt,
        refreshed,
        breakdown: {
          base: observation.basePrior,
          weatherMod: observation.weatherMod,
          trafficMod: observation.trafficMod,
          holidayMod: observation.holidayMod,
          schoolMod: observation.schoolMod,
          eventMod: observation.eventMod,
          rawSum: observation.rawSum,
          closureCapped: observation.closureCapped,
        },
        inputs: {
          weather: {
            tempF: observation.weatherTempF,
            condition: observation.weatherCondition,
            precipitationIn: observation.weatherPrecipitationIn,
            windMph: observation.weatherWindMph,
            isDay: observation.weatherIsDay,
            ok: observation.weatherOk,
          },
          traffic: {
            severity: observation.trafficSeverity,
            relevantEvents: observation.trafficEventsRelevant,
            totalEvents: observation.trafficEventsTotal,
            ok: observation.trafficOk,
          },
          time: {
            localDate: observation.localDate,
            hour: observation.hour,
            dayOfWeek: observation.dayOfWeek,
            isWeekend: observation.isWeekend,
            isHoliday: observation.isHoliday,
            holidayName: observation.holidayName,
            publicInSession: observation.publicInSession,
            privateInSession: observation.privateInSession,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "demand_unavailable";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
