# Greenwich Park

Shows you when Greenwich Avenue is busy before you drive there.

A hyperlocal demand predictor for on-street parking on Greenwich Avenue, Greenwich CT. Designed to be opened on a phone in the car: glance, decide, drive.

Under the hood: a confound-corrected Poisson GLM (patrol-adjusted, log-exposure offset) trained on 21,892 FOIA'd citations, validated out-of-sample with forward-chaining cross-validation, fused with six live data feeds through a single deterministic scoring function under 227 unit tests. The trained surface was benchmarked against a LightGBM gradient-boosted alternative; the negative result and the decision to keep the GLM are documented in [docs/gbm-vs-glm-decision.md](docs/gbm-vs-glm-decision.md).

Live: https://parking.philipcamuto.com

## What it is

This is a **demand indicator**, not a parking finder. There is no live occupancy data yet. The score (0-100) is computed from:

- a **trained demand model** — a Poisson GLM fit on 21,892 FOIA'd parking citations (2022-2024), patrol-adjusted (citations per officer-day, so enforcement staffing isn't mistaken for demand) and validated on a held-out year. It supplies the day×hour demand surface inside the Mon-Sat 8am-4pm enforcement window; outside that window (no citation signal) a hand-calibrated prior takes over. Month and weather are deliberately **not** learned from citations — enforcement behaviour confounds them — so weather is a separate modifier (below). Training + holdout harness: [analysis/train_model.py](analysis/train_model.py); method, results, and honest limits: [docs/phase2-model-validation.md](docs/phase2-model-validation.md). Prior recalibration: [docs/citations-recalibration.md](docs/citations-recalibration.md)
- live weather from Open-Meteo
- live I-95 event feed from CTDOT 511
- live traffic flow from TomTom (preferred over CT 511 when available)
- daily Metro-North ridership from MTA Open Data
- real-time New Haven Line service alerts from the camsys feed used by mta.info
- aggregated special events from Eventbrite, Ticketmaster, and the town iCal
- holiday classification (closure / retail-spike / observed / none)
- school-calendar awareness for both Greenwich Public Schools **and** the local private schools (Brunswick, Greenwich Country Day, Greenwich Academy); their calendars diverge enough to matter, especially during the 2-week private spring break in early March

The trained model currently learns from the citation *proxy*. Later phases swap in real occupancy data (ParkMobile, camera pilot) and retrain on true occupancy labels via the same harness.

> **Note on the FOIA data:** the raw 21,892-citation dataset is not included in this repo. Only the derived, aggregated outputs are committed (`analysis/out/*.json`). The recalibration scripts document the method but can't reproduce it end-to-end without the source citations.

## Modeling & validation

The demand surface is a Poisson GLM, `citations ~ C(dow)*(cubic hour)` with a `log(officer-day exposure)` offset, so it estimates citations *per officer-day* (a demand rate) rather than raw citation volume. That offset is the core correction: a citation only exists if an officer was present, so unadjusted counts conflate how busy the street was with how many officers were working. Weather and month are kept *out* of the trained surface on purpose — enforcement behaviour confounds them — and handled as separately-estimated modifiers.

Validation is out-of-sample, never random k-fold (the data is temporal). Two harnesses: leave-one-year-out CV and, for the model comparison, forward-chaining (train past, test future). The honest result is that on a small surface (~54 in-window day×hour cells over 2–3 years) the model class is **saturated** — the trained GLM, a hand-tuned heuristic, and a regularized gradient-boosted tree are statistically indistinguishable. The ceiling is data, not algorithm.

Forward-chaining CV, all candidates recomputed under identical folds (lower Poisson deviance is better):

| model | test 2023 | test 2024 | pooled deviance | pooled MAE |
| --- | ---: | ---: | ---: | ---: |
| GBM-E1 (LightGBM) | 2560.3 | 1587.0 | 4147.3 | 63.80 |
| GBM-E2 (smoothed exposure) | 4449.9 | 4792.5 | 9242.5 | 95.04 |
| **GLM (shipped)** | **2673.2** | **1449.2** | **4122.4** | **66.57** |
| seasonal-mean baseline | 2541.7 | 2669.7 | 5211.4 | 64.23 |

