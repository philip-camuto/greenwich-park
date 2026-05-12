# Greenwich Park

Shows you when Greenwich Avenue is busy before you drive there.

A hyperlocal demand predictor for on-street parking on Greenwich Avenue, Greenwich CT. Designed to be opened on a phone in the car: glance, decide, drive.

Live: https://greenwich-park.vercel.app · Debug: https://greenwich-park.vercel.app/debug

## What it is

Phase 1 is a **demand indicator**, not a parking finder. There is no live occupancy data yet. The score (0-100) is computed from:

- a hardcoded prior matrix calibrated by a frequent local user (the dominant signal)
- live weather from Open-Meteo
- live I-95 event feed from CTDOT 511 (the only endpoint exposed on our API key)
- holiday classification (closure / retail-spike / observed / none)
- school calendar awareness for both Greenwich Public Schools **and** the local private schools (Brunswick, Greenwich Country Day, Greenwich Academy) — their calendars diverge enough to matter, especially during the 2-week private spring break in early March

Phases 2-4 progressively swap public signals for real occupancy data (FOIA citations, ParkMobile, camera pilot).

## Stack

- Next.js 16 App Router (Turbopack), TypeScript, Tailwind 4
- Drizzle ORM + Neon Postgres (provisioned via Vercel Marketplace)
- Vercel deployment, GitHub auto-deploy on push to `main`
- Vitest for unit tests (104 passing)
- No client-side state. No animations. No auth. No analytics.
- **No Vercel Cron** — Hobby plan caps frequency too aggressively for 15-min ingestion. Instead, `/api/demand/current` runs the ingest pipeline on cache miss (15-min freshness window).

## Run locally

```bash
cp .env.example .env.local       # then fill the keys below
npm install
npm run dev                      # http://localhost:3000
npm run test                     # vitest
npm run lint                     # eslint
npx tsc --noEmit                 # type-check
```

## Environment variables

| Var | Required? | Where to get it |
| --- | --- | --- |
| `CT_TRAVEL_SMART_API_KEY` | yes | CTDOT 511 developer portal. Rate limit 10/60s. |
| `DATABASE_URL` | yes | Auto-provisioned by the Neon Marketplace integration on Vercel. Pull with `vercel env pull .env.local`. |
| `CRON_SECRET` | no | When set, requires `Authorization: Bearer …` on `/api/cron/ingest`. |

Weather uses [Open-Meteo](https://open-meteo.com) which needs no key. To swap providers, edit `src/lib/sources/openWeather.ts` — the public function signature is the seam.

## Deployment

The repo is connected to a Vercel project. Pushes to `main` auto-deploy.

```bash
git push origin main             # production deploy via Vercel
vercel --prod                    # manual production deploy
vercel env pull .env.local       # refresh local env after changes in Vercel UI
```

Neon schema changes are applied with:

```bash
set -a && source .env.local && set +a
npx drizzle-kit push
```

Phase 1 is iterating fast — no migration files yet. When the schema stabilizes, switch to `drizzle-kit generate` + checked-in migrations.

## How the score is computed

```
score = base_prior[dayOfWeek][hour]
      + weatherMod      (rain -20, snow -40, 80F+ sun +10, etc)
      + trafficMod      (severity-based +0..+8, closure -5)
      + holidayMod      (retail-spike +15, observed +3, closure handled as cap)
      + schoolMod       (weekday: all-in 0, partial-break +3, all-out +5)
      + eventMod        (special-event boost, currently always 0)

if holidayKind == "closure": score = min(score, 20)
score = clamp(round(score), 0, 100)
category = score <= 40 ? "green" : score <= 70 ? "yellow" : "red"
```

The priors live in [`src/lib/model/priors.ts`](src/lib/model/priors.ts) as a 7×24 matrix with calibration reasoning in the file comments. To tune, edit the values and bump the calibration date — don't add conditional logic to the file.

## Project layout

```
src/
  app/
    page.tsx                       main screen (server component)
    loading.tsx                    skeleton (Step 8)
    error.tsx                      client error boundary (Step 8)
    debug/page.tsx                 raw inputs + breakdown + last 20 obs
    api/cron/ingest/route.ts       writes one observation row
    api/demand/current/route.ts    latest score + breakdown + inputs
    api/demand/forecast/route.ts   4h forecast in 15-min steps
  lib/
    sources/
      ctTravelSmart.ts             CTDOT 511 event feed, Greenwich exit filter
      openWeather.ts               Open-Meteo current + hourly
      timeFeatures.ts              tz-aware hour/dow/holiday/school
      citations.ts                 Phase 3 FOIA stub
      parkMobile.ts                Phase 3 partnership stub
      cameraFeed.ts                Phase 4 Pi/YOLO stub
    model/
      heuristic.ts                 pure scoring function
      priors.ts                    7×24 demand-by-hour-and-dow
      types.ts                     all shared types
    db/
      schema.ts                    observations table
      client.ts                    Drizzle + Neon HTTP driver
    forecast.ts                    4h projection helper
    ingest.ts                      single write path used by both routes
    utils/time.ts                  GREENWICH_TZ constant
  components/
    DemandScore.tsx                massive number, status, low-signal pill
    ForecastChart.tsx              inline SVG, smoothed curve, best-time dot
    BestTimeCallout.tsx            "Try around 9:00 PM" copy
    Settings.tsx                   stub (Phase 1 has no settings)
```

## Phase map

| Phase | Status | What plugs in where |
| --- | --- | --- |
| 1 | this build | Public signals + heuristic. Live now. |
| 2 | next | 12-month historical backfill. Trained model replaces `heuristic.ts` wholesale, same `ModelInput` shape. |
| 3 | pending FOIA | `citations.ts` + `parkMobile.ts` (if partnership approved) feed real demand proxies. |
| 4 | pending Greenwich Parking Svcs | `cameraFeed.ts` Raspberry Pi YOLO ground truth replaces priors. |

## Honest framing

No ground-truth occupancy data exists yet. The score is a model of *demand*, not availability. Phase 3+ closes that gap with citation data and camera observations.
