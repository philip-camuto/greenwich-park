import { BestTimeCallout } from "@/components/BestTimeCallout";
import { DemandScore } from "@/components/DemandScore";
import { ForecastChart } from "@/components/ForecastChart";
import { buildForecastForGreenwich } from "@/lib/forecast";
import { getOrRefreshObservation } from "@/lib/ingest";
import type { DemandCategory } from "@/lib/model/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const [{ observation }, forecast] = await Promise.all([
    getOrRefreshObservation(),
    buildForecastForGreenwich(),
  ]);

  const category = observation.computedCategory as DemandCategory;
  const confidence = observation.computedConfidence as
    | "low"
    | "medium"
    | "high";

  return (
    <main className="min-h-dvh flex flex-col bg-[var(--bg)] text-[var(--fg)]">
      {/* Top rail — Greenwich coordinate as the only "logo" */}
      <header className="px-6 pt-6 sm:pt-8 flex items-center justify-between">
        <span className="mono text-[10px] tracking-[0.25em] uppercase text-[var(--muted)]">
          41.026°N · 73.628°W
        </span>
        <span className="mono text-[10px] tracking-[0.25em] uppercase text-[var(--muted)]">
          Greenwich Park
        </span>
      </header>

      {/* Hairline under header */}
      <div className="mx-6 mt-6 border-t border-[var(--hairline)]" />

      {/* Score block */}
      <div className="mt-10 sm:mt-14">
        <DemandScore
          score={observation.computedScore}
          category={category}
          observedAt={observation.observedAt}
          confidence={confidence}
        />
      </div>

      {/* Hairline */}
      <div className="mx-6 mt-10 sm:mt-14 border-t border-[var(--hairline)]" />

      {/* Forecast chart with section label */}
      <section className="px-6 mt-6 sm:mt-8">
        <div className="mono text-[10px] tracking-[0.25em] uppercase text-[var(--muted)] mb-3">
          Next 4 hours
        </div>
        <ForecastChart points={forecast.points} bestTime={forecast.bestTime} />
      </section>

      {/* Hairline */}
      <div className="mx-6 mt-8 border-t border-[var(--hairline)]" />

      {/* Best-time callout */}
      <section className="px-6 mt-6">
        <div className="mono text-[10px] tracking-[0.25em] uppercase text-[var(--muted)] mb-3">
          Best in next 4h
        </div>
        <BestTimeCallout
          bestTime={forecast.bestTime}
          currentScore={observation.computedScore}
        />
      </section>

      {/* Footer — pushed to bottom */}
      <footer className="mt-auto px-6 pt-12 pb-8 text-[10px] tracking-[0.18em] uppercase mono text-[var(--muted)] leading-relaxed">
        Public data + heuristics. Not a guarantee of availability.
      </footer>
    </main>
  );
}
