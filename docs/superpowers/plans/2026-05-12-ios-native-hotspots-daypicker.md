# iOS-native redesign + hotspots + day picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot the UI from light editorial to iOS-native (SF Pro stack, grouped-inset cards, segmented controls). Add 4 hotspots (Ginger Man, Terra, Rag & Bone, Hinoki) with drill-down per-block detail. Add a Today/Tomorrow/+Pick day segmented control. Introduce Phase 1.5 static per-block offsets so hotspots show different but honest numbers. Extend the forecast pipeline to support future days.

**Architecture:** Server Component page reads `?day` URL param. Forecast pipeline gains an optional `startAt` for future-day rendering. Hotspots are static metadata mapping name → block ID. Per-block score = clamp(globalScore + block.offset, 0, 100). All data layer (heuristic, sources, db, ingest) unchanged except `buildForecastForGreenwich(target?)`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, SF Pro via `-apple-system` font stack, inline SVG (no chart library), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-12-ios-native-hotspots-daypicker-design.md`

**Branch:** `redesign/ios-native` (already created)

---

## File Structure

**New files:**
- `src/lib/hotspots.ts` — 4 hotspots metadata
- `src/lib/hotspots.test.ts` — sanity tests
- `src/lib/per-block.ts` — `applyBlockOffset(globalScore, offset)` + helper to derive per-block score + category
- `src/lib/per-block.test.ts` — TDD'd
- `src/lib/day-param.ts` — parse / normalize the `?day=...` URL param → `{ kind: "today"|"future", startAt: Date }`
- `src/lib/day-param.test.ts` — TDD'd
- `src/components/Card.tsx` — white rounded-inset wrapper
- `src/components/SectionCaption.tsx` — uppercase tracked label
- `src/components/ScoreCard.tsx` — replaces DemandScore
- `src/components/HotspotList.tsx` — wraps 4 rows in a Card
- `src/components/HotspotRow.tsx` — single row (Link → drill-down)
- `src/components/DaySegmentedControl.tsx` — client component
- `src/components/DaySegmentedControl.test.tsx`
- `src/components/HotspotList.test.tsx`
- `src/app/hotspot/[id]/page.tsx` — drill-down detail page
- `src/components/BackLink.tsx` — iOS "‹ Back" link
- `src/components/DatePickerSheet.tsx` — client component, opens on "+ Pick day"

**Modified files:**
- `src/app/globals.css` — full rewrite to iOS token system
- `src/app/layout.tsx` — drop Spectral + JetBrains Mono `next/font/google` calls; use system stack
- `src/app/page.tsx` — restructure, read `?day` param, compose new components
- `src/app/loading.tsx` — re-theme to iOS cards
- `src/app/error.tsx` — re-theme to iOS cards
- `src/app/icon.tsx` — light bg + system-ui glyph
- `src/app/apple-icon.tsx` — light bg + system-ui glyph
- `src/app/manifest.ts` — bg/theme color to `#F2F2F7`
- `src/components/avenue-map-data.ts` — add `offset` field to each block
- `src/components/AvenueMap.tsx` — token swap only (still works the same)
- `src/components/ForecastChart.tsx` — token swap only
- `src/lib/forecast.ts` — extend `buildForecastForGreenwich` with optional `startAt` + bump `forecast_days=7`
- `src/lib/forecast.test.ts` — add a test for future-day forecast

**Deleted files:**
- `src/components/DemandScore.tsx` (replaced by ScoreCard)
- `src/components/BestTimeCallout.tsx` (sentence merges into ScoreCard)
- All tests on the deleted components

---

## Task 1: Design tokens + SF Pro system stack

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Rewrite `globals.css`**

```css
@import "tailwindcss";

:root {
  /* iOS Light system colors */
  --bg-group: #f2f2f7;
  --bg-surface: #ffffff;
  --label-primary: #000000;
  --label-secondary: rgba(60, 60, 67, 0.6);
  --label-tertiary: rgba(60, 60, 67, 0.3);
  --separator: rgba(60, 60, 67, 0.18);
  --separator-inset: rgba(60, 60, 67, 0.36);
  --link: #007aff;

  /* State accents (iOS system colors) */
  --state-quiet: #34c759;
  --state-busy: #ff9500;
  --state-tough: #ff3b30;

  /* Map fills (low-saturation tint of state colors) */
  --map-fill-quiet: rgba(52, 199, 89, 0.18);
  --map-fill-busy: rgba(255, 149, 0, 0.18);
  --map-fill-tough: rgba(255, 59, 48, 0.18);
  --map-line: #1c1c1e;

  /* System font stacks */
  --font-display:
    -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto,
    system-ui, sans-serif;
  --font-text:
    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto,
    system-ui, sans-serif;
  --font-mono:
    ui-monospace, "SF Mono", Menlo, Monaco, "JetBrains Mono", monospace;
}

@theme inline {
  --color-bg-group: var(--bg-group);
  --color-bg-surface: var(--bg-surface);
  --color-label-primary: var(--label-primary);
  --color-label-secondary: var(--label-secondary);
  --color-label-tertiary: var(--label-tertiary);
  --color-separator: var(--separator);
  --color-separator-inset: var(--separator-inset);
  --color-link: var(--link);
  --color-state-quiet: var(--state-quiet);
  --color-state-busy: var(--state-busy);
  --color-state-tough: var(--state-tough);
  --color-map-fill-quiet: var(--map-fill-quiet);
  --color-map-fill-busy: var(--map-fill-busy);
  --color-map-fill-tough: var(--map-fill-tough);
  --color-map-line: var(--map-line);
}

body {
  background: var(--bg-group);
  color: var(--label-primary);
  font-family: var(--font-text);
  font-feature-settings: "tnum" 1, "lnum" 1;
  -webkit-font-smoothing: antialiased;
}

.display {
  font-family: var(--font-display);
}

.mono {
  font-family: var(--font-mono);
}
```

- [ ] **Step 2: Update `layout.tsx`** — drop Spectral + JetBrains Mono imports:

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parking on Greenwich Avenue",
  description: "Shows you when Greenwich Avenue is busy before you drive there.",
  appleWebApp: {
    capable: true,
    title: "Greenwich Ave",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2f2f7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--bg-group)] text-[var(--label-primary)] flex flex-col">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Build (expect page broken)**

