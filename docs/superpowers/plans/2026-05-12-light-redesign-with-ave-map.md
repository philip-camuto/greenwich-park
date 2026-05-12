# Light editorial redesign + Greenwich Avenue map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark-cockpit UI with a light editorial redesign on `parking.philipcamuto.com`, add a hand-drawn SVG schematic of Greenwich Avenue, and surface a plain-English verdict as the new hero (the 0-100 score becomes supporting text).

**Architecture:** UI-only rewrite. Data layer (sources, heuristic, db, ingest, forecast) is untouched. The page is still a Server Component that fetches `getOrRefreshObservation()` + `buildForecastForGreenwich()` in parallel, then composes the new components. One new logic module (`lib/copy.ts`) holds the verdict + action-copy mappings so they're independently testable. One new client component (`AvenueMap.tsx`) holds the SVG schematic with hover/tap state.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Spectral + JetBrains Mono via `next/font/google`, inline SVG (no chart library), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-12-light-redesign-with-ave-map-design.md`

---

## File Structure

**New files:**
- `src/lib/copy.ts` — pure helpers: `verdictFor(category)`, `actionCopyFor({ score, bestTime, now })`, `formatGreenwichTime(date)`
- `src/lib/copy.test.ts` — unit tests for the above
- `src/components/AvenueMap.tsx` — client component, SVG schematic + hover/tap state
- `src/components/AvenueMap.test.tsx` — unit tests for the map (block count, tint mapping, keyboard activation)
- `src/components/avenue-map-data.ts` — pure data: the 7 node positions + 6 block definitions (no React; co-located with map)

**Modified files:**
- `src/app/globals.css` — full token rewrite (off-white, near-black, hairline, state accents)
- `src/app/layout.tsx` — themeColor + appleWebApp.statusBarStyle flip
- `src/app/page.tsx` — restructured composition: eyebrow header, new section order, new map block
- `src/app/loading.tsx` — re-themed skeleton bars
- `src/app/error.tsx` — re-themed editorial copy
- `src/app/icon.tsx` — white bg, dark glyph
- `src/app/apple-icon.tsx` — white bg, dark glyph
- `src/app/manifest.ts` — background_color + theme_color
- `src/app/debug/page.tsx` — light token swap
- `src/components/DemandScore.tsx` — full rewrite (verdict-led)
- `src/components/ForecastChart.tsx` — full rewrite (flat sparkline)
- `src/components/BestTimeCallout.tsx` — copy + register update

**Untouched (verified non-regression):**
- All of `src/lib/sources/*`
- All of `src/lib/model/*`
- All of `src/lib/db/*`
- `src/lib/ingest.ts`, `src/lib/forecast.ts`, `src/lib/utils/time.ts`
- `src/app/api/**`
- All `.test.ts` files outside the new ones

---

## Task 1: Design tokens + body font wiring

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Rewrite `src/app/globals.css` with the light tokens**

```css
@import "tailwindcss";

:root {
  /* Light editorial palette. Off-white canvas, not stark white. */
  --bg: #fafaf8;
  --fg: #111111;
  --muted: #6b6b6b;
  --hairline: #e5e5e5;

  /* Map */
  --map-line: #1f1f1f;
  --map-fill-quiet: #d9eae0;
  --map-fill-busy: #f2e2c9;
  --map-fill-tough: #f0d2d2;

  /* Verdict accents — dark on white reads elegant. */
  --accent-quiet: #1a5d40;
  --accent-busy: #8c5a2a;
  --accent-tough: #9b2c2c;
}

@theme inline {
  --color-bg: var(--bg);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-hairline: var(--hairline);
  --color-map-line: var(--map-line);
  --color-map-fill-quiet: var(--map-fill-quiet);
  --color-map-fill-busy: var(--map-fill-busy);
  --color-map-fill-tough: var(--map-fill-tough);
  --color-accent-quiet: var(--accent-quiet);
  --color-accent-busy: var(--accent-busy);
  --color-accent-tough: var(--accent-tough);
  --font-display: var(--font-display);
  --font-mono: var(--font-mono);
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-mono), ui-monospace, SFMono-Regular, monospace;
  font-feature-settings: "tnum" 1, "lnum" 1;
}

.display {
  font-family: var(--font-display), Georgia, serif;
  font-feature-settings: "tnum" 1, "lnum" 1;
}

.mono {
  font-family: var(--font-mono), ui-monospace, monospace;
}
```

- [ ] **Step 2: Update layout.tsx metadata + theme color**

```tsx
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
  themeColor: "#fafaf8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
```

