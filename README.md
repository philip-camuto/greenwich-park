# Greenwich Park

Shows you when Greenwich Avenue is busy before you drive there.

Phase 1 = demand predictor from public signals (CT Travel Smart traffic + OpenWeather + time-of-day priors). No ground truth yet. Phase 2 backfills historical data and trains a real model. Phase 3 ingests FOIA citation data. Phase 4 adds live camera occupancy from a Raspberry Pi pilot.

## Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript, Tailwind 4
- Drizzle ORM + Neon Postgres (via Vercel Marketplace)
- Deployed on Vercel
- On-demand ingestion with 15-min runtime cache (no Vercel Cron required on Hobby)

## Local dev

```bash
cp .env.example .env.local   # fill in keys
npm install
npm run dev
```

## Tests

```bash
npm run test
```

## Environment variables

| Var | Where to get it |
| --- | --- |
| `CT_TRAVEL_SMART_API_KEY` | CTDOT developer portal. Rate limit 10/60s. |
| `DATABASE_URL` | Auto-provisioned by Neon integration on Vercel. Pull with `vercel env pull .env.local`. |
| `CRON_SECRET` | Optional. Bearer required on `/api/cron/ingest` when set. |

Weather uses **Open-Meteo** (https://open-meteo.com) which needs no key. If you ever want to swap providers, the seam is `src/lib/sources/openWeather.ts`.

## Project layout

```
src/
  app/
    page.tsx                       main screen (Step 7)
    api/cron/ingest/route.ts       on-demand + future cron entrypoint
    api/demand/current/route.ts    latest demand score
    api/demand/forecast/route.ts   4-hour projection
  lib/
    sources/
      ctTravelSmart.ts             I-95 events near Greenwich exits (CTDOT 511)
      openWeather.ts               Open-Meteo current + hourly forecast
      timeFeatures.ts              hour/dow/weekend/holiday
      citations.ts                 Phase 3 FOIA stub
      parkMobile.ts                Phase 3 partnership stub
      cameraFeed.ts                Phase 4 Pi/YOLO stub
    model/
      heuristic.ts                 Phase 1 scoring function
      priors.ts                    hardcoded demand-by-hour-and-dow
      types.ts
    db/
      schema.ts                    observations table
      client.ts                    Drizzle + Neon HTTP driver
    utils/time.ts
  components/
    DemandScore.tsx
    ForecastChart.tsx
    BestTimeCallout.tsx
    Settings.tsx
```

## Phase map

| Phase | Status | What plugs in where |
| --- | --- | --- |
| 1 | this build | public signals + heuristic |
| 2 | next | historical backfill + trained model replaces `heuristic.ts` |
| 3 | future | `citations.ts` + `parkMobile.ts` feed the model |
| 4 | future | `cameraFeed.ts` ground truth replaces priors |

## Honest framing

No ground-truth occupancy data exists yet. Phase 1 is a demand *indicator*, not a parking finder.
