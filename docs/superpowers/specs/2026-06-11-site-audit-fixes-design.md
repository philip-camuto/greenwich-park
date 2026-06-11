# Site audit fixes — 2026-06-11

Full design + functionality audit of parking.philipcamuto.com (3 parallel
sweeps: copy/typography, scrubber/forecast logic, live HTTP probe, plus
rendered mobile/desktop screenshots). Findings approved for fix by owner;
decisions: BEST window 8am-9pm, overnight strip stays green, full polish
scope included.

## Functional bugs

1. **Ingest inputs all dead on the on-demand path.** Rows written by
   visitor-triggered refreshes had every source ok:false (score = priors +
   school calendar only, "Limited signal"). Cron-triggered rows were healthy;
   sources all OK locally. Two candidate causes removed: AbortSignal passed
   into Next's patched data-cached fetch (now Promise.race, no signal,
   15s budget), and cold-instance contention from refreshing inline with the
   page render's own fetches (now serve stale-but-displayable row + refresh
   post-response via the previously-unwired `scheduleRefresh()`).
2. **GitHub cron fired every 3-5 hours, not 30 min.** Scheduled runs on
   :00/:30 get throttled; moved to :13/:43.
3. **"BEST 12:09 AM".** Best time was the global 12h score minimum with no
   hour constraint → always recommends ~midnight across a midnight-crossing
   window. Now constrained to 8am-9pm (`BEST_HOUR_START/END`); card hides if
   nothing qualifies.
4. **":09" fake precision.** Forecast slots now snap to the half-hour grid
   (slot 0 stays literal now).
5. **Two unexplained dots on the strip.** Scrub handle rendered at NOW even
   when idle (its companion line was opacity-gated; the dot wasn't). Handle
   now hidden at rest; BEST ring stays mounted but dims to 0.3 while
   scrubbing (was unmounting) and gains a "BEST" microlabel tying it to the
   card.
6. **Night slots got the sunny-day boost.** Future-slot `isDay` was frozen
   from the current snapshot; now derived from local hour (7-19).
7. **Pin-at-NOW score jump.** Pinning slot 0 swapped the headline from the
   observation score to the modeled slot-0 score; slot 0 now keeps the
   observation.
8. **"6 signals held the line" while 6 signals were down.** Quiet rows now
   split: "held the line" vs "unavailable" by reason.

## Copy / typography (owner rules: no em dashes, no middots, plain voice)

- 11 middots removed (score eyebrow, hotspot sublabels, baseline header,
  day control, avenue map readout, hotspot detail, debug sections).
- 10 em-dash reason strings in breakdown-view rewritten with plain
  punctuation; "—" placeholder fallbacks replaced.
- `&rsquo;` → `&apos;`; "96 ° Cloudy" → "96° Cloudy"; bare "-" data
  placeholders → "No data"; stale "next 4 hours" → 12.
- Score eyebrow now reads "DEMAND SCORE  UPDATED 2:59 PM" (explains why it
  differs from the strip's NOW time).
- Hotspot rows: dropped the anchor reason (repeated the row title and
  truncated on phones); sublabel only.
- "Hover or tap a block" → "Tap a block".

## Polish

- Styled `not-found.tsx` (was Next's stock 404).
- Open Graph + Twitter metadata, canonical URL, programmatic OG image
  (`opengraph-image.tsx`).
- Desktop day control: empty time input ("--:-- --") hidden until a custom
  date/time is in play.

## Known and accepted

- Overnight strip segments stay green (owner decision; "low demand" reading
  is technically true).
- Invalid hotspot ids soft-404 with HTTP 200 (force-dynamic + streamed
  loading shell); styled 404 body renders, status stays 200. Revisit if
  crawlers matter.
- `/hotspot/[id]` ids in inventory: all 12 render.

## Verification

217 vitest tests (3 new: BEST hour window, no-overnight recommendation,
half-hour grid snap), eslint, tsc, production build, post-deploy screenshot
comparison.