Leave the `<html>` and `<body>` className wiring as-is — they already reference the CSS variables.

- [ ] **Step 3: Run build to confirm CSS still compiles**

Run: `cd ~/Developer/greenwich-park && npm run build 2>&1 | tail -10`
Expected: build succeeds, no CSS errors. The existing dark-styled components will look broken (white-on-near-black text invisible). That's fine — Task 3+ fixes them.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "tokens: light editorial palette"
```

---

## Task 2: Verdict + action-copy helpers (TDD)

**Files:**
- Create: `src/lib/copy.ts`
- Create: `src/lib/copy.test.ts`

- [ ] **Step 1: Write the failing test for `verdictFor`**

`src/lib/copy.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { verdictFor, actionCopyFor, formatGreenwichTime } from "./copy";

describe("verdictFor", () => {
  it("green → 'Plenty of spots'", () => {
    expect(verdictFor("green")).toBe("Plenty of spots");
  });
  it("yellow → 'Moderately busy'", () => {
    expect(verdictFor("yellow")).toBe("Moderately busy");
  });
  it("red → 'Tough today'", () => {
    expect(verdictFor("red")).toBe("Tough today");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd ~/Developer/greenwich-park && npm run test -- copy 2>&1 | tail -15`
Expected: FAIL with module-not-found for `./copy`.

- [ ] **Step 3: Create `src/lib/copy.ts` with `verdictFor`**

```ts
import type { DemandCategory } from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

export function verdictFor(category: DemandCategory): string {
  switch (category) {
    case "green":
      return "Plenty of spots";
    case "yellow":
      return "Moderately busy";
    case "red":
      return "Tough today";
  }
}

export function formatGreenwichTime(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export type ActionCopyInput = {
  currentScore: number;
  bestTime: { timestamp: string; score: number } | null;
};

export function actionCopyFor({ currentScore, bestTime }: ActionCopyInput): string {
  if (!bestTime) return "Won't get much easier in the next 4 hours.";
  const gap = currentScore - bestTime.score;
  const at = formatGreenwichTime(bestTime.timestamp);
  if (gap > 20) return `Easier around ${at}.`;
  if (gap > 5) return `Should ease up by ${at}.`;
  return "Won't get much easier in the next 4 hours.";
}
```

- [ ] **Step 4: Run test to verify pass + add tests for action copy + format**

Run: `npm run test -- copy 2>&1 | tail -10`
Expected: 3 verdictFor tests PASS.

Now add to `src/lib/copy.test.ts`:
```ts
describe("formatGreenwichTime", () => {
  it("formats a UTC iso into Greenwich-local 12h", () => {
    // 2026-05-12 21:00 UTC == 2026-05-12 17:00 ET (EDT)
    expect(formatGreenwichTime("2026-05-12T21:00:00Z")).toBe("5:00 PM");
  });
});

describe("actionCopyFor", () => {
  it("no bestTime → fallback copy", () => {
    expect(actionCopyFor({ currentScore: 60, bestTime: null })).toMatch(
      /Won't get much easier/i,
    );
  });
  it("gap > 20 → 'Easier around X'", () => {
    expect(
      actionCopyFor({
        currentScore: 80,
        bestTime: { timestamp: "2026-05-12T01:00:00Z", score: 40 },
      }),
    ).toMatch(/^Easier around \d+:\d{2}\s?(AM|PM)\.$/);
  });
  it("gap in (5,20] → 'Should ease up by X'", () => {
    expect(
      actionCopyFor({
        currentScore: 60,
        bestTime: { timestamp: "2026-05-12T01:00:00Z", score: 50 },
      }),
    ).toMatch(/^Should ease up by /);
  });
  it("gap <= 5 → fallback copy", () => {
    expect(
      actionCopyFor({
        currentScore: 50,
        bestTime: { timestamp: "2026-05-12T01:00:00Z", score: 47 },
      }),
    ).toMatch(/Won't get much easier/i);
  });
});
```

- [ ] **Step 5: Run all copy tests**

Run: `npm run test -- copy 2>&1 | tail -10`
Expected: 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/copy.ts src/lib/copy.test.ts
git commit -m "copy: verdict + action-copy helpers with tests"
```

---

## Task 3: Rewrite `<DemandScore />` (verdict-led)

**Files:**
- Modify: `src/components/DemandScore.tsx`

- [ ] **Step 1: Replace the entire DemandScore component**

```tsx
import type { Confidence, DemandCategory } from "@/lib/model/types";
import { verdictFor } from "@/lib/copy";

type Props = {
  score: number;
  category: DemandCategory;
  observedAt: string | Date;
  confidence?: Confidence;
  actionCopy: string;
  localDateLabel: string; // e.g. "Tue 3:42 PM"
};

const ACCENT_VAR: Record<DemandCategory, string> = {
  green: "var(--accent-quiet)",
  yellow: "var(--accent-busy)",
  red: "var(--accent-tough)",
};

export function DemandScore({
  score,
  category,
  observedAt: _observedAt,
  confidence,
  actionCopy,
  localDateLabel,
}: Props) {
  const accent = ACCENT_VAR[category];
  const verdict = verdictFor(category);
  const lowSignal = confidence === "low";

  return (
    <section className="flex flex-col gap-3">
      <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
        Greenwich Avenue · {localDateLabel}
      </div>

      <div className="display italic font-normal leading-[1.05] tracking-tight"
        style={{
          color: accent,
          fontSize: "clamp(40px, 7vw, 56px)",
        }}
      >
        {verdict}
      </div>

      <div className="mono text-[14px] text-[var(--muted)] tracking-tight">
        {score} / 100
      </div>

      <p className="display italic font-light text-[18px] text-[var(--fg)] leading-[1.4] mt-2">
        {actionCopy}
      </p>

      {lowSignal && (
        <p className="mono text-[11px] tracking-[0.15em] uppercase text-[var(--muted)] mt-1">
          Limited signal right now.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Run build to confirm types compile**

Run: `npm run build 2>&1 | tail -8`
Expected: build succeeds. (The page.tsx will currently pass the old prop shape — Task 7 fixes that. The build may compile but the page won't render correctly until then. That's expected.)

If the build fails on a type mismatch in `page.tsx`, that's fine — we'll fix it in Task 7. If it fails on the new component itself, fix here.

- [ ] **Step 3: Commit**

```bash
git add src/components/DemandScore.tsx
git commit -m "DemandScore: verdict-led rewrite"
```

---

## Task 4: Rewrite `<ForecastChart />` (flat sparkline)

**Files:**
- Modify: `src/components/ForecastChart.tsx`

- [ ] **Step 1: Replace the entire ForecastChart component**

```tsx
import type { DemandCategory } from "@/lib/model/types";

type Point = {
  timestamp: string;
  localHour: number;
  score: number;
  category: DemandCategory;
};

type Props = {
  points: Point[];
  bestTime: { timestamp: string; localHour: number; score: number } | null;
};

export function ForecastChart({ points, bestTime }: Props) {
  if (points.length === 0) return null;

  const W = 360;
  const H = 140;
  const M = { t: 6, r: 4, b: 22, l: 4 };
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;

  const xAt = (i: number) =>
    M.l + (i / Math.max(1, points.length - 1)) * innerW;
  const yAt = (score: number) => M.t + (1 - score / 100) * innerH;

  // Catmull-Rom-style smoothing for a quiet, restrained curve.
  function path(): string {
    let d = `M ${xAt(0)} ${yAt(points[0].score)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const x0 = xAt(i);
      const y0 = yAt(points[i].score);
      const x1 = xAt(i + 1);
      const y1 = yAt(points[i + 1].score);
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  }

  const bestIdx = bestTime
    ? points.findIndex((p) => p.timestamp === bestTime.timestamp)
    : -1;

  // Tick labels: NOW, +2h, +4h (indices 0, 8, 16 for 15-min × 17 points)
  const ticks: Array<{ i: number; label: string }> = [
    { i: 0, label: "NOW" },
    { i: 8, label: "+2H" },
    { i: 16, label: "+4H" },
  ].filter((t) => t.i < points.length);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full block"
      style={{ height: "clamp(120px, 18vh, 180px)" }}
      role="img"
      aria-label="Four-hour parking demand forecast"
    >
      {/* baseline hairline */}
      <line
        x1={M.l}
        y1={M.t + innerH}
        x2={W - M.r}
        y2={M.t + innerH}
        stroke="var(--hairline)"
        strokeWidth="1"
      />

      {/* curve */}
      <path d={path()} fill="none" stroke="var(--fg)" strokeWidth="1" />

      {/* current-moment filled dot */}
      <circle cx={xAt(0)} cy={yAt(points[0].score)} r="3" fill="var(--fg)" />

      {/* best-time outline dot */}
      {bestIdx > 0 && (
        <circle
          cx={xAt(bestIdx)}
          cy={yAt(points[bestIdx].score)}
          r="4"
          fill="var(--bg)"
          stroke="var(--fg)"
          strokeWidth="1"
        />
      )}

      {/* tick labels */}
      {ticks.map(({ i, label }) => (
        <text
          key={label}
          x={xAt(i)}
          y={H - 6}
          fill="var(--muted)"
          fontSize="10"
          fontFamily="var(--font-mono), monospace"
          letterSpacing="0.15em"
          textAnchor={i === 0 ? "start" : i === 16 ? "end" : "middle"}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Build to confirm types compile**

Run: `npm run build 2>&1 | tail -8`
Expected: compiles. May still fail at page.tsx for now.

- [ ] **Step 3: Commit**

```bash
git add src/components/ForecastChart.tsx
git commit -m "ForecastChart: flat 1px sparkline in light register"
```

---

## Task 5: Build `<AvenueMap />` + tests (TDD)

**Files:**
- Create: `src/components/avenue-map-data.ts`
- Create: `src/components/AvenueMap.tsx`
- Create: `src/components/AvenueMap.test.tsx`

- [ ] **Step 1: Create the static data module**

`src/components/avenue-map-data.ts`:
```ts
// Pure data. Seven nodes (top → bottom = north → south), six blocks between
// them. `side` tells the renderer where to drop the cross-street label and
// whether the cross stub goes east, west, or both.
//
// Y positions are normalized 0..1 inside the SVG; the renderer scales them
// into actual pixels.

export type CrossSide = "east" | "west" | "both" | "terminus";

export type AvenueNode = {
  id: string;
  label: string;
  y: number; // 0 = top (north), 1 = bottom (south)
  side: CrossSide;
};

export const NODES: AvenueNode[] = [
  { id: "lafayette", label: "Lafayette / Putnam", y: 0.0, side: "terminus" },
  { id: "elm", label: "Elm St", y: 0.18, side: "both" },
  { id: "lewis", label: "Lewis Ct", y: 0.34, side: "east" },
  { id: "mason", label: "Mason / Bolling", y: 0.5, side: "both" },
  { id: "havemeyer", label: "Havemeyer Pl", y: 0.66, side: "east" },
  { id: "arch", label: "Arch St", y: 0.82, side: "both" },
  { id: "railroad", label: "Steamboat / Railroad", y: 1.0, side: "terminus" },
];

export type AvenueBlock = {
  id: string;
  northNodeId: string;
  southNodeId: string;
  label: string; // human-readable, used in tooltip
};

export const BLOCKS: AvenueBlock[] = NODES.slice(0, -1).map((n, i) => {
  const south = NODES[i + 1];
  return {
    id: `${n.id}__${south.id}`,
    northNodeId: n.id,
    southNodeId: south.id,
    label: `Between ${n.label} and ${south.label}`,
  };
});
```

- [ ] **Step 2: Write the failing test for the map component**

`src/components/AvenueMap.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvenueMap } from "./AvenueMap";
import { BLOCKS } from "./avenue-map-data";

describe("AvenueMap", () => {
  it("renders all 6 blocks", () => {
    render(<AvenueMap category="yellow" score={60} verdict="Moderately busy" />);
    const blocks = screen.getAllByRole("button");
    expect(blocks).toHaveLength(BLOCKS.length);
    expect(BLOCKS).toHaveLength(6);
  });

  it("labels each block with its aria-label", () => {
    render(<AvenueMap category="yellow" score={60} verdict="Moderately busy" />);
    for (const b of BLOCKS) {
      expect(
        screen.getByRole("button", { name: new RegExp(b.label) }),
      ).toBeTruthy();
    }
  });

  it("renders the Phase-3 disclaimer", () => {
    render(<AvenueMap category="green" score={20} verdict="Plenty of spots" />);
    expect(
      screen.getByText(/Block-level demand in Phase 3/),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 3: Add the test deps and run the test**

Check if Testing Library is installed:
```bash
cd ~/Developer/greenwich-park && grep -E "@testing-library/(react|jest-dom)" package.json
```
If missing, install:
```bash
npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

Update `vitest.config.ts` to use `jsdom` for component tests:
```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

Run: `npm run test -- AvenueMap 2>&1 | tail -10`
Expected: FAIL (component doesn't exist yet).

- [ ] **Step 4: Create the AvenueMap component**

`src/components/AvenueMap.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { DemandCategory } from "@/lib/model/types";
import { BLOCKS, NODES } from "./avenue-map-data";

type Props = {
  category: DemandCategory;
  score: number;
  verdict: string;
};

const FILL: Record<DemandCategory, string> = {
  green: "var(--map-fill-quiet)",
  yellow: "var(--map-fill-busy)",
  red: "var(--map-fill-tough)",
};

// SVG geometry. The Ave is a vertical spine; stubs branch east/west.
const W = 280;
const H = 480;
const PAD = { t: 16, r: 80, b: 16, l: 80 };
const innerH = H - PAD.t - PAD.b;
const spineX = W / 2;
const stubLen = 56;

function yAt(yNorm: number): number {
  return PAD.t + yNorm * innerH;
}

export function AvenueMap({ category, score, verdict }: Props) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[320px] h-auto block mx-auto"
        role="group"
        aria-label="Greenwich Avenue block diagram"
      >
        {/* block fills (drawn behind the spine) */}
        {BLOCKS.map((b) => {
          const yN = yAt(NODES.find((n) => n.id === b.northNodeId)!.y);
          const yS = yAt(NODES.find((n) => n.id === b.southNodeId)!.y);
          const isActive = activeBlockId === b.id;
          return (
            <g key={b.id}>
              <rect
                x={spineX - 8}
                y={yN}
                width={16}
                height={yS - yN}
                fill={FILL[category]}
              />
              {/* hit + focus target */}
              <rect
                x={spineX - 20}
                y={yN}
                width={40}
                height={yS - yN}
                fill="transparent"
                stroke={isActive ? "var(--fg)" : "transparent"}
                strokeWidth={2}
                role="button"
                tabIndex={0}
                aria-label={b.label}
                onMouseEnter={() => setActiveBlockId(b.id)}
                onMouseLeave={() =>
                  setActiveBlockId((cur) => (cur === b.id ? null : cur))
                }
                onFocus={() => setActiveBlockId(b.id)}
                onBlur={() =>
                  setActiveBlockId((cur) => (cur === b.id ? null : cur))
                }
                onClick={() => setActiveBlockId(b.id)}
                style={{ cursor: "pointer", outline: "none" }}
              />
            </g>
          );
        })}

        {/* Ave spine */}
        <line
          x1={spineX}
          y1={PAD.t}
          x2={spineX}
          y2={H - PAD.b}
          stroke="var(--map-line)"
          strokeWidth={1}
        />

        {/* cross-street stubs + nodes + labels */}
        {NODES.map((n) => {
          const y = yAt(n.y);
          const showEast = n.side === "east" || n.side === "both";
          const showWest = n.side === "west" || n.side === "both";
          const isTerm = n.side === "terminus";
          return (
            <g key={n.id}>
              {/* node dot */}
              <circle cx={spineX} cy={y} r={3} fill="var(--map-line)" />

              {/* east stub */}
              {showEast && (
                <line
                  x1={spineX}
                  y1={y}
                  x2={spineX + stubLen}
                  y2={y}
                  stroke="var(--map-line)"
                  strokeWidth={1}
                />
              )}
              {/* west stub */}
              {showWest && (
                <line
                  x1={spineX}
                  y1={y}
                  x2={spineX - stubLen}
                  y2={y}
                  stroke="var(--map-line)"
                  strokeWidth={1}
                />
              )}
              {/* terminus tick */}
              {isTerm && (
                <line
                  x1={spineX - 16}
                  y1={y}
                  x2={spineX + 16}
                  y2={y}
                  stroke="var(--map-line)"
                  strokeWidth={1}
                />
              )}

              {/* label, positioned on whichever side the stub is on */}
              <text
                x={
                  showEast || isTerm
                    ? spineX + stubLen + 6
                    : spineX - stubLen - 6
                }
                y={y + 3}
                fill="var(--muted)"
                fontSize={9}
                fontFamily="var(--font-mono), monospace"
                letterSpacing="0.1em"
                textAnchor={showEast || isTerm ? "start" : "end"}
              >
                {n.label.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* tooltip / readout */}
      <div className="mono text-[11px] tracking-[0.15em] uppercase text-[var(--muted)] text-center min-h-[1.2em]">
        {activeBlockId
          ? readoutFor(activeBlockId, verdict, score)
          : "Hover or tap a block"}
      </div>

      <p className="mono text-[10px] tracking-[0.18em] uppercase text-[var(--muted)] text-center leading-relaxed">
        Block-level demand in Phase 3 (FOIA). Today, all blocks share the global score.
      </p>
    </div>
  );
}

function readoutFor(blockId: string, verdict: string, score: number): string {
  const b = BLOCKS.find((x) => x.id === blockId);
  if (!b) return "";
  return `${b.label.toUpperCase()} · ${verdict.toUpperCase()} · ${score}/100`;
}
```

- [ ] **Step 5: Run AvenueMap tests**

Run: `npm run test -- AvenueMap 2>&1 | tail -10`
Expected: 3 tests PASS.

If tests fail due to React 19 / testing-library compat, ensure `@testing-library/react@^16` is installed. Add a `vitest.setup.ts` if needed:
```ts
import "@testing-library/jest-dom/vitest";
```
And in `vitest.config.ts`: `test.setupFiles: ["./vitest.setup.ts"]`.

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `npm run test 2>&1 | tail -5`
Expected: all tests pass (104 existing + 8 new copy tests + 3 new AvenueMap tests = 115).

- [ ] **Step 7: Commit**

```bash
git add src/components/avenue-map-data.ts src/components/AvenueMap.tsx src/components/AvenueMap.test.tsx vitest.config.ts package.json package-lock.json
git commit -m "AvenueMap: hand-drawn SVG schematic + hover/focus state + tests"
```

---

## Task 6: Update `<BestTimeCallout />` for the new register

**Files:**
- Modify: `src/components/BestTimeCallout.tsx`

- [ ] **Step 1: Replace the component**

```tsx
import { formatGreenwichTime } from "@/lib/copy";

type Props = {
  bestTime: { timestamp: string; localHour: number; score: number } | null;
  currentScore: number;
};

export function BestTimeCallout({ bestTime, currentScore }: Props) {
  if (!bestTime) return null;
  const improvement = currentScore - bestTime.score;
  if (improvement <= 5) {
    return (
      <p className="display italic font-light text-[18px] text-[var(--fg)] leading-[1.4]">
        Right now is about as good as it gets in the next 4 hours.
      </p>
    );
  }
  return (
    <p className="display italic font-light text-[18px] text-[var(--fg)] leading-[1.4]">
      Try around{" "}
      <span className="not-italic">{formatGreenwichTime(bestTime.timestamp)}</span>{" "}
      <span className="text-[var(--muted)]">for easier parking.</span>
    </p>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | tail -5`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add src/components/BestTimeCallout.tsx
git commit -m "BestTimeCallout: light editorial register"
```

---

## Task 7: Recompose `page.tsx` with the new section order

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace page.tsx with the new composition**

```tsx
import { AvenueMap } from "@/components/AvenueMap";
import { BestTimeCallout } from "@/components/BestTimeCallout";
import { DemandScore } from "@/components/DemandScore";
import { ForecastChart } from "@/components/ForecastChart";
import { actionCopyFor, verdictFor } from "@/lib/copy";
import { buildForecastForGreenwich } from "@/lib/forecast";
import { getOrRefreshObservation } from "@/lib/ingest";
import type { DemandCategory } from "@/lib/model/types";
import { GREENWICH_TZ } from "@/lib/utils/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function localDateLabel(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: GREENWICH_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

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
  const action = actionCopyFor({
    currentScore: observation.computedScore,
    bestTime: forecast.bestTime,
  });

  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--fg)] flex justify-center">
      <div className="w-full max-w-[640px] px-6 sm:px-12 pt-12 sm:pt-24 pb-12 flex flex-col gap-8">
        <DemandScore
          score={observation.computedScore}
          category={category}
          observedAt={observation.observedAt}
          confidence={confidence}
          actionCopy={action}
          localDateLabel={localDateLabel(observation.observedAt)}
        />

        <div className="border-t border-[var(--hairline)]" />

        <section className="flex flex-col gap-3">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
            Forecast · Next 4 Hours
          </div>
          <ForecastChart points={forecast.points} bestTime={forecast.bestTime} />
        </section>

        <div className="border-t border-[var(--hairline)]" />

        <section className="flex flex-col gap-3">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
            Greenwich Avenue
          </div>
          <AvenueMap
            category={category}
            score={observation.computedScore}
            verdict={verdictFor(category)}
          />
        </section>

        <div className="border-t border-[var(--hairline)]" />

        <section className="flex flex-col gap-3">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
            Best in Next 4 Hours
          </div>
          <BestTimeCallout
            bestTime={forecast.bestTime}
            currentScore={observation.computedScore}
          />
        </section>

        <div className="border-t border-[var(--hairline)]" />

        <footer className="mono text-[10px] tracking-[0.18em] uppercase text-[var(--muted)] leading-relaxed">
          Public data + heuristics. Not a guarantee of availability.
        </footer>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build + lint + tsc**

Run:
```bash
cd ~/Developer/greenwich-park && npm run build 2>&1 | tail -10
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | tail -5
```
Expected: all clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "page: recompose with verdict, forecast, AvenueMap, best-time"
```

---

## Task 8: Re-theme `loading.tsx`, `error.tsx`, `/debug`

**Files:**
- Modify: `src/app/loading.tsx`
- Modify: `src/app/error.tsx`
- Modify: `src/app/debug/page.tsx`

- [ ] **Step 1: Rewrite `loading.tsx`**

```tsx
export default function Loading() {
  return (
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--fg)] flex justify-center">
      <div className="w-full max-w-[640px] px-6 sm:px-12 pt-12 sm:pt-24 pb-12 flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <Bar w="14rem" />
          <Bar w="16rem" h="clamp(40px, 7vw, 56px)" />
          <Bar w="5rem" h="14px" />
          <Bar w="18rem" h="18px" />
        </section>
        <div className="border-t border-[var(--hairline)]" />
        <section className="flex flex-col gap-3">
          <Bar w="9rem" />
          <Bar w="100%" h="clamp(120px, 18vh, 180px)" />
        </section>
        <div className="border-t border-[var(--hairline)]" />
        <section className="flex flex-col gap-3">
          <Bar w="8rem" />
          <Bar w="100%" h="320px" />
        </section>
        <div className="border-t border-[var(--hairline)]" />
        <section className="flex flex-col gap-3">
          <Bar w="10rem" />
          <Bar w="22rem" h="18px" />
        </section>
      </div>
    </main>
  );
}

function Bar({ w, h = "0.7rem" }: { w: string; h?: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: "var(--hairline)",
        borderRadius: 2,
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
    <main className="min-h-dvh bg-[var(--bg)] text-[var(--fg)] flex justify-center">
      <div className="w-full max-w-[640px] px-6 sm:px-12 pt-12 sm:pt-24 pb-12 flex flex-col gap-6">
        <div className="mono text-[11px] tracking-[0.18em] uppercase text-[var(--muted)]">
          Greenwich Avenue · No signal
        </div>
        <p className="display italic font-light text-[20px] sm:text-[24px] leading-[1.35] text-[var(--fg)]">
          We couldn&rsquo;t reach our data sources just now. Public APIs occasionally hiccup.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mono text-[11px] tracking-[0.25em] uppercase text-[var(--fg)] border border-[var(--hairline)] px-4 py-3 self-start min-h-[44px] hover:bg-[var(--hairline)] transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Re-theme `/debug/page.tsx`**

The structure stays the same; only the background + a few text colors change because they already use the CSS variables. Verify by visually checking — no code changes likely needed. If any literal `#fff`/`#000` references exist, swap them to `var(--bg)` / `var(--fg)`.

Run a grep to confirm:
```bash
grep -E "#[0-9a-fA-F]{3,6}|bg-black|text-white|bg-white|text-black" src/app/debug/page.tsx
```
Expected: no hits (the file should already use CSS vars).

- [ ] **Step 4: Build**

Run: `npm run build 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/loading.tsx src/app/error.tsx src/app/debug/page.tsx
git commit -m "loading/error/debug: light editorial re-theme"
```

---

## Task 9: Flip PWA icons + manifest to light

**Files:**
- Modify: `src/app/icon.tsx`
- Modify: `src/app/apple-icon.tsx`
- Modify: `src/app/manifest.ts`

- [ ] **Step 1: Rewrite `icon.tsx`**

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
          background: "#FAFAF8",
          color: "#111111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          fontStyle: "italic",
          fontSize: 26,
          fontWeight: 400,
          letterSpacing: -1,
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

- [ ] **Step 2: Rewrite `apple-icon.tsx`**

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
          background: "#FAFAF8",
          color: "#111111",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 150,
            fontWeight: 300,
            fontStyle: "italic",
            letterSpacing: -6,
            lineHeight: 1,
            marginTop: -8,
          }}
        >
          P
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 14,
            fontSize: 10,
            letterSpacing: 2.5,
            color: "#6B6B6B",
            fontFamily: "monospace",
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

- [ ] **Step 3: Update `manifest.ts`**

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
    background_color: "#FAFAF8",
    theme_color: "#FAFAF8",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 4: Build + verify icon endpoints**

Run: `npm run build 2>&1 | tail -8`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/icon.tsx src/app/apple-icon.tsx src/app/manifest.ts
git commit -m "PWA: invert icons + manifest to light register"
```

---

## Task 10: Final verification + deploy + Lighthouse

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `cd ~/Developer/greenwich-park && npm run test 2>&1 | tail -8`
Expected: all tests PASS (≥115 total: 104 prior + 8 copy + 3 AvenueMap).

- [ ] **Step 2: Lint + TypeScript clean**

Run:
```bash
npm run lint 2>&1 | tail -3
npx tsc --noEmit 2>&1 | tail -3
npm run build 2>&1 | tail -8
```
Expected: no errors, no warnings.

- [ ] **Step 3: Push to deploy**

```bash
git push 2>&1 | tail -3
```

Wait for Vercel auto-deploy:
```bash
until curl -sS https://parking.philipcamuto.com/ 2>/dev/null | grep -q "Greenwich Avenue"; do sleep 4; done
echo "Live"
```

- [ ] **Step 4: Smoke-test the live URL**

```bash
curl -sS -o /dev/null -w "/: HTTP %{http_code}\n" https://parking.philipcamuto.com/
curl -sS -o /dev/null -w "/debug: HTTP %{http_code}\n" https://parking.philipcamuto.com/debug
curl -sS -o /dev/null -w "/icon: HTTP %{http_code}\n" https://parking.philipcamuto.com/icon
curl -sS -o /dev/null -w "/apple-icon: HTTP %{http_code}\n" https://parking.philipcamuto.com/apple-icon
curl -sS https://parking.philipcamuto.com/manifest.webmanifest | head -c 400
```
Expected: 200 across the board.

Verify the rendered HTML contains the new copy:
```bash
curl -sS https://parking.philipcamuto.com/ | grep -oE "Plenty of spots|Moderately busy|Tough today|Greenwich Avenue" | sort -u
```
Expected: at least one of the verdict phrases and "Greenwich Avenue" present.

Visually verify the apple-icon:
```bash
curl -sS -o /tmp/apple.png https://parking.philipcamuto.com/apple-icon
# Then Read /tmp/apple.png to confirm white-bg + dark "P"
```

- [ ] **Step 5: Lighthouse audit**

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx --yes lighthouse https://parking.philipcamuto.com/ \
  --only-categories=performance,accessibility,best-practices,seo \
  --form-factor=mobile --throttling-method=simulate \
  --output=json --output-path=/tmp/gp-lh-v2.json \
  --chrome-flags="--headless=new --disable-gpu --no-sandbox" --quiet 2>&1 | tail -5
```

Read scores:
```bash
python3 -c "import json; r=json.load(open('/tmp/gp-lh-v2.json')); [print(f'{v[\"title\"]}: {int(v[\"score\"]*100) if v[\"score\"] else \"n/a\"}') for v in r['categories'].values()]"
```
Expected: Performance ≥95, Accessibility 100, Best Practices 100, SEO 100. CLS should still be 0.

- [ ] **Step 6: Ask the user to open it on their iPhone**

Post-deploy message to user: "Open https://parking.philipcamuto.com on your iPhone. Look for: (a) the white editorial register, (b) the verdict word as the hero (not the number), (c) the Greenwich Ave schematic with hover on desktop / tap on phone, (d) clean rendering at both phone and laptop widths. Report anything that reads wrong."

- [ ] **Step 7: Final commit if any verification surface tweaks were needed**

If everything passed, no commit is needed. If a tweak was needed, commit it:
```bash
git add . && git commit -m "verify: post-deploy adjustments"
git push 2>&1 | tail -3
```

---

## Out of scope (deferred — do not implement)

- Dark mode toggle (defer)
- Real per-block demand tinting (Phase 3 — needs FOIA citation data)
- Map landmarks / shop labels (rejected during brainstorming for editorial register purity)
- Map zoom/pan (Phase 3 M2 upgrade)
- Live camera embed (rejected — CTDOT TOS)

---

## Risks

1. **Type clash mid-rewrite.** `<DemandScore />` and `page.tsx` change props together. The build will be broken between Tasks 3 and 7. That's expected. Don't try to fix the page in Task 3.
2. **React Testing Library + React 19 compat.** If `@testing-library/react@16` doesn't cleanly render the SVG, swap to a lower-tech assertion: render the component, then grep the rendered HTML string. Tests don't need to be sophisticated — they need to catch regressions.
3. **Lighthouse perf regression from the new component.** The AvenueMap is a client component, which adds JS bytes. Should be tiny (~2KB). If perf drops below 95, inline the SVG without `"use client"` and move the state to CSS-only hover (lose tap-to-select on mobile).
4. **PWA icon caching.** iOS aggressively caches home-screen icons. If your existing install of the old dark icon shows up after the redesign ships, it's iOS not the app. Remove + re-add to home screen.