```bash
cd /Users/philipcamuto/Developer/greenwich-park && npm run build 2>&1 | tail -10
```

Expected: build compiles. The page renders but looks broken because components still reference old tokens (`--bg`, `--fg`, etc). Task 12 fixes the page composition.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "tokens: iOS-native system colors + SF Pro stack; drop web fonts"
```

---

## Task 2: Card + SectionCaption primitives

**Files:**
- Create: `src/components/Card.tsx`
- Create: `src/components/SectionCaption.tsx`

- [ ] **Step 1: Create `Card.tsx`**

```tsx
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: Props) {
  return (
    <div
      className={`bg-[var(--bg-surface)] rounded-[12px] px-4 py-4 ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `SectionCaption.tsx`**

```tsx
type Props = { children: string };

export function SectionCaption({ children }: Props) {
  return (
    <div className="display text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--label-secondary)] px-4 mb-2">
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -5
```
Expected: clean (these are new files, nothing else broken).

- [ ] **Step 4: Commit**

```bash
git add src/components/Card.tsx src/components/SectionCaption.tsx
git commit -m "primitives: Card + SectionCaption for iOS grouped-inset register"
```

---

## Task 3: Per-block offsets in avenue-map-data + helper (TDD)

**Files:**
- Modify: `src/components/avenue-map-data.ts`
- Create: `src/lib/per-block.ts`
- Create: `src/lib/per-block.test.ts`

- [ ] **Step 1: Add `offset` field to `AvenueBlock`**

Replace the `AvenueBlock` type and `BLOCKS` derivation in `src/components/avenue-map-data.ts` to include offsets:

```ts
export type AvenueBlock = {
  id: string;
  northNodeId: string;
  southNodeId: string;
  label: string;
  offset: number; // Phase 1.5 stylized per-block adjustment (-5..+5)
};

// Hand-tuned per-block offsets (Phase 1.5). Calibration guesses based on
// common Greenwich Ave observation — Phase 3 FOIA data replaces these.
const OFFSET_BY_BLOCK_INDEX: number[] = [
  +3, // Lafayette/Putnam → Elm: top of Ave, Saks/Tiffany/Prada cluster
  +2, // Elm → Lewis: upper-mid, Ginger Man + Maman
  0,  // Lewis → Mason: mid baseline
  -2, // Mason → Havemeyer: lower-mid, lighter foot traffic
  +1, // Havemeyer → Arch: dinner clusters above Metro-North
  -3, // Arch → Steamboat: bottom, close to station, fewer destinations
];

export const BLOCKS: AvenueBlock[] = NODES.slice(0, -1).map((n, i) => {
  const south = NODES[i + 1];
  return {
    id: `${n.id}__${south.id}`,
    northNodeId: n.id,
    southNodeId: south.id,
    label: `Between ${n.label} and ${south.label}`,
    offset: OFFSET_BY_BLOCK_INDEX[i] ?? 0,
  };
});
```

- [ ] **Step 2: Write the failing test**

`src/lib/per-block.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { applyBlockOffset, perBlockScores } from "./per-block";
import { BLOCKS } from "@/components/avenue-map-data";

describe("applyBlockOffset", () => {
  it("clamps to [0,100]", () => {
    expect(applyBlockOffset(95, 10)).toBe(100);
    expect(applyBlockOffset(5, -10)).toBe(0);
  });
  it("adds the offset in normal range", () => {
    expect(applyBlockOffset(60, 3)).toBe(63);
    expect(applyBlockOffset(60, -3)).toBe(57);
  });
  it("rounds to integer", () => {
    expect(applyBlockOffset(60.4, 0)).toBe(60);
    expect(applyBlockOffset(60.6, 0)).toBe(61);
  });
});

describe("perBlockScores", () => {
  it("returns one entry per block keyed by block id", () => {
    const out = perBlockScores(60);
    expect(Object.keys(out).sort()).toEqual(BLOCKS.map((b) => b.id).sort());
  });
  it("each score includes category", () => {
    const out = perBlockScores(60);
    for (const id of Object.keys(out)) {
      expect(["green", "yellow", "red"]).toContain(out[id].category);
    }
  });
  it("offsets shift the score relative to the global", () => {
    const out = perBlockScores(60);
    const topBlock = out[BLOCKS[0].id]; // offset +3
    const bottomBlock = out[BLOCKS[BLOCKS.length - 1].id]; // offset -3
    expect(topBlock.score).toBeGreaterThan(bottomBlock.score);
  });
});
```

Run: `npm run test -- per-block 2>&1 | tail -10` → expect FAIL (module missing).

- [ ] **Step 3: Create `src/lib/per-block.ts`**

```ts
import { BLOCKS } from "@/components/avenue-map-data";
import type { DemandCategory } from "@/lib/model/types";

function categorize(score: number): DemandCategory {
  if (score <= 40) return "green";
  if (score <= 70) return "yellow";
  return "red";
}

export function applyBlockOffset(globalScore: number, offset: number): number {
  return Math.max(0, Math.min(100, Math.round(globalScore + offset)));
}

export type PerBlockScore = {
  score: number;
  category: DemandCategory;
  offset: number;
};

export function perBlockScores(
  globalScore: number,
): Record<string, PerBlockScore> {
  const out: Record<string, PerBlockScore> = {};
  for (const b of BLOCKS) {
    const score = applyBlockOffset(globalScore, b.offset);
    out[b.id] = { score, category: categorize(score), offset: b.offset };
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/philipcamuto/Developer/greenwich-park && npm run test -- per-block 2>&1 | tail -10
npm run test 2>&1 | tail -5
```
Expected: 6 new tests pass; total ≥125.

- [ ] **Step 5: Commit**

```bash
git add src/components/avenue-map-data.ts src/lib/per-block.ts src/lib/per-block.test.ts
git commit -m "per-block: static offsets + applyBlockOffset + perBlockScores helper"
```

---

## Task 4: Hotspots metadata + tests (TDD)

**Files:**
- Create: `src/lib/hotspots.ts`
- Create: `src/lib/hotspots.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/hotspots.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { HOTSPOTS, hotspotById } from "./hotspots";
import { BLOCKS } from "@/components/avenue-map-data";

describe("HOTSPOTS", () => {
  it("has 4 entries", () => {
    expect(HOTSPOTS).toHaveLength(4);
  });
  it("each has a unique id", () => {
    const ids = HOTSPOTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every hotspot's blockId references a real block", () => {
    const blockIds = new Set(BLOCKS.map((b) => b.id));
    for (const h of HOTSPOTS) {
      expect(blockIds.has(h.blockId)).toBe(true);
    }
  });
  it("includes the four expected names", () => {
    const names = HOTSPOTS.map((h) => h.name).sort();
    expect(names).toEqual(
      ["Hinoki", "Rag & Bone", "Terra", "The Ginger Man"].sort(),
    );
  });
});

describe("hotspotById", () => {
  it("returns the matching hotspot", () => {
    expect(hotspotById("ginger-man")?.name).toBe("The Ginger Man");
  });
  it("returns null on miss", () => {
    expect(hotspotById("nope")).toBeNull();
  });
});
```

Run: `npm run test -- hotspots 2>&1 | tail -10` → FAIL.

- [ ] **Step 2: Create `src/lib/hotspots.ts`**

```ts
// Four hand-picked landmarks on Greenwich Ave. Each maps to a block id from
// `avenue-map-data.ts`. Phase 1: per-hotspot score = its block's per-block
// score (which itself is global score + block.offset).

export type Hotspot = {
  id: string;
  name: string;
  address: string;
  subLabel: string; // shown under the name on the drill-down page
  blockId: string;
};

export const HOTSPOTS: Hotspot[] = [
  {
    id: "ginger-man",
    name: "The Ginger Man",
    address: "64 Greenwich Ave",
    subLabel: "Lower Ave · Havemeyer Pl to Arch St",
    blockId: "havemeyer__arch",
  },
  {
    id: "terra",
    name: "Terra",
    address: "156 Greenwich Ave",
    subLabel: "Mid Ave · Lewis Ct to Mason / Bolling",
    blockId: "lewis__mason",
  },
  {
    id: "rag-bone",
    name: "Rag & Bone",
    address: "50 Greenwich Ave",
    subLabel: "Lower Ave · Havemeyer Pl to Arch St",
    blockId: "havemeyer__arch",
  },
  {
    id: "hinoki",
    name: "Hinoki",
    address: "298 Greenwich Ave",
    subLabel: "Upper-mid Ave · Lewis Ct to Mason / Bolling",
    blockId: "lewis__mason",
  },
];

export function hotspotById(id: string): Hotspot | null {
  return HOTSPOTS.find((h) => h.id === id) ?? null;
}
```

- [ ] **Step 3: Tests**

```bash
npm run test -- hotspots 2>&1 | tail -10
npm run test 2>&1 | tail -5
```
Expected: 6 new tests pass; total ≥131.

- [ ] **Step 4: Commit**

```bash
git add src/lib/hotspots.ts src/lib/hotspots.test.ts
git commit -m "hotspots: 4-entry metadata module + tests"
```

---

## Task 5: Day param parser (TDD)

**Files:**
- Create: `src/lib/day-param.ts`
- Create: `src/lib/day-param.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseDayParam } from "./day-param";

describe("parseDayParam", () => {
  it("returns today when missing", () => {
    const out = parseDayParam(undefined, new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("today");
  });
  it("returns today when explicitly 'today'", () => {
    const out = parseDayParam("today", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("today");
  });
  it("returns tomorrow at 8am Greenwich-local when 'tomorrow'", () => {
    const out = parseDayParam("tomorrow", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("future");
    expect(out.startAt?.toISOString()).toBe("2026-05-13T12:00:00.000Z"); // 8am EDT
  });
  it("accepts ISO date string for future days", () => {
    const out = parseDayParam("2026-05-15", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("future");
    expect(out.startAt?.toISOString()).toBe("2026-05-15T12:00:00.000Z");
  });
  it("rejects past dates → falls back to today", () => {
    const out = parseDayParam("2026-05-10", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("today");
  });
  it("rejects > 7 days out → falls back to today", () => {
    const out = parseDayParam("2026-06-01", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("today");
  });
  it("rejects malformed → falls back to today", () => {
    const out = parseDayParam("garbage", new Date("2026-05-12T20:00:00Z"));
    expect(out.kind).toBe("today");
  });
});
```

Run: `npm run test -- day-param` → FAIL.

- [ ] **Step 2: Create `src/lib/day-param.ts`**

```ts
import { GREENWICH_TZ } from "@/lib/utils/time";

export type DayParam =
  | { kind: "today" }
  | { kind: "future"; startAt: Date; isoDate: string };

const MAX_FUTURE_DAYS = 7;

function greenwichLocalYMD(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: GREENWICH_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function eightAmGreenwichOnDate(isoDate: string): Date {
  // Build the Date that represents 8:00 AM Greenwich local on the given day.
  // We construct it via a fixed offset string for the season; the safe path
  // is to compute the offset for that date in Greenwich and apply it.
  // Simpler: rely on the fact that EDT = UTC-4 May-Nov, EST = UTC-5 Nov-Mar.
  // For correctness across DST we use a probing approach.
  const probe = new Date(`${isoDate}T13:00:00.000Z`); // noon UTC on that date
  const localHourAtProbe = new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(probe)
    .find((p) => p.type === "hour")?.value;
  const offsetHours = 13 - parseInt(localHourAtProbe ?? "9", 10);
  // 8 AM Greenwich = (8 + offsetHours):00 UTC on that date.
  const utcHour = (8 + offsetHours) % 24;
  const hh = String(utcHour).padStart(2, "0");
  return new Date(`${isoDate}T${hh}:00:00.000Z`);
}

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function parseDayParam(
  raw: string | undefined,
  now: Date = new Date(),
): DayParam {
  if (!raw || raw === "today") return { kind: "today" };

  let isoDate: string;
  if (raw === "tomorrow") {
    const todayISO = greenwichLocalYMD(now);
    const d = new Date(`${todayISO}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    isoDate = greenwichLocalYMD(d);
  } else if (isValidIsoDate(raw)) {
    isoDate = raw;
  } else {
    return { kind: "today" };
  }

  const todayISO = greenwichLocalYMD(now);
  if (isoDate <= todayISO) return { kind: "today" };

  // Reject more than MAX_FUTURE_DAYS ahead
  const max = new Date(`${todayISO}T12:00:00.000Z`);
  max.setUTCDate(max.getUTCDate() + MAX_FUTURE_DAYS);
  const maxISO = greenwichLocalYMD(max);
  if (isoDate > maxISO) return { kind: "today" };

  return { kind: "future", startAt: eightAmGreenwichOnDate(isoDate), isoDate };
}
```

- [ ] **Step 3: Tests**

```bash
npm run test -- day-param 2>&1 | tail -10
```
Expected: 7 tests pass. If the DST probe math is off for a given test fixture, recompute the expected ISO string by running:
```bash
node -e "console.log(new Date('2026-05-13T12:00:00Z').toLocaleString('en-US', {timeZone:'America/New_York'}))"
```
and adjust the test's expected UTC time accordingly. The May-Nov ET offset is -4 (EDT), so 8 AM ET = 12:00 UTC.

- [ ] **Step 4: Commit**

```bash
git add src/lib/day-param.ts src/lib/day-param.test.ts
git commit -m "day-param: parse ?day URL param into today / future startAt"
```

---

## Task 6: Forecast extension for future days

**Files:**
- Modify: `src/lib/forecast.ts`
- Modify: `src/lib/sources/openWeather.ts` — bump `forecast_days=7`
- Modify: `src/lib/forecast.test.ts` — add a test

- [ ] **Step 1: Bump Open-Meteo `forecast_days`**

In `src/lib/sources/openWeather.ts`, find the line `params.set("forecast_days", "2");` and change to `"7"`.

- [ ] **Step 2: Extend `buildForecast` + `buildForecastForGreenwich` to accept an anchor**

In `src/lib/forecast.ts`, change the function signatures:

```ts
export function buildForecast({
  now,
  currentWeather,
  traffic,
  hourly,
}: {
  now: Date;
  currentWeather: WeatherSnapshot;
  traffic: TrafficSnapshot;
  hourly: HourlyForecastPoint[];
}): Forecast {
  // ...existing body uses `now` as the start point.
}
```

The current `buildForecast` already starts iterating from `now`. So **no change to the pure function** — callers pass a different `now` to render a future day.

In `buildForecastForGreenwich`, add an optional argument:

```ts
export async function buildForecastForGreenwich(
  startAt: Date = new Date(),
): Promise<Forecast> {
  // existing body with `now` renamed to `startAt`
  const [traffic, hourly] = await Promise.all([
    fetchGreenwichTraffic(),
    fetchGreenwichHourlyForecast(),
  ]);
  const currentSlot = hourly.find((h) => h.timestamp === localHourKey(startAt));
  const currentWeather: WeatherSnapshot = currentSlot
    ? { /* same shape, mark ok: true */ tempF: currentSlot.tempF, condition: currentSlot.condition, precipitationIn: currentSlot.precipitationIn, windMph: 0, isDay: true, fetchedAt: new Date().toISOString(), ok: true }
    : { tempF: 0, condition: "unknown", precipitationIn: 0, windMph: 0, isDay: true, fetchedAt: new Date().toISOString(), ok: false };
  // Future-day traffic snapshot is meaningless; mark ok:false so confidence drops
  const isFuture = startAt.getTime() - Date.now() > 60 * 60 * 1000;
  const trafficForDay: TrafficSnapshot = isFuture
    ? { ...traffic, ok: false }
    : traffic;
  return buildForecast({ now: startAt, currentWeather, traffic: trafficForDay, hourly });
}
```

- [ ] **Step 3: Add a test**

Append to `src/lib/forecast.test.ts`:

```ts
describe("buildForecast (future startAt)", () => {
  const futureStart = new Date("2026-05-14T12:00:00Z"); // Thu 8am ET
  const hourly: HourlyForecastPoint[] = [
    { timestamp: "2026-05-14T08:00", tempF: 70, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-14T09:00", tempF: 72, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-14T10:00", tempF: 74, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-14T11:00", tempF: 75, condition: "clear", precipitationIn: 0 },
    { timestamp: "2026-05-14T12:00", tempF: 76, condition: "clear", precipitationIn: 0 },
  ];

  it("starts the first point at the supplied startAt", () => {
    const f = buildForecast({ now: futureStart, currentWeather: w(), traffic: tr(), hourly });
    expect(f.points[0].timestamp).toBe(futureStart.toISOString());
  });
  it("walks 15 minutes per step", () => {
    const f = buildForecast({ now: futureStart, currentWeather: w(), traffic: tr(), hourly });
    const delta =
      new Date(f.points[1].timestamp).getTime() - new Date(f.points[0].timestamp).getTime();
    expect(delta).toBe(15 * 60 * 1000);
  });
});
```

- [ ] **Step 4: Run tests + lint**

```bash
cd /Users/philipcamuto/Developer/greenwich-park
npm run test 2>&1 | tail -5
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | tail -3
```
Expected: ≥140 tests pass, lint clean, tsc clean (or only page.tsx still complaining if Task 12 hasn't run yet).

- [ ] **Step 5: Commit**

```bash
git add src/lib/forecast.ts src/lib/sources/openWeather.ts src/lib/forecast.test.ts
git commit -m "forecast: accept startAt for future days; bump forecast_days=7"
```

---

## Task 7: ScoreCard component

**Files:**
- Create: `src/components/ScoreCard.tsx`

- [ ] **Step 1: Create `ScoreCard.tsx`** (replaces DemandScore; same data, iOS card register)

```tsx
import { Card } from "./Card";
import type { Confidence, DemandCategory } from "@/lib/model/types";
import { verdictFor } from "@/lib/copy";

type Props = {
  score: number;
  category: DemandCategory;
  confidence?: Confidence;
  actionCopy: string;
};

const STATE_VAR: Record<DemandCategory, string> = {
  green: "var(--state-quiet)",
  yellow: "var(--state-busy)",
  red: "var(--state-tough)",
};

export function ScoreCard({ score, category, confidence, actionCopy }: Props) {
  const accent = STATE_VAR[category];
  const verdict = verdictFor(category);
  const lowSignal = confidence === "low";

  return (
    <Card className="flex flex-col gap-2">
      <h1
        className="display font-semibold leading-tight tracking-tight"
        style={{ color: accent, fontSize: "28px" }}
      >
        {verdict}
      </h1>
      <div className="mono text-[17px] font-medium text-[var(--label-secondary)] tabular-nums">
        {score} / 100
      </div>
      <p className="text-[17px] leading-snug text-[var(--label-primary)] mt-1">
        {actionCopy}
      </p>
      {lowSignal && (
        <p className="text-[13px] text-[var(--label-tertiary)] mt-1">
          Limited signal right now.
        </p>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Build (page.tsx will still fail)**

```bash
npm run build 2>&1 | tail -8
```
Expected: ScoreCard compiles; page.tsx still fails referencing old DemandScore.

- [ ] **Step 3: Commit**

```bash
git add src/components/ScoreCard.tsx
git commit -m "ScoreCard: iOS card replacement for DemandScore"
```

---

## Task 8: HotspotList + HotspotRow

**Files:**
- Create: `src/components/HotspotList.tsx`
- Create: `src/components/HotspotRow.tsx`
- Create: `src/components/HotspotList.test.tsx`

- [ ] **Step 1: Create `HotspotRow.tsx`**

```tsx
import Link from "next/link";
import type { DemandCategory } from "@/lib/model/types";

type Props = {
  id: string;
  name: string;
  score: number;
  category: DemandCategory;
};

const ACCENT: Record<DemandCategory, string> = {
  green: "var(--state-quiet)",
  yellow: "var(--state-busy)",
  red: "var(--state-tough)",
};

export function HotspotRow({ id, name, score, category }: Props) {
  return (
    <Link
      href={`/hotspot/${id}`}
      className="flex items-center justify-between min-h-[44px] py-2"
      aria-label={`${name}, demand ${score} of 100, view forecast`}
    >
      <span className="text-[17px] text-[var(--label-primary)]">{name}</span>
      <span className="flex items-center gap-2">
        <span
          className="mono text-[17px] font-medium tabular-nums"
          style={{ color: ACCENT[category] }}
        >
          {score}
        </span>
        <span
          aria-hidden
          className="text-[var(--label-tertiary)] text-[14px]"
        >
          ›
        </span>
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Create `HotspotList.tsx`**

```tsx
import { Card } from "./Card";
import { HotspotRow } from "./HotspotRow";
import { HOTSPOTS } from "@/lib/hotspots";
import type { PerBlockScore } from "@/lib/per-block";

type Props = {
  perBlock: Record<string, PerBlockScore>;
};

export function HotspotList({ perBlock }: Props) {
  return (
    <Card>
      <ul className="flex flex-col">
        {HOTSPOTS.map((h, i) => {
          const block = perBlock[h.blockId];
          return (
            <li
              key={h.id}
              className={
                i === 0
                  ? ""
                  : "border-t border-[var(--separator-inset)] ml-0"
              }
            >
              <HotspotRow
                id={h.id}
                name={h.name}
                score={block?.score ?? 0}
                category={block?.category ?? "green"}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
```

- [ ] **Step 3: Write tests**

`src/components/HotspotList.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HotspotList } from "./HotspotList";
import { perBlockScores } from "@/lib/per-block";
import { HOTSPOTS } from "@/lib/hotspots";

describe("HotspotList", () => {
  const perBlock = perBlockScores(60);

  it("renders all 4 hotspots as links", () => {
    render(<HotspotList perBlock={perBlock} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
  });

  it("each link goes to /hotspot/<id>", () => {
    render(<HotspotList perBlock={perBlock} />);
    for (const h of HOTSPOTS) {
      const link = screen.getByRole("link", { name: new RegExp(h.name) });
      expect(link.getAttribute("href")).toBe(`/hotspot/${h.id}`);
    }
  });

  it("displays each hotspot's per-block score", () => {
    render(<HotspotList perBlock={perBlock} />);
    for (const h of HOTSPOTS) {
      const score = perBlock[h.blockId].score;
      // The link's accessible name includes the score.
      expect(
        screen.getByRole("link", { name: new RegExp(`${h.name}.*${score}`) }),
      ).toBeTruthy();
    }
  });
});
```

- [ ] **Step 4: Tests + build**

```bash
npm run test -- HotspotList 2>&1 | tail -10
npm run test 2>&1 | tail -5
npm run build 2>&1 | tail -8
```
Expected: 3 new tests pass, total ≥143. Build still fails at page.tsx (Task 12 fixes).

- [ ] **Step 5: Commit**

```bash
git add src/components/HotspotList.tsx src/components/HotspotRow.tsx src/components/HotspotList.test.tsx
git commit -m "Hotspots: list + row with drill-down links + tests"
```

---

## Task 9: DaySegmentedControl + DatePickerSheet

**Files:**
- Create: `src/components/DaySegmentedControl.tsx`
- Create: `src/components/DatePickerSheet.tsx`

- [ ] **Step 1: Create `DaySegmentedControl.tsx`** (client component)

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DatePickerSheet } from "./DatePickerSheet";

type Segment = { value: string; label: string };

const SEGMENTS: Segment[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
];

export function DaySegmentedControl() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("day") ?? "today";
  const [pickerOpen, setPickerOpen] = useState(false);

  function select(value: string) {
    const p = new URLSearchParams(params.toString());
    if (value === "today") p.delete("day");
    else p.set("day", value);
    router.push(`/?${p.toString()}`);
  }

  function isCustomDate(v: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
  }

  const customLabel =
    current && isCustomDate(current)
      ? new Date(current + "T12:00:00Z").toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <>
      <div className="bg-[#e5e5ea] rounded-[8px] p-[2px] flex gap-[2px] mb-4">
        {SEGMENTS.map((s) => {
          const selected = current === s.value || (current === "today" && s.value === "today");
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={selected}
              onClick={() => select(s.value)}
              className={`flex-1 text-[14px] font-medium py-[6px] rounded-[7px] transition-colors ${
                selected
                  ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] text-[var(--label-primary)]"
                  : "text-[var(--label-secondary)]"
              }`}
            >
              {s.label}
            </button>
          );
        })}
        <button
          key="pick"
          type="button"
          aria-pressed={!!customLabel}
          onClick={() => setPickerOpen(true)}
          className={`flex-1 text-[14px] font-medium py-[6px] rounded-[7px] transition-colors ${
            customLabel
              ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] text-[var(--label-primary)]"
              : "text-[var(--label-secondary)]"
          }`}
        >
          {customLabel ?? "+ Pick day"}
        </button>
      </div>
      {pickerOpen && (
        <DatePickerSheet
          onClose={() => setPickerOpen(false)}
          onPick={(isoDate) => {
            setPickerOpen(false);
            select(isoDate);
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Create `DatePickerSheet.tsx`**

```tsx
"use client";

import { useState } from "react";

type Props = {
  onClose: () => void;
  onPick: (isoDate: string) => void;
};

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function maxISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-CA");
}

export function DatePickerSheet({ onClose, onPick }: Props) {
  const [value, setValue] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] w-full max-w-[640px] rounded-t-[16px] p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="display text-[17px] font-semibold">Pick a day</div>
        <input
          type="date"
          min={todayISO()}
          max={maxISO()}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-[17px] border border-[var(--separator)] rounded-[8px] px-3 py-2"
        />
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-[10px] border border-[var(--separator)] text-[17px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!value}
            onClick={() => value && onPick(value)}
            className="flex-1 min-h-[44px] rounded-[10px] bg-[var(--link)] text-white text-[17px] disabled:opacity-40"
          >
            Pick
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -8
```
Expected: components compile. Page.tsx still failing (Task 12 fixes).

- [ ] **Step 4: Commit**

```bash
git add src/components/DaySegmentedControl.tsx src/components/DatePickerSheet.tsx
git commit -m "Day picker: segmented control + bottom-sheet date picker"
```

---

## Task 10: Re-theme ForecastChart + AvenueMap to new tokens

**Files:**
- Modify: `src/components/ForecastChart.tsx`
- Modify: `src/components/AvenueMap.tsx`

- [ ] **Step 1: Update `ForecastChart.tsx` token references**

Find every `var(--fg)`, `var(--muted)`, `var(--hairline)`, `var(--bg)` in `src/components/ForecastChart.tsx` and replace with the iOS equivalents:
- `var(--fg)` → `var(--label-primary)`
- `var(--muted)` → `var(--label-secondary)`
- `var(--hairline)` → `var(--separator)`
- `var(--bg)` → `var(--bg-surface)`

- [ ] **Step 2: Update `AvenueMap.tsx` token references**

Same swap rules, plus rename map fill references — they should already use `var(--map-fill-*)` which we kept in the new tokens.

- [ ] **Step 3: Build + tests**

```bash
cd /Users/philipcamuto/Developer/greenwich-park
npm run build 2>&1 | tail -8
npm run test 2>&1 | tail -5
```
Expected: both compile, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ForecastChart.tsx src/components/AvenueMap.tsx
git commit -m "ForecastChart + AvenueMap: swap to iOS tokens"
```

---

## Task 11: BackLink + hotspot drill-down page

**Files:**
- Create: `src/components/BackLink.tsx`
- Create: `src/app/hotspot/[id]/page.tsx`

- [ ] **Step 1: Create `BackLink.tsx`**

```tsx
import Link from "next/link";

type Props = { href: string; label?: string };

export function BackLink({ href, label = "Back" }: Props) {
  return (
    <Link
      href={href}
      className="text-[17px] text-[var(--link)] flex items-center gap-1 mb-4"
    >
      <span aria-hidden>‹</span>
      <span>{label}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Create `src/app/hotspot/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { Card } from "@/components/Card";
import { ForecastChart } from "@/components/ForecastChart";
import { SectionCaption } from "@/components/SectionCaption";
import { ScoreCard } from "@/components/ScoreCard";
import { actionCopyFor } from "@/lib/copy";
import { buildForecastForGreenwich } from "@/lib/forecast";
import { hotspotById } from "@/lib/hotspots";
import { getOrRefreshObservation } from "@/lib/ingest";
import { perBlockScores } from "@/lib/per-block";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HotspotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hotspot = hotspotById(id);
  if (!hotspot) notFound();

  const [{ observation }, forecast] = await Promise.all([
    getOrRefreshObservation(),
    buildForecastForGreenwich(),
  ]);

  const blockScores = perBlockScores(observation.computedScore);
  const block = blockScores[hotspot.blockId];

  const action = actionCopyFor({
    currentScore: block.score,
    bestTime: forecast.bestTime,
  });

  return (
    <main className="min-h-dvh bg-[var(--bg-group)] flex justify-center">
      <div className="w-full max-w-[640px] px-4 sm:px-8 pt-6 sm:pt-12 pb-12 flex flex-col gap-4">
        <BackLink href="/" />

        <header className="px-4">
          <h1 className="display text-[34px] font-bold leading-tight tracking-tight text-[var(--label-primary)]">
            {hotspot.name}
          </h1>
          <p className="text-[13px] text-[var(--label-secondary)] mt-1">
            {hotspot.address} · {hotspot.subLabel}
          </p>
        </header>

        <ScoreCard
          score={block.score}
          category={block.category}
          confidence={
            observation.computedConfidence as "low" | "medium" | "high"
          }
          actionCopy={action}
        />

        <div>
          <SectionCaption>Next 4 Hours</SectionCaption>
          <Card>
            <ForecastChart points={forecast.points} bestTime={forecast.bestTime} />
          </Card>
        </div>

        <p className="text-[13px] text-[var(--label-secondary)] px-4 leading-snug">
          Per-block scores currently use stylized offsets. Phase 3 (FOIA
          citation data) replaces them with measured demand.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -10
```
Expected: hotspot route compiles. Page.tsx still failing.

- [ ] **Step 4: Commit**

```bash
git add src/components/BackLink.tsx src/app/hotspot/
git commit -m "hotspot: drill-down route per hotspot id"
```

---

## Task 12: Page composition (unblocks the build)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `page.tsx`**

```tsx
import { Card } from "@/components/Card";
import { DaySegmentedControl } from "@/components/DaySegmentedControl";
import { ForecastChart } from "@/components/ForecastChart";
import { HotspotList } from "@/components/HotspotList";
import { AvenueMap } from "@/components/AvenueMap";
import { ScoreCard } from "@/components/ScoreCard";
import { SectionCaption } from "@/components/SectionCaption";
import { actionCopyFor, verdictFor } from "@/lib/copy";
import { parseDayParam } from "@/lib/day-param";
import { buildForecastForGreenwich } from "@/lib/forecast";
import { getOrRefreshObservation } from "@/lib/ingest";
import { perBlockScores } from "@/lib/per-block";
import type { DemandCategory } from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function titleSubtitle(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day } = await searchParams;
  const dayParam = parseDayParam(day);

  const [{ observation }, forecast] = await Promise.all([
    getOrRefreshObservation(),
    buildForecastForGreenwich(
      dayParam.kind === "future" ? dayParam.startAt : undefined,
    ),
  ]);

  // For Today, use the persisted observation. For future days, recompute the
  // score at the future startAt using time features + the forecast's
  // first-point inputs. This keeps Today's score persistent and stable while
  // future-day scores reflect the projection.
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
    // Future-day: reuse the forecast's first point. `buildForecast` already
    // ran the heuristic against the forecast startAt with the matching
    // hourly weather and the current traffic snapshot. No need to recompute.
    const p0 = forecast.points[0];
    globalScore = p0.score;
    category = p0.category;
    confidence = "medium"; // future-day caps at medium (no live traffic snapshot)
    displayedAt = dayParam.startAt;
  }

  const blockScores = perBlockScores(globalScore);
  const action = actionCopyFor({
    currentScore: globalScore,
    bestTime: forecast.bestTime,
  });

  return (
    <main className="min-h-dvh bg-[var(--bg-group)] flex justify-center">
      <div className="w-full max-w-[640px] px-4 sm:px-8 pt-6 sm:pt-12 pb-12 flex flex-col gap-4">
        <header className="px-4">
          <h1 className="display text-[34px] font-bold leading-tight tracking-tight text-[var(--label-primary)]">
            Parking on Greenwich Avenue
          </h1>
          <p className="text-[13px] text-[var(--label-secondary)] mt-1">
            Greenwich · CT · {titleSubtitle(displayedAt)}
          </p>
        </header>

        <DaySegmentedControl />

        <ScoreCard
          score={globalScore}
          category={category}
          confidence={confidence}
          actionCopy={action}
        />

        <div>
          <SectionCaption>Hotspots</SectionCaption>
          <HotspotList perBlock={blockScores} />
          <p className="text-[13px] text-[var(--label-secondary)] px-4 mt-2 leading-snug">
            Per-block scores currently use stylized offsets. Phase 3 will
            replace them with measured demand.
          </p>
        </div>

        <div>
          <SectionCaption>Next 4 Hours</SectionCaption>
          <Card>
            <ForecastChart points={forecast.points} bestTime={forecast.bestTime} />
          </Card>
        </div>

        <div>
          <SectionCaption>Greenwich Avenue</SectionCaption>
          <Card>
            <AvenueMap
              category={category}
              score={globalScore}
              verdict={verdictFor(category)}
            />
          </Card>
        </div>

        <footer className="text-[13px] text-[var(--label-tertiary)] px-4 mt-4 leading-relaxed">
          Public data + heuristics. Not a guarantee of availability.
        </footer>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Delete the old components**

```bash
cd /Users/philipcamuto/Developer/greenwich-park
rm src/components/DemandScore.tsx src/components/BestTimeCallout.tsx
```

(No test files to delete — DemandScore and BestTimeCallout had no test files.)

- [ ] **Step 3: Build, lint, tsc, tests must ALL be clean now**

```bash
npm run build 2>&1 | tail -10
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | tail -3
npm run test 2>&1 | tail -5
```
Expected: build clean, lint clean, tsc clean, ≥143 tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "page: iOS-native layout, ?day routing, hotspots, deletes old components"
```

---

## Task 13: Re-theme loading + error

**Files:**
- Modify: `src/app/loading.tsx`
- Modify: `src/app/error.tsx`

- [ ] **Step 1: Replace `loading.tsx` with iOS card skeleton**

```tsx
export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--bg-group)] flex justify-center">
      <div className="w-full max-w-[640px] px-4 sm:px-8 pt-6 sm:pt-12 pb-12 flex flex-col gap-4">
        <header className="px-4 flex flex-col gap-2">
          <Bar w="20rem" h="34px" />
          <Bar w="14rem" h="13px" />
        </header>
        <Bar w="100%" h="36px" />
        <Card>
          <Bar w="14rem" h="28px" />
          <Bar w="5rem" h="17px" />
          <Bar w="18rem" h="17px" />
        </Card>
        <Card>
          <Bar w="100%" h="44px" />
          <Bar w="100%" h="44px" />
          <Bar w="100%" h="44px" />
          <Bar w="100%" h="44px" />
        </Card>
        <Card>
          <Bar w="100%" h="120px" />
        </Card>
        <Card>
          <Bar w="100%" h="320px" />
        </Card>
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-[12px] px-4 py-4 flex flex-col gap-3">
      {children}
    </div>
  );
}

function Bar({ w, h = "0.7rem" }: { w: string; h?: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: "var(--separator)",
        borderRadius: 4,
      }}
    />
  );
}
```

- [ ] **Step 2: Rewrite `error.tsx`**

```tsx
"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-[var(--bg-group)] flex justify-center">
      <div className="w-full max-w-[640px] px-4 sm:px-8 pt-12 pb-12 flex flex-col gap-4">
        <header className="px-4">
          <h1 className="display text-[28px] font-bold leading-tight">
            No signal
          </h1>
          <p className="text-[17px] mt-2 text-[var(--label-primary)]">
            We couldn&rsquo;t reach our data sources just now. Public APIs occasionally hiccup.
          </p>
        </header>
        <div className="px-4">
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] px-5 py-2 rounded-[10px] bg-[var(--link)] text-white text-[17px] font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -5
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/loading.tsx src/app/error.tsx
git commit -m "loading + error: iOS card skeleton + native button"
```

---

## Task 14: PWA icons + manifest

**Files:**
- Modify: `src/app/icon.tsx`
- Modify: `src/app/apple-icon.tsx`
- Modify: `src/app/manifest.ts`

- [ ] **Step 1: Replace `icon.tsx`** (note: ImageResponse runs at edge with no SF Pro; use system-ui fallback)

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F2F2F7",
          color: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        P
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 2: Replace `apple-icon.tsx`**

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F2F2F7",
          color: "#000000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 130, fontWeight: 700, lineHeight: 1 }}>P</div>
        <div
          style={{
            position: "absolute",
            bottom: 14,
            fontSize: 11,
            letterSpacing: 1.5,
            color: "rgba(60,60,67,0.6)",
            textTransform: "uppercase",
          }}
        >
          Greenwich Ave
        </div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 3: Update `manifest.ts`** — change colors:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Parking on Greenwich Avenue",
    short_name: "Greenwich Ave",
    description: "Shows you when Greenwich Avenue is busy before you drive there.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F2F2F7",
    theme_color: "#F2F2F7",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -8
```

- [ ] **Step 5: Commit**

```bash
git add src/app/icon.tsx src/app/apple-icon.tsx src/app/manifest.ts
git commit -m "PWA: iOS register icons + manifest"
```

---

## Task 15: Final verification + merge + deploy + Lighthouse

**Files:** none (verification only)

- [ ] **Step 1: Full pre-flight**

```bash
cd /Users/philipcamuto/Developer/greenwich-park
git branch --show-current      # expect: redesign/ios-native
git status --short             # expect: clean
npm run test 2>&1 | tail -8    # expect ≥143
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | tail -3
npm run build 2>&1 | tail -10
```

- [ ] **Step 2: Merge to main**

```bash
git log redesign/ios-native --oneline ^main
git checkout main
git merge --no-ff redesign/ios-native -m "feat: iOS-native redesign + hotspots + day picker"
```

- [ ] **Step 3: Push**

```bash
git push origin main 2>&1 | tail -3
```

- [ ] **Step 4: Wait for deploy + smoke-test**

```bash
until curl -sS https://parking.philipcamuto.com/ 2>/dev/null | grep -q "Hotspots\|hotspot"; do sleep 5; done
echo "Live"

curl -sS -o /dev/null -w "/: %{http_code}\n" https://parking.philipcamuto.com/
curl -sS -o /dev/null -w "/hotspot/ginger-man: %{http_code}\n" https://parking.philipcamuto.com/hotspot/ginger-man
curl -sS -o /dev/null -w "/hotspot/terra: %{http_code}\n" https://parking.philipcamuto.com/hotspot/terra
curl -sS -o /dev/null -w "/hotspot/rag-bone: %{http_code}\n" https://parking.philipcamuto.com/hotspot/rag-bone
curl -sS -o /dev/null -w "/hotspot/hinoki: %{http_code}\n" https://parking.philipcamuto.com/hotspot/hinoki
curl -sS -o /dev/null -w "/?day=tomorrow: %{http_code}\n" "https://parking.philipcamuto.com/?day=tomorrow"
curl -sS -o /dev/null -w "/icon: %{http_code}\n" https://parking.philipcamuto.com/icon
curl -sS -o /dev/null -w "/apple-icon: %{http_code}\n" https://parking.philipcamuto.com/apple-icon
```

All 200.

Check new copy present:
```bash
curl -sS https://parking.philipcamuto.com/ | grep -oE "The Ginger Man|Terra|Rag & Bone|Hinoki|Parking on Greenwich Avenue|Tomorrow|Pick day" | sort -u
```
Expected: at least 5 of these strings.

- [ ] **Step 5: Lighthouse**

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx --yes lighthouse https://parking.philipcamuto.com/ \
  --only-categories=performance,accessibility,best-practices,seo \
  --form-factor=mobile --throttling-method=simulate \
  --output=json --output-path=/tmp/gp-lh-v3.json \
  --chrome-flags="--headless=new --disable-gpu --no-sandbox" --quiet 2>&1 | tail -5

python3 -c "
import json
r = json.load(open('/tmp/gp-lh-v3.json'))
for k, v in r.get('categories', {}).items():
    s = v.get('score')
    print(f'{v[\"title\"]}: {int(s*100) if s else \"n/a\"}')
"
```

Target: ≥95 perf, 100 a11y/bp/seo.

- [ ] **Step 6: Report final state**

Final report should include:
- All endpoints HTTP 200
- All new copy strings present
- Lighthouse scores
- Branch merged, pushed, deployed
- Compared to prior baseline (Perf 96, A11y 100, BP 100, SEO 100, CLS 0)

---

## Risks

1. **System font stack inconsistency on Linux/Windows.** `-apple-system` falls back to Segoe UI / Roboto / system-ui. Visual register on non-Apple devices will look "their OS" rather than iOS. Acceptable — better than shipping a 120KB SF Pro web font we don't have a license for.
2. **DST math in `day-param.ts`.** The probe-based offset detection handles both EST and EDT. If tests fail around DST boundary dates (Mar 8 / Nov 1), revisit the eightAmGreenwichOnDate function.
3. **Future-day score quality.** Beyond ~2 days the weather hourly might be sparse → confidence drops to "medium" by design. Open-Meteo's free tier covers 7 days reliably; 7+ days disabled in `parseDayParam`.
4. **Per-block offsets are guesses.** Documented as such in UI copy. Phase 3 FOIA data replaces them.
5. **Old tests may reference deleted components** (DemandScore, BestTimeCallout). If any test file imports them, delete the test along with the component in Task 12.
