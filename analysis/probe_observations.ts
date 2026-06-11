// Read-only: daily ok-rates for each external input over the last 30 days,
// to pinpoint when the ingest inputs went dark.
// Run: node --env-file=.env.local --import tsx analysis/probe_observations.ts
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    select local_date,
           count(*) as n,
           round(avg(case when weather_ok then 1 else 0 end)::numeric, 2) as weather,
           round(avg(case when traffic_ok then 1 else 0 end)::numeric, 2) as ct511,
           round(avg(case when traffic_tomtom_ok then 1 else 0 end)::numeric, 2) as tomtom,
           round(avg(case when mta_ok then 1 else 0 end)::numeric, 2) as mta
    from observations
    where observed_at > now() - interval '30 days'
    group by local_date
    order by local_date desc
    limit 30`;
  for (const r of rows) {
    console.log(r.local_date, `n=${r.n}`, `weather=${r.weather}`, `ct511=${r.ct511}`, `tomtom=${r.tomtom}`, `mta=${r.mta}`);
  }
}
main();
