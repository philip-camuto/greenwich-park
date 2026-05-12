# Light editorial redesign + Greenwich Avenue map

**Date:** 2026-05-12
**Status:** Design draft, awaiting user approval before plan/implementation
**Project:** greenwich-park (https://parking.philipcamuto.com)

## Why

Two pieces of user feedback against the current dark-cockpit design:

1. **"The score is not clear what it means."** A naked `55` doesn't tell anyone what action to take. The number leads, but the verdict trails — the wrong way around for a glance-while-driving use case.
2. **"Make it clear it's only for Greenwich Avenue."** The current title "Greenwich Park" collides with the famous London park and several CT parks, and doesn't tell visitors the app's scope (one specific street).

Plus a follow-on direction:

3. **"White, and looks good on mobile and desktop."** Pivot from the dark cockpit register to a light editorial one. Equally usable on phone in the car and on a laptop.
4. **"Little interactive map of the Ave."** Add a place-sense element — a hand-drawn SVG schematic of the six blocks of Greenwich Avenue with hover/tap states.

## Goals

- **Verdict-led hero.** A plain-English status word ("Plenty of spots", "Moderately busy", "Tough today") is the visual centerpiece; the 0-100 score becomes supporting evidence in plain text.
- **Geography explicit.** Title is "Parking on Greenwich Avenue", subtitle includes "Greenwich · Connecticut" so anyone landing on the page understands scope in one second.
- **Light editorial register.** Off-white canvas (`#FAFAF8`), near-black text, hairline dividers only, single column ~640px max measure, identical structure on mobile and desktop.
- **Schematic map of the Ave** as a small visual element below the forecast. Six blocks defined by seven cross-street nodes, hover/tap to highlight a block. Phase 1 ships with global demand applied to all blocks; per-block resolution is a Phase 3 feature (FOIA citation data).
- **No regression on the data.** Heuristic, sources, db schema, ingest pipeline, forecast logic all stay exactly as-is. This is a UI redesign + one new component.

## Non-goals

- No new data sources.
- No live cam (CTDOT TOS forbids embedding; Windy was considered and rejected to stay in our own design register).
- No client-side state machine beyond hover/tap on the map.
- No mobile-vs-desktop layout reflow — same column, same order, different padding.
- No dark mode toggle. Light-only ships. Dark can be added later if needed.

## Layout

Single column, 640px max measure, centered. Identical on every viewport. Top padding scales: `48px` mobile, `96px` desktop. Horizontal padding: `24px` mobile, `48px` desktop.

```
   ╭─────────────────────────────────────────────╮
   │                                             │
   │  GREENWICH AVENUE · TUE 3:42 PM             │
   │                                             │
   │  Moderately busy                            │
   │  62 / 100                                   │
   │                                             │
   │  Easier in about an hour.                   │
   │                                             │
   │  ─────────────────────────────────          │
   │  FORECAST · NEXT 4 HOURS                    │
   │                                             │
   │  [flat 1px sparkline, single dot at "now"]  │
   │  Now            +2h            +4h          │
   │                                             │
   │  ─────────────────────────────────          │
   │  GREENWICH AVENUE                           │
   │                                             │
   │  [vertical SVG schematic of the Ave,        │
   │   blocks between cross streets, hover-able] │
   │                                             │
   │  Block-level demand in Phase 3 (FOIA).      │
   │  Today, all blocks share the global score.  │
   │                                             │
   │  ─────────────────────────────────          │
   │  BEST IN NEXT 4 HOURS                       │
   │                                             │
   │  Try around 9:00 PM for easier parking.     │
   │                                             │
   │  ─────────────────────────────────          │
   │                                             │
   │  Public data + heuristics. Not a guarantee  │
   │  of availability.                           │
   │                                             │
   ╰─────────────────────────────────────────────╯
```

### Section order

1. **Eyebrow + verdict + score + action**
2. **Forecast** (eyebrow + sparkline + ticks)
3. **Greenwich Avenue map** (eyebrow + SVG + Phase-3 disclaimer)
4. **Best time** (eyebrow + italic sentence)
5. **Footer disclaimer**

Each section separated by a 1px `#E5E5E5` hairline. No cards, no rounded containers, no shadows. Hairlines are the only visual divider.

## Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#FAFAF8` | warm off-white canvas |
| `--fg` | `#111111` | primary text, the verdict word |
| `--muted` | `#6B6B6B` | metadata, eyebrows, supporting copy |
| `--hairline` | `#E5E5E5` | the only divider |
| `--map-line` | `#1F1F1F` | map strokes for the Ave + cross streets |
| `--map-fill-quiet` | `#D9EAE0` | block fill when category=green |
| `--map-fill-busy` | `#F2E2C9` | block fill when category=yellow |
| `--map-fill-tough` | `#F0D2D2` | block fill when category=red |
| `--accent-quiet` | `#1A5D40` (forest) | verdict color when green |
| `--accent-busy` | `#8C5A2A` (sienna) | verdict color when yellow |
| `--accent-tough` | `#9B2C2C` (deep red) | verdict color when red |
| max measure | `640px` | identical across viewports |
| top padding | `48px / 96px` | only thing that changes by viewport |

## Typography

| Use | Family | Weight | Size | Notes |
| --- | --- | --- | --- | --- |
| Eyebrow (section labels) | JetBrains Mono | 400 | 11px | uppercase, letter-spacing 0.18em, color `--muted` |
| Title eyebrow ("GREENWICH AVENUE · TUE 3:42 PM") | JetBrains Mono | 400 | 11px | same as section eyebrows |
| **Verdict word** | **Spectral Italic** | **400** | **clamp(40px, 7vw, 56px)** | the hero. color = state accent (quiet/busy/tough) |
| Score ("62 / 100") | JetBrains Mono | 400 | 14px | tabular figures, color `--muted` |
| Action sentence ("Easier in about an hour.") | Spectral Italic | 300 | 18px | color `--fg`, line-height 1.4 |
| Forecast tick labels | JetBrains Mono | 400 | 10px | uppercase, color `--muted` |
| Best-time sentence | Spectral Italic | 300 | 18px | matches the action sentence |
| Footer disclaimer | JetBrains Mono | 400 | 10px | uppercase, color `--muted`, tracking 0.18em |

Spectral and JetBrains Mono are already loaded via `next/font/google` in `src/app/layout.tsx`. No new font dependency.

## Components

Existing components get rewritten in place. No new top-level components beyond `<AvenueMap />`.

### `<DemandScore />` (rewrite)

Eyebrow + verdict + score + action stack. Props unchanged: `score`, `category`, `observedAt`, `confidence`, plus new optional `actionCopy` derived from forecast best-time data passed in by `page.tsx`.

Verdict copy mapping:
- `green` → "Plenty of spots"
- `yellow` → "Moderately busy"
- `red` → "Tough today"

Action copy mapping (driven by `gap = currentScore - bestTime.score` and `minutesUntilBest = (bestTime - now) / 60000`):

- `gap > 20`: "Easier around ${formatTime(bestTime)}." (e.g., "Easier around 9:00 PM.")
- `5 < gap ≤ 20`: "Should ease up by ${formatTime(bestTime)}."
- `gap ≤ 5`: "Won't get much easier in the next 4 hours."

`formatTime` uses `Intl.DateTimeFormat` with `timeZone: GREENWICH_TZ`, hour numeric + minute 2-digit, h12. Empty `bestTime` (forecast unavailable) falls back to the third bucket's copy.

Low-confidence pill becomes a small mono line under the action: "Limited signal right now." in `--muted`.

### `<ForecastChart />` (rewrite)

Flat 1px stroke sparkline in `--fg`, no fill, no grid, no axes. Width 100%, height clamp(120px, 18vh, 180px). One 4px filled dot at the current moment (index 0). Optional 4px outline-only dot at the best-time index. Three ticks below: `Now`, `+2h`, `+4h` in mono 10px.

No category coloring on the line — the line is single-stroke `--fg`. Color stays exclusively on the verdict word.

### `<AvenueMap />` (new)

Vertical SVG schematic, ~280px wide × ~480px tall, fits within the column. Greenwich Avenue runs top (Lafayette/Putnam) to bottom (Railroad/train station) matching real-world N-S orientation.

**Real cross streets (revised against satellite reference).** Seven nodes, six blocks between them, matching the actual N-S geography:

| # | Node (north → south) | Side(s) it crosses |
| --- | --- | --- |
| 1 | Lafayette Pl / Putnam Ave | top terminus |
| 2 | W Elm St ↔ E Elm St | crosses fully |
| 3 | Lewis Ct | east stub |
| 4 | Mason St + Bolling Pl | east stub + west stub at the same Ave latitude |
| 5 | Havemeyer Pl | east stub |
| 6 | Arch St | crosses fully |
| 7 | Steamboat Rd / Railroad Ave | bottom terminus at Metro-North |

Six blocks = the six segments between adjacent nodes. The asymmetric mix of east stubs / west stubs / full crosses reads more truthfully than a perfect ladder. Lexington Ave (a minor east-only stub just south of Lafayette) is intentionally omitted to keep the node count at seven; including it pushes the block count to seven and adds visual noise without orienting anyone.

**No landmark labels.** The schematic stays pure — Ave centerline, cross streets, intersection nodes. No retail brand names, no Metro-North label. This decision was deliberate against a maximalist alternative; locals know what's on the Ave, and the editorial register holds tighter without consumer-brand visual noise.

**Static styling**: 1px stroke `--map-line` for the Ave centerline; full-width hairlines for the two full crosses (Elm, Arch); shorter stubs for one-sided streets. Small filled circle (`--map-line`) at each intersection node. Cross-street labels in JetBrains Mono 9-10px, positioned on the side that matches reality (Bolling Pl labels to the west of the spine, Mason St to the east, etc.). Generous whitespace.

**Block fill**: each block segment is a thin filled rectangle behind the Ave centerline, tinted with one of `--map-fill-quiet/busy/tough` based on the global current category. Phase 1: all six blocks share the same fill (honest about lack of block-level data). Phase 3+: per-block tints from citation density.

**Interaction**:
- Hover (desktop) / tap (mobile) a block → block gets a 2px stroke outline in `--fg`, tooltip appears below the schematic showing: "Block between {north cross} and {south cross} · current forecast: {verdict} ({score})"
- Tap outside any block clears selection
- Keyboard: each block has `role="button"`, `tabIndex={0}`, focus ring is the same 2px outline as hover

**Phase-3 disclaimer** (small mono line below the SVG): "Block-level demand in Phase 3 (FOIA). Today, all blocks share the global score."

### `<BestTimeCallout />` (rewrite for new register)

One italic Spectral sentence, 18px, no box, no icon, no chip. Hairline above + below.

### `page.tsx`

Same data flow as today (`getOrRefreshObservation` + `buildForecastForGreenwich` in parallel via RSC). Composes the new components. Removes the coordinate header (`41.026°N · 73.628°W`) — replaced by the title eyebrow.

### `layout.tsx` + `globals.css`

- `themeColor` flips to `#FAFAF8`.
- `appleWebApp.statusBarStyle` flips from `black-translucent` to `default` (light status bar on iOS home-screen launch).
- New CSS tokens; old dark tokens removed.

### `error.tsx` + `loading.tsx`

Both get re-themed to the light register. Loading skeleton uses `#EFEFEC` bars on `--bg`. Error page replaces the "no signal" cockpit copy with a quieter editorial equivalent: "We couldn't reach our data sources just now. Public APIs occasionally hiccup."

### `/debug` page

Stays as-is in structure but flips to the light register. Mono table on white bg, hairlines unchanged conceptually but use `--hairline`.

### PWA icons

`icon.tsx` and `apple-icon.tsx` get re-themed: white background, black Spectral "P" in the same composition. `manifest.ts` updates `background_color` + `theme_color` to `#FAFAF8`.

## Data flow

Unchanged. `page.tsx` server-renders by calling lib functions directly (no HTTP roundtrip). The forecast is used to:

1. Look up the lowest-score time in the window → drives action copy + best-time callout
2. Drive the sparkline shape
3. Drive map block tints (all blocks tinted with current global category)

## Error & loading states

- **Loading**: skeleton with the same hairline + section structure, light-mode bars
- **Both upstreams failed**: page still renders (priors carry the score). Small mono "Limited signal right now." line replaces the action copy
- **DB unreachable**: error boundary fires, editorial-toned fallback with retry button
- **Map**: pure SVG, no data dependency, always renders

## Accessibility

- WCAG AA contrast on `#111111` over `#FAFAF8` is ~16:1 — well past.
- Verdict color over `--bg`: forest `#1A5D40` (8.4:1), sienna `#8C5A2A` (5.6:1), red `#9B2C2C` (6.6:1). All AA-compliant.
- Map blocks have `role="button"` + `aria-label`. Keyboard focus visible (2px `--fg` outline). Hover state is duplicated as `:focus-visible`.
- All eyebrow + footer copy is real text, not images.

## Testing strategy

1. **Existing 104 unit tests stay green** — heuristic, sources, forecast, time features. UI rewrite shouldn't touch them.
2. **New tests** for `<AvenueMap />`: renders 6 blocks, applies correct tint class based on category, tooltip text correctness for each block, keyboard activation.
3. **Visual regression**: spot-check live URL on iPhone Safari + Chrome desktop after deploy. Lighthouse re-run (target: hold ≥95 perf, 100 a11y/best-practices/seo).
4. **Type-check + lint + build must all stay clean.**

## Migration

This is a non-additive rewrite of UI files. Once shipped, the old dark register is gone. No feature flag, no parallel routes. The data layer is untouched so rollback is `git revert` of the UI commit only.

## Out of scope (deferred)

- Dark-mode toggle (defer until a user asks)
- Real per-block demand tinting (Phase 3)
- Block landmark labels / shop info (would need a static dataset; defer to Phase 2)
- Map zoom or pan (defer to M2 Leaflet upgrade if/when Phase 3 lands)
- Multiple cameras / live cam embed (rejected — TOS issue)
