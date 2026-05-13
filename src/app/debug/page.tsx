import Link from "next/link";
import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { observations } from "@/lib/db/schema";
import { buildForecastForGreenwich } from "@/lib/forecast";
import { getOrRefreshObservation } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Gate behind CRON_SECRET when set. The page renders the full observation
// history and inputs — fine to expose privately, noisy to leak from a
// public repo's deployed URL. Hit /debug?key=$CRON_SECRET.
export default async function DebugPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const expected = process.env.CRON_SECRET;
  // Fail closed: when CRON_SECRET isn't configured, /debug is disabled
  // entirely rather than served wide-open.
  if (!expected) notFound();
  const { key } = await searchParams;
  if (key !== expected) notFound();

  const [{ observation, refreshed }, forecast, recent] = await Promise.all([
    getOrRefreshObservation(),
    buildForecastForGreenwich(),
    db.select().from(observations).orderBy(desc(observations.observedAt)).limit(20),
  ]);

  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--fg)] px-6 py-8 mono text-xs leading-relaxed">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-[10px] tracking-[0.25em] uppercase text-[var(--muted)]">
          Greenwich Park / Debug
        </h1>
        <Link
          href="/"
          className="text-[10px] tracking-[0.25em] uppercase text-[var(--muted)] hover:text-[var(--fg)]"
        >
          ← Back
        </Link>
      </header>

      <Section title="Current observation">
        <Field label="ID" value={observation.id} />
        <Field label="Observed at" value={isoLocal(observation.observedAt)} />
        <Field
          label="Refreshed on this request"
          value={refreshed ? "yes" : "no (served from DB)"}
        />
        <Field
          label="Score"
          value={`${observation.computedScore} (${observation.computedCategory})`}
        />
        <Field label="Confidence" value={observation.computedConfidence} />
      </Section>

      <Section title="Breakdown">
        <Field label="Base prior" value={observation.basePrior} />
        <Field label="Weather mod" value={observation.weatherMod} />
        <Field label="Traffic mod" value={observation.trafficMod} />
        <Field label="Holiday mod" value={observation.holidayMod} />
        <Field label="School mod" value={observation.schoolMod} />
        <Field label="Event mod" value={observation.eventMod} />
        <Field label="Raw sum" value={observation.rawSum} />
        <Field
          label="Closure capped"
          value={observation.closureCapped ? "yes" : "no"}
        />
      </Section>

      <Section title="Inputs · Weather">
        <Field label="ok" value={observation.weatherOk ? "yes" : "no"} />
        <Field label="Temp" value={`${observation.weatherTempF}°F`} />
        <Field label="Condition" value={observation.weatherCondition} />
        <Field
          label="Precipitation"
          value={`${observation.weatherPrecipitationIn} in`}
        />
        <Field label="Wind" value={`${observation.weatherWindMph} mph`} />
        <Field label="Is day" value={observation.weatherIsDay ? "yes" : "no"} />
      </Section>

      <Section title="Inputs · Traffic">
        <Field label="ok" value={observation.trafficOk ? "yes" : "no"} />
        <Field label="Severity" value={observation.trafficSeverity} />
        <Field
          label="Greenwich-relevant events"
          value={observation.trafficEventsRelevant}
        />
        <Field
          label="Total I-95 events"
          value={observation.trafficEventsTotal}
        />
        <Field
          label="NB affected"
          value={observation.trafficNorthboundAffected ? "yes" : "no"}
        />
        <Field
          label="SB affected"
          value={observation.trafficSouthboundAffected ? "yes" : "no"}
        />
        <Field
          label="Closure nearby"
          value={observation.trafficClosureNearby ? "yes" : "no"}
        />
      </Section>

      <Section title="Inputs · Time">
        <Field label="Local date" value={observation.localDate} />
        <Field label="Local hour" value={observation.hour} />
        <Field label="Day of week" value={observation.dayOfWeek} />
        <Field label="Weekend" value={observation.isWeekend ? "yes" : "no"} />
        <Field
          label="Holiday"
          value={
            observation.isHoliday
              ? `${observation.holidayName} (${observation.holidayKind})`
              : "no"
          }
        />
        <Field
          label="Public school in session"
          value={observation.publicInSession ? "yes" : "no"}
        />
        <Field
          label="Private school in session"
          value={observation.privateInSession ? "yes" : "no"}
        />
      </Section>

      <Section title="Forecast (next 4h, 15-min steps)">
        <table className="w-full text-[11px]">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="text-left py-1">Time (UTC)</th>
              <th className="text-left py-1">Local hr</th>
              <th className="text-right py-1">Score</th>
              <th className="text-right py-1">Category</th>
            </tr>
          </thead>
          <tbody>
            {forecast.points.map((p) => (
              <tr
                key={p.timestamp}
                className={
                  forecast.bestTime?.timestamp === p.timestamp
                    ? "text-[var(--fg)]"
                    : "text-[var(--muted)]"
                }
              >
                <td className="py-0.5">{p.timestamp.slice(0, 16)}</td>
                <td className="py-0.5">{p.localHour}</td>
                <td className="py-0.5 text-right">{p.score}</td>
                <td className="py-0.5 text-right">{p.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {forecast.bestTime && (
          <p className="mt-3 text-[var(--muted)]">
            best window: localHour={forecast.bestTime.localHour}, score=
            {forecast.bestTime.score}
          </p>
        )}
      </Section>

      <Section title={`Last ${recent.length} observations`}>
        <table className="w-full text-[11px]">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="text-left py-1">When</th>
              <th className="text-right py-1">Score</th>
              <th className="text-right py-1">Cat</th>
              <th className="text-right py-1">Conf</th>
              <th className="text-right py-1">W</th>
              <th className="text-right py-1">T</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="py-0.5">{isoLocal(r.observedAt)}</td>
                <td className="py-0.5 text-right">{r.computedScore}</td>
                <td className="py-0.5 text-right">{r.computedCategory}</td>
                <td className="py-0.5 text-right">{r.computedConfidence}</td>
                <td className="py-0.5 text-right">{r.weatherOk ? "✓" : "·"}</td>
                <td className="py-0.5 text-right">{r.trafficOk ? "✓" : "·"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Manual actions">
        <p className="text-[var(--muted)] mb-2">
          Force a new ingest (writes a row, bypasses 15-min cache):
        </p>
        <a
          href="/api/cron/ingest"
          className="inline-block border border-[var(--hairline)] px-3 py-2 text-[10px] tracking-[0.25em] uppercase hover:bg-[var(--hairline)]"
        >
          POST /api/cron/ingest
        </a>
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-[10px] tracking-[0.25em] uppercase text-[var(--muted)] mb-3 pb-2 border-b border-[var(--hairline)]">
        {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="grid grid-cols-[16rem_1fr] gap-2">
      <span className="text-[var(--muted)]">{label}</span>
      <span>{value === null || value === undefined ? "—" : String(value)}</span>
    </div>
  );
}

function isoLocal(t: Date | string): string {
  const d = t instanceof Date ? t : new Date(t);
  return d.toISOString().replace("T", " ").slice(0, 19);
}