The GLM wins pooled deviance by 0.6%, but the order flips on MAE and the models split by fold — a wash, not a win. On a tie you keep the simpler, already-shipped, already-validated model. The full reasoning (why a tree can't beat a 24-parameter cubic GLM on a `(dow, hour)` grid, why E2 fails, and the exact conditions that would flip the verdict — more citation-years, or Phase-4 real occupancy labels with non-linear weather×event interactions) is in [docs/gbm-vs-glm-decision.md](docs/gbm-vs-glm-decision.md).

Offset wiring was verified before any of the above was trusted: exposure-linearity (`pred(2·E) == 2·pred(E)`, proving the output is a rate × exposure, not a count) and offset reconciliation on an unregularized fit (`sum(rate·E) == sum(actual)`). Both pass; see [`analysis/out/gbm_report.json`](analysis/out/gbm_report.json). Training + holdout harness: [analysis/train_model.py](analysis/train_model.py); GBM benchmark: [analysis/train_gbm.py](analysis/train_gbm.py); method and limits: [docs/phase2-model-validation.md](docs/phase2-model-validation.md).

## Stack

- Next.js 16 App Router (Turbopack), TypeScript, Tailwind 4, React 19
- Drizzle ORM + Neon Postgres (provisioned via Vercel Marketplace)
- Vercel deployment, GitHub auto-deploy on push to `main`
- Vitest for unit tests (227)
- GitHub Actions cron for 30-min ingest (Vercel Cron's Hobby cap is too coarse)
- No client-side state. No animations. No auth on the public surface. No analytics.

## Run locally

```bash
cp .env.example .env.local       # then fill the keys
npm install
npm run dev                      # http://localhost:3000
npm test                         # vitest, 227 tests
npm run lint                     # eslint
npx tsc --noEmit                 # type-check
```

## Environment variables

See [`.env.example`](.env.example) for the full list and rotation notes. Short version:

| Var | Required? | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres. Pull with `vercel env pull .env.local`. |
| `CT_TRAVEL_SMART_API_KEY` | yes | CTDOT 511. Rate limit 10/60s. |
| `TOMTOM_API_KEY` | optional | TomTom Traffic Flow. Free tier covers our volume. |
| `TICKETMASTER_API_KEY` | optional | Ticketmaster Discovery. |
| `EVENTBRITE_API_KEY` | optional | Eventbrite OAuth private token. |
| `MTA_CAMSYS_KEY` | optional | MTA camsys key for real-time Metro-North alerts. Degrades gracefully to "unknown" when unset. |
| `CRON_SECRET` | recommended | Bearer auth for `/api/cron/ingest` and gate for `/debug`. |

Sources degrade gracefully when their key is missing — `ok: false` flows through the breakdown and the modifier returns 0.

## Deployment

Pushes to `main` auto-deploy to Vercel production. The custom domain `parking.philipcamuto.com` is attached to that project.

```bash
git push origin main             # auto-deploy via Vercel
vercel --prod                    # manual production deploy
vercel env pull .env.local       # refresh local env
```

Schema changes are applied with `drizzle-kit push`:

```bash
set -a && source .env.local && set +a
npx drizzle-kit push
```

Phase 1 still iterates fast — no migration files yet. When the schema stabilizes, switch to `drizzle-kit generate` + checked-in migrations.

## How the score is computed

```
score = base_prior[dayOfWeek][hour]
      + weatherMod         (rain -20, snow -40, 80°F+ sun +10, freezing -10, …)
      + trafficMod         (TomTom speedRatio preferred; CT 511 fallback)
      + holidayMod         (retail-spike +15, observed +3, closure handled as cap)
      + schoolMod          (weekday: all-in 0, mixed-break +3, all-out +5)
      + eventMod           (sum of firing special events, capped +20)
      + metroNorthMod      (ridership vs weekday/weekend baseline → ±8)
      + metroNorthAlertsMod (NH Line suspended +10, major +8, minor +3)

if holidayKind == "closure": score = min(score, 20)
score    = clamp(round(score), 0, 100)
category = score <= 40 ? "green" : score <= 70 ? "yellow" : "red"
```

Priors live in [`src/lib/model/priors.ts`](src/lib/model/priors.ts) as a 7×24 matrix with calibration reasoning in the file comments. To tune, edit values and bump the calibration date — don't add conditional logic.

The same `computeDemand()` function runs for the current snapshot, each of the 17 forecast slots (4h × 15min), and (Phase 3+) per block.

## Project layout

```
src/
  app/
    page.tsx                       main screen, day picker, hotspot list
    loading.tsx                    skeleton matching the desktop layout
    error.tsx                      client error boundary
    hotspot/[id]/page.tsx          drill-down per hotspot
    debug/page.tsx                 raw inputs + breakdown + recent history (auth-gated)
    api/cron/ingest/route.ts       writes one observation row
    api/demand/current/route.ts    latest score + breakdown + inputs
    api/demand/forecast/route.ts   4h forecast in 15-min steps
  lib/
    sources/
      openWeather.ts               Open-Meteo current + hourly
      ctTravelSmart.ts             CTDOT 511 event feed, Greenwich-exit filter
      tomTom.ts                    TomTom Traffic Flow Segment Data
      metroNorth.ts                MTA daily ridership (Socrata, mode='MNR')
      metroNorthAlerts.ts          Real-time NH Line alerts (camsys)
      eventbrite.ts                Eventbrite Discovery
      ticketmaster.ts              Ticketmaster Discovery
      townICal.ts                  Town of Greenwich iCal
      events.ts                    Aggregates Eventbrite + Ticketmaster + iCal
      timeFeatures.ts              tz-aware hour/dow/holiday/school
      citations.ts                 FOIA citations (historical, in citations_raw; priors recalibrated)
      parkMobile.ts                Phase 3 partnership stub
      cameraFeed.ts                Phase 4 Pi/YOLO stub
    model/
      heuristic.ts                 pure scoring function
      priors.ts                    7×24 demand-by-hour-and-dow
      types.ts                     shared types
    db/
      schema.ts                    observations table
      client.ts                    Drizzle + Neon HTTP driver
    inventory/data.ts              static zone inventory (Phase 1)
    forecast.ts                    4h projection helper
    ingest.ts                      single write path used by both routes
    per-block.ts                   block-level scoring (capacity / relief / time / anchor)
    hotspots.ts                    hotspot → block mapping
    day-param.ts                   ?day=YYYY-MM-DD + ?time=HH:MM parsing
    copy.ts                        verdict / action copy strings
    utils/time.ts                  GREENWICH_TZ constant
  components/
    ScoreCard.tsx                  verdict + score/100 + action copy
    ForecastChart.tsx              tappable 4h curve, best-time dot
    AvenueMap.tsx                  Greenwich Ave block diagram
    DaySegmentedControl.tsx        day picker, opens the bottom sheet
    DatePickerSheet.tsx            bottom-sheet date + time picker
    HotspotList.tsx                hotspot rows
    HotspotRow.tsx                 single hotspot link
    SectionCaption.tsx             uppercase rubric labels
    Card.tsx                       12pt-radius card primitive
    BackLink.tsx                   ‹ Back link
    avenue-map-data.ts             block + node geometry for AvenueMap
```

## Parking inventory

A static inventory of downtown Greenwich parking zones lives at [`src/lib/inventory/data.ts`](src/lib/inventory/data.ts). It defines 12 zones split into three types:

| Type | Zones | Estimated spaces |
| --- | --- | --- |
| On-Ave street parking | 6 | ~231 |
| Side streets feeding the Ave | 1 | ~55 |
| Off-Ave rear lots | 5 | ~443 |
| **Total downtown** | **12** | **~729** |

Numbers are derived from satellite imagery on 2026-05-12 and are **estimates pending FOIA verification** with Greenwich Parking Services. They are not measured.

When Greenwich Parking Services confirms counts (or once camera/citation data is in hand), update `PARKING_ZONES[].estimatedSpaces` directly and bump `INVENTORY_SOURCE_DATE`.

The `observations_by_zone` table in [`src/lib/db/schema.ts`](src/lib/db/schema.ts) is prepared to receive per-zone occupancy data in Phase 3. It is empty in Phase 1.

## Phase map

| Phase | Status | What plugs in where |
| --- | --- | --- |
| 1 | this build | Public signals + heuristic. Live now. |
| 2 | next | 12-month historical backfill. Trained model replaces `heuristic.ts` wholesale, same `ModelInput` shape. |
| 3 | FOIA data received 2026-06-11 | 21,892 citations (2022-2024) in `citations_raw`; priors recalibrated for the enforcement window. No live feed exists — `parkMobile.ts` still pending for real-time proxies. |
| 4 | pending Greenwich Parking Svcs | `cameraFeed.ts` Raspberry Pi YOLO ground truth replaces priors. |

## Honest framing

No ground-truth occupancy data exists yet. The score is a model of *demand*, not availability. Phase 3+ closes that gap with citation data and camera observations.

## License

MIT
