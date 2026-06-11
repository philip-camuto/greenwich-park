// Read-only probe of every external data source the ingest pipeline uses.
// Run: node --env-file=.env.local --import tsx analysis/probe_sources.ts
import { fetchGreenwichWeather } from "../src/lib/sources/openWeather";
import { fetchTomTomFlow } from "../src/lib/sources/tomTom";
import { fetchMetroNorthRidership } from "../src/lib/sources/metroNorth";
import { fetchMetroNorthAlerts } from "../src/lib/sources/metroNorthAlerts";
import { fetchGreenwichTraffic } from "../src/lib/sources/ctTravelSmart";

const probes: [string, () => Promise<unknown>][] = [
  ["weather", fetchGreenwichWeather],
  ["tomtom", fetchTomTomFlow],
  ["mnr-ridership", fetchMetroNorthRidership],
  ["mnr-alerts", fetchMetroNorthAlerts],
  ["ct511", fetchGreenwichTraffic],
];

async function main() {
  for (const [name, fn] of probes) {
    const t0 = Date.now();
    try {
      const v = await fn();
      console.log(`${name} OK ${Date.now() - t0}ms`, JSON.stringify(v).slice(0, 180));
    } catch (e) {
      console.log(`${name} THREW ${Date.now() - t0}ms`, String(e).slice(0, 200));
    }
  }
}

main();
