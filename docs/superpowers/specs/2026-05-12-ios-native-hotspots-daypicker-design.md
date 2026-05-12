# iOS-native redesign + hotspots + day picker

**Date:** 2026-05-12
**Status:** Design draft, awaiting user approval before plan/implementation
**Project:** greenwich-park (https://parking.philipcamuto.com)
**Supersedes UI direction in:** `2026-05-12-light-redesign-with-ave-map-design.md` (shipped this morning; we are pivoting the visual language)

## Why

Three pieces of user direction:

1. **"More like a Google/Apple native vibe."** Pivot away from the Spectral italic editorial register to iOS native — SF Pro Display/Text/Mono, grouped-inset cards, segmented controls, system colors.
2. **"I want to see different parts of the Ave."** Surface the four hotspots — Ginger Man, Terra, Moli, Hinoki — as their own surface, with the implication that per-block demand is meaningful (even if Phase 1 data doesn't truly support that yet — see "Per-block resolution" below).
3. **"Day picker for tomorrow."** Let users see the demand forecast for tomorrow (and up to ~7 days out), not just the next 4 hours from now.

The data layer (heuristic, sources, db, ingest, forecast pipeline) is untouched except for one extension: `buildForecastForGreenwich` accepts a target date.

## Goals

- **iOS-native register.** SF Pro system font stack, light gray group bg, white grouped-inset rounded cards, iOS segmented control for day picker, system colors for state (green / orange / red).
- **App Store list pattern.** Score card on top → hotspots list → forecast chart → map. Each section is a grouped-inset card with a small uppercase caption above it ("HOTSPOTS", "NEXT 4 HOURS", "GREENWICH AVENUE").
- **Drill-down per hotspot.** Tap a hotspot row → navigate to `/hotspot/[id]` showing that block's score + forecast + a note about which block it sits on.
- **Day picker.** Segmented control above the score: `Today | Tomorrow | + Pick day`. The "+ Pick day" button opens a sheet with a date input (up to 7 days out). The forecast and score reflect the chosen day.
- **Per-block prediction (Phase 1.5).** Each block gets a small static offset (-5 to +5) baked into the priors module so the hotspot rows show subtly different numbers. Explicit honesty in copy: "Per-block scores use stylized offsets; Phase 3 FOIA data will replace these with measured demand."

## Non-goals

- No real per-block ML in Phase 1. The static offsets are calibration guesses, not learned values.
- No native-app conversion (still a web PWA — looks iOS, runs in Safari).
- No new external API. The CTDOT and Open-Meteo plumbing is reused.
- No animations or transitions beyond standard iOS conventions (page transitions on drill-down, no fancy springs).
- No live cam (still rejected per CTDOT TOS).

## Design language

### Typography — SF Pro system stack

```css
--font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display",
                "Segoe UI", Roboto, system-ui, sans-serif;
--font-text: -apple-system, BlinkMacSystemFont, "SF Pro Text",
             "Segoe UI", Roboto, system-ui, sans-serif;
--font-mono: ui-monospace, "SF Mono", Menlo, "JetBrains Mono", monospace;
```

Apple users see real SF Pro. Everyone else degrades to their OS sans (Segoe UI on Windows, system-ui on Linux). No web-font downloads. Removes Spectral + JetBrains Mono `next/font/google` calls from `layout.tsx`.

Type scale follows Apple HIG roughly:

| Use | Size | Weight | Family |
|---|---|---|---|
| Title (e.g., "Parking on Greenwich Avenue") | 34pt | 700 | display |
| Subtitle ("Greenwich · CT · just now") | 13pt | 400 | text, secondary |
| Verdict ("Moderately busy") | 28pt | 600 | display |
| Score number ("62") | 17pt | 500 | mono |
| Section caption ("HOTSPOTS") | 13pt | 600 | text, uppercase, tracking 0.06em |
| Row title (hotspot name) | 17pt | 500 | text |
| Row score | 17pt | 500 | mono, secondary color |
| Body / action sentence | 17pt | 400 | text |
| Footnote / disclaimer | 13pt | 400 | text, tertiary color |

### Color tokens

```css
:root {
  --bg-group: #f2f2f7;        /* iOS systemGroupedBackground (light) */
  --bg-surface: #ffffff;       /* white cards */
  --label-primary: #000000;
  --label-secondary: rgba(60,60,67,0.6);  /* iOS secondaryLabel */
  --label-tertiary:  rgba(60,60,67,0.3);
  --separator: rgba(60,60,67,0.18);       /* hairlines between cards */
  --separator-inset: rgba(60,60,67,0.36); /* row dividers inside cards */
  --link: #007aff;             /* iOS systemBlue */

  /* State (iOS system colors) */
  --state-quiet: #34c759;      /* systemGreen */
  --state-busy:  #ff9500;      /* systemOrange */
  --state-tough: #ff3b30;      /* systemRed */
}
```

### Components

| Surface | Treatment |
|---|---|
| Page background | `--bg-group` |
| Card | white, 12pt corner radius, no shadow (Apple inset table style), 16pt horizontal padding |
| Section caption | `--label-secondary`, 13pt, uppercase, tracking 0.06em, 16pt left padding, 8pt below |
| Row divider inside card | 0.5px line in `--separator-inset`, inset 16pt from left edge |
| Segmented control | 32pt height, 8pt radius, gray track `#E5E5EA`, selected segment white with subtle shadow + black text, unselected segments transparent with `--label-secondary` text |
| Chevron (›) | SF Symbols `chevron.right`, `--label-tertiary`, 13pt |

## Layout

Mobile-first, max-width 640pt, centered, identical structure on desktop with breath padding:

```
   ─────────────────────────────────────────
   
   Parking on Greenwich Avenue            34/700
   Greenwich · CT · just now              13/400 secondary
   
   [Today]  [Tomorrow]  [+ Pick day]      segmented control
   
   ┌─────────────────────────────────┐
   │  Moderately busy                │  ← white card, 12pt radius
   │  62 / 100                       │
   │  Easier around 9:00 PM.         │
   └─────────────────────────────────┘
   
   HOTSPOTS
   ┌─────────────────────────────────┐
   │  The Ginger Man          62  › │
   │  ──────────────────             │  ← inset divider
   │  Terra                   62  › │
   │  ──────────────────             │
   │  Rag & Bone              62  › │
   │  ──────────────────             │
   │  Hinoki                  62  › │
   └─────────────────────────────────┘
   Per-block scores currently use stylized offsets.
   Phase 3 will replace them with measured demand.
   
   NEXT 4 HOURS
   ┌─────────────────────────────────┐
   │  [line chart]                   │
   │  Now      +2h      +4h          │
   └─────────────────────────────────┘
   
   GREENWICH AVENUE
   ┌─────────────────────────────────┐
   │  [SVG schematic, restyled]      │
   │  Hover or tap a block           │
   └─────────────────────────────────┘
   
   Public data + heuristics.
   Not a guarantee of availability.
```

Padding: 16pt horizontal on mobile, 32pt on desktop. Card spacing: 16pt vertical gap. Section captions 8pt above the next card.

## Hotspots — data + per-block prediction

### The 4 hotspots

| ID | Name | Address | Block (north-south on Ave) | Notes |
|---|---|---|---|---|
| `ginger-man` | The Ginger Man | 64 Greenwich Ave | Lower (Havemeyer → Arch) | Pub, south-mid |
| `terra` | Terra | 156 Greenwich Ave | Mid (Lewis → Mason) | Italian, middle of Ave |
| `rag-bone` | Rag & Bone | 50 Greenwich Ave | Lower (Havemeyer → Arch) | Retail, south-mid |
| `hinoki` | Hinoki | 298 Greenwich Ave | Upper-mid (Lewis → Mason) | Sushi |

(Addresses on Greenwich Ave increase going north. 1-99 = south end near Metro-North, 100s-200s = middle, 300+ = north end near Saks/Putnam.)

Hotspots reference the existing block IDs in `avenue-map-data.ts`.

### Phase 1.5 per-block static offsets

Add an optional `offset: number` field to each `AvenueBlock` definition. Compute the per-block score as `clamp(globalScore + offset, 0, 100)`. Same category mapping. Initial offsets (calibration guess, document the rationale in comments):

| Block | Offset | Reasoning |
|---|---|---|
| Lafayette/Putnam → Elm | +3 | Top of the Ave — Saks/Tiffany/Prada cluster, busier on shopping days |
| Elm → Lewis | +2 | Upper-mid — Ginger Man + Maman, busy AM coffee + lunch |
| Lewis → Mason | 0 | Mid baseline |
| Mason → Havemeyer | -2 | Lower-mid — less foot traffic |
| Havemeyer → Arch | +1 | Above Metro-North — restaurant clusters |
| Arch → Steamboat | -3 | Bottom — closer to station, fewer destinations |

Offsets sum to +1 (basically neutral on average), preserving the global score's role as the average. Honest disclosure: a footnote under the hotspots list states these are stylized offsets that Phase 3 FOIA data will replace.

### Hotspot drill-down route

New route: `app/hotspot/[id]/page.tsx`.

Layout:
```
   ‹ Back                              13/500 systemBlue
   
   The Ginger Man                       34/700
   Upper Ave · Elm St to Lewis Ct      13 secondary
   
   ┌──────────────────────────┐
   │  Moderately busy         │
   │  64 / 100                │
   │  Easier around 9:00 PM.  │
   └──────────────────────────┘
   
   NEXT 4 HOURS
   ┌──────────────────────────┐
   │  [line chart]            │
   └──────────────────────────┘
   
   Block-level resolution arrives with
   Phase 3 (FOIA citation data).
```

Same forecast pipeline; the per-block score is the global score + this block's offset.

## Day picker

Three options visible: `Today | Tomorrow | + Pick day`.

- **Today (default).** Behavior unchanged from current — forecast starts now.
- **Tomorrow.** Forecast starts at 8am tomorrow (Greenwich-local), runs 4 hours. Or: runs all-day in 1h steps? **Decision: keep 4h window. Start at 8am tomorrow.** Users can scroll the day picker forward and we render the next 4 hours from a sensible anchor (8am for future days).
- **+ Pick day.** Opens a bottom sheet with a native `<input type="date">` constrained `min=today, max=today+7`. On select, treat like "Tomorrow" anchor (8am that day).

### Backend change

`src/lib/forecast.ts` — `buildForecastForGreenwich(target?: { startAt: Date })` accepts an optional anchor. When target is in the future:
- Pull Open-Meteo with `forecast_days=7` (was `forecast_days=2`).
- 16 steps × 15 min from `startAt`.
- Weather: look up hourly slot containing each step's timestamp. If beyond hourly horizon, fall back to `{ ok: false, condition: "unknown" }`.
- Traffic: use the **current** traffic snapshot (no traffic forecast available). For future days, traffic snapshot is essentially noise → set `traffic.ok = false` on the per-future-day call so confidence drops.
- Time features: computed at each step's timestamp (handles holiday + school correctly for tomorrow + day after, etc).
- The heuristic runs unchanged.

`getOrRefreshObservation` is unchanged — observations always reflect "now" and are stored at `observedAt`. The day picker only changes what we DISPLAY in the score card; the persisted observation stays current.

### Page state

`page.tsx` becomes a Server Component that reads a `?day=` search param (`today` | `tomorrow` | a YYYY-MM-DD date string). Defaults to `today`. The segmented control is a small Client Component that pushes to `/?day=tomorrow` etc.

For "Today", we display the current observation's score + the live forecast.
For other days, we display the heuristic computed for that day's anchor + the future forecast.

## Components

### New files

- `src/app/page.tsx` — restructured (server-rendered, reads `?day` search param)
- `src/components/DaySegmentedControl.tsx` — client component, updates URL
- `src/components/ScoreCard.tsx` — replaces `DemandScore.tsx` (white card register)
- `src/components/HotspotList.tsx` — server component, renders 4 rows
- `src/components/HotspotRow.tsx` — name + score + chevron, links to `/hotspot/[id]`
- `src/components/SectionCaption.tsx` — the uppercase tracked text above each card
- `src/components/Card.tsx` — the white grouped-inset wrapper
- `src/app/hotspot/[id]/page.tsx` — drill-down per hotspot
- `src/components/BackLink.tsx` — iOS-style "‹ Back" link
- `src/lib/hotspots.ts` — the 4 hotspots metadata (id, name, block ID, address sub-label)
- `src/lib/hotspots.test.ts` — sanity tests on hotspot data shape

### Modified files

- `src/app/globals.css` — full token rewrite (iOS color system, SF stack)
- `src/app/layout.tsx` — drop `next/font/google` Spectral + JetBrains; use system stack
- `src/components/ForecastChart.tsx` — re-theme for iOS card register (subtle, keep curve)
- `src/components/AvenueMap.tsx` — re-theme inside iOS card (colors via new tokens)
- `src/components/avenue-map-data.ts` — add `offset` to `AvenueBlock` (default 0; six concrete offsets)
- `src/lib/copy.ts` — unchanged. `verdictFor` is reused for per-block scores (same category mapping applies).
- `src/lib/forecast.ts` — extend `buildForecastForGreenwich` with optional `startAt`
- `src/app/loading.tsx` + `src/app/error.tsx` — re-theme iOS register
- `src/app/icon.tsx` + `src/app/apple-icon.tsx` + `src/app/manifest.ts` — bg → `#F2F2F7`, glyph → "P" in `fontFamily: "system-ui, -apple-system, sans-serif"` (note: Next's `ImageResponse` runs in the Edge runtime, which does not have access to OS fonts including SF Pro; the closest browser-rendered approximation is Helvetica/Arial, which is what `system-ui` resolves to at edge-build time). Acceptable degradation.

### Removed

- `src/components/DemandScore.tsx` — replaced by `ScoreCard.tsx`
- `src/components/BestTimeCallout.tsx` — its sentence merges into `ScoreCard` (action copy already lives in the same card per the new layout; the standalone Best-time card goes away)

Wait, reconsider: the layout sketch above doesn't include a separate "Best in next 4h" section. That's because the action copy ("Easier around 9:00 PM") is already inside the ScoreCard. The separate `<BestTimeCallout />` becomes redundant. Delete the file.

## Data flow

```
URL ?day=today|tomorrow|YYYY-MM-DD
   │
   ▼
page.tsx (Server Component)
   ├── parse day param
   ├── fetch current observation (for "today" only)
   ├── buildForecastForGreenwich({ startAt: derived from day })
   └── derive perBlockScores: BLOCKS.map(b => clamp(globalScore + b.offset, 0, 100))
        │
        ▼
   ScoreCard (verdict + score + action)
   HotspotList → HotspotRow × 4 (each shows perBlockScores[block])
   ForecastChart (points from buildForecast)
   AvenueMap (tinted by per-block category)
   
   Footer
```

## ML / per-block prediction — explicit honest framing

The Phase 1 static offsets are **calibration guesses**, not predictions. They're labeled as such in UI copy:

> "Per-block scores currently use stylized offsets. Phase 3 (FOIA citation data) replaces them with measured demand."

This appears below the hotspots list AND under the hotspot detail page. No fake confidence.

Path to real per-block ML:

1. **Phase 2 model training** uses the accumulated `observations` rows. The trained model produces a single global score (same shape as today). Per-block resolution still requires Phase 3 data.
2. **Phase 3 FOIA citation data** populates a new `citations_raw` table; per-block density (per 15-min bucket) becomes the per-block label.
3. **Phase 4 camera** validates everything against ground-truth occupancy at one lot.

## Accessibility

- The verdict word becomes `<h1>` on each page (main, each hotspot drill-down).
- Segmented control buttons are real `<button>` elements with `aria-pressed` reflecting selected state.
- Hotspot rows are `<Link>` with descriptive accessible names ("The Ginger Man, demand 62 of 100, view forecast").
- iOS system colors meet WCAG AA on white at large text sizes; verify systemOrange (#FF9500) on `--bg-group` — likely 3.4:1 which is below AA for normal text but fine for large text (24pt+). The verdict at 28pt is large text by WCAG definition, so this works.
- All cards are real semantic regions; section captions are visible labels for screen readers (no extra aria needed).

## Testing strategy

1. **Existing 119 tests stay green.** Heuristic, sources, time features, forecast all unchanged in behavior.
2. **New tests:**
   - `src/lib/hotspots.test.ts` — 4 hotspots, each maps to a valid block ID
   - `src/components/HotspotList.test.tsx` — renders 4 rows with correct names and scores; each row links to `/hotspot/[id]`
   - `src/components/DaySegmentedControl.test.tsx` — selecting a segment updates URL
   - Extend `src/lib/forecast.test.ts` — `buildForecast` with `startAt` 24h in future produces points starting at the correct timestamp
3. **Visual smoke:** open production URL on iPhone after deploy. Check segmented control feels native (rounded, animated selection), cards have proper rounded corners, fonts read as SF Pro.
4. **Lighthouse:** target ≥95 mobile perf, 100 A11y / BP / SEO.

## Migration

Non-additive rewrite of the UI layer. After Task 10 ships:
- The Spectral + JetBrains Mono web fonts are gone (saves ~120KB FOUT-free).
- The light editorial register is replaced. Rollback via `git revert` of the merge commit.
- API routes, db schema, ingest, heuristic, forecast logic untouched (one additive extension).

## Out of scope (deferred)

- Real per-block model (Phase 3).
- Block-by-block UI tinting on the SVG map driven by per-block offsets — currently the schematic still uses a single category for all blocks; per-block tinting can come later once we trust the offsets.
- Real iOS app conversion. Stays a PWA.
- Date picker beyond 7 days. Open-Meteo's free tier covers 7 days; beyond that we'd need a paid plan.
- Map zoom / pan (still M2 territory).
- Notifications, geolocation, push (out of scope for redesign).
