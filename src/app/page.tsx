import { BreakdownCard } from "@/components/BreakdownCard";
import { Card } from "@/components/Card";
import { BlockHotspots, BlockMap } from "@/components/BlockIntelligence";
import { DaySegmentedControl } from "@/components/DaySegmentedControl";
import { DemandScrubProvider } from "@/components/DemandScrubProvider";
import { DemandSection } from "@/components/DemandSection";
import { SectionCaption } from "@/components/SectionCaption";
import {
  breakdownViewFromForecastPoint,
  breakdownViewFromObservation,
} from "@/lib/breakdown-view";
import { parseDayParam } from "@/lib/day-param";
import { buildForecastForGreenwich } from "@/lib/forecast";
import { getObservationForDisplay } from "@/lib/ingest";
import type { DemandCategory } from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function blockContext(at: Date | string): { hour: number; dayOfWeek: number } {
  const d = typeof at === "string" ? new Date(at) : at;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: GREENWICH_TZ,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const parsedHour = parseInt(parts.hour ?? "0", 10);
  return {
    hour: parsedHour === 24 ? 0 : parsedHour,
    dayOfWeek: dayMap[parts.weekday ?? "Sun"] ?? 0,
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; time?: string }>;
}) {
  const { day, time } = await searchParams;
  const dayParam = parseDayParam(day, new Date(), time);

  const [{ observation }, forecast] = await Promise.all([
    getObservationForDisplay(),
    buildForecastForGreenwich(
      dayParam.kind === "future" ? dayParam.startAt : undefined,
    ),
  ]);

  let globalScore: number;
  let category: DemandCategory;
  let confidence: "low" | "medium" | "high";
  let displayedAt: Date | string;
  if (dayParam.kind === "today") {
    globalScore = observation.computedScore;
    category = observation.computedCategory as DemandCategory;
    confidence = observation.computedConfidence as "low" | "medium" | "high";
    displayedAt = observation.observedAt;
  } else {
    const p0 = forecast.points[0];
    globalScore = p0.score;
    category = p0.category;
    confidence = "medium";
    displayedAt = dayParam.startAt;
  }

  const initialModeledAt =
    typeof displayedAt === "string"
      ? displayedAt
      : displayedAt.toISOString();

  // Breakdown view: today renders straight from the persisted observation;
  // a future-date selection renders from the first forecast slot, which we
  // populated with the full breakdown + input snapshot in buildForecast.
  const breakdownView =
    dayParam.kind === "today"
      ? breakdownViewFromObservation(observation)
      : breakdownViewFromForecastPoint(forecast.points[0]);

  const scrubResetKey = forecast.points[0]?.timestamp ?? initialModeledAt;
  const initialBlockContext = blockContext(displayedAt);

  return (
    <DemandScrubProvider key={scrubResetKey}>
    <main className="min-h-dvh bg-[var(--bg-group)]">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-6 lg:px-8 lg:pb-10 xl:gap-8 xl:px-12">
        <header className="flex flex-col gap-3 border-b border-[var(--separator)] pb-4 lg:col-span-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mono mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
              Live curb intelligence
            </p>
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.01em] text-[var(--label-primary)] lg:text-[30px]">
              Greenwich Parking
            </h1>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <DaySegmentedControl />
          </div>
        </header>

        <section className="flex flex-col gap-4">
          <DemandSection
            key={forecast.points[0]?.timestamp ?? "empty"}
            initialScore={globalScore}
            initialCategory={category}
            initialConfidence={confidence}
            initialModeledAt={initialModeledAt}
            forecast={forecast}
          />

          <div>
            <SectionCaption>Hotspots</SectionCaption>
            <BlockHotspots
              initialScore={globalScore}
              initialContext={initialBlockContext}
              forecastPoints={forecast.points}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--label-tertiary)]">
              Block scores combine anchor businesses, curb capacity, time of
              day, and side-street relief. Phase 3 will replace the heuristics
              with measured demand.
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
          <div>
            <SectionCaption>Greenwich Avenue</SectionCaption>
            <Card className="min-h-[520px] lg:px-5 lg:py-5">
              <BlockMap
                category={category}
                initialScore={globalScore}
                initialContext={initialBlockContext}
                forecastPoints={forecast.points}
              />
            </Card>
          </div>

          {breakdownView && (
            <BreakdownCard
              initialView={breakdownView}
              forecastPoints={forecast.points}
            />
          )}
        </aside>

        <footer className="mono border-t border-[var(--separator)] pt-4 text-[11px] leading-relaxed text-[var(--label-tertiary)] lg:col-span-2">
          Public data + heuristics. Not a guarantee of availability.
        </footer>
      </div>
    </main>
    </DemandScrubProvider>
  );
}
