# Lot curation verdict (data-reasoned)

Worked through the 5 proposed OSM matches from `lot-curation-worksheet.md`.
Method: I can't see satellite imagery, so this reasons from lot size vs the
hand estimate and geometry. Confidence is explicit; the one case data can't
resolve is flagged for an eyes-on map check.

The tell is the ratio of OSM-measured spaces to the hand estimate. A real
public rear lot should roughly match; a big over/under-shoot means the OSM
polygon is capturing the wrong thing (a whole-block parcel, or a split piece).

| zone | hand | OSM | ratio | verdict | confidence |
|---|---|---|---|---|---|
| CVS / USPS / Le Penguin (Mason rear) | 58 | 187 | 3.2x | keep hand 58 | high |
| Benedict / Lewis municipal | 145 | 77 | 0.5x | keep hand 145 | high |
| Saks / Mason rear | 115 | 322 | 2.8x | NEEDS MAP CHECK | low |
| Happy Monkey / Jean-Georges / Eastend | 60 | 84 | 1.4x | keep hand 60 (OSM plausible-high) | medium |
| MOLI / Core Burn / Charles Hilton | 65 | 150 | 2.3x | keep hand 65 | high |

## Per-zone reasoning

- **CVS rear (58):** OSM polygon is 5,610 m², 3.2x the hand number. A 58-space
  rear lot is ~1,740 m². The polygon is grabbing the whole block-interior
  parcel (building lot + service area), not the public rear spaces. Keep 58.
- **Benedict / Lewis municipal (145):** OSM is HALF the hand number (77 vs 145).
  This is the known big municipal lot; a 145-space lot is ~4,350 m² but OSM
  matched a 2,303 m² polygon. Either the lot is split across OSM polygons or
  it's a deck (footprint undercounts levels). Hand 145 is the better number.
- **Saks / Mason rear (115):** OSM is 9,652 m² (322 spaces, 2.8x). This one is
  genuinely ambiguous: that parcel is big enough to be a real large municipal
  lot OR a private/whole-block lot the inventory rightly excludes. Data can't
  decide. **This is the one to check on a map** (the worksheet map link).
- **Happy Monkey / Eastend (60):** OSM 84, ratio 1.4x. Closest to plausible.
  If anything the public capacity here may be a touch higher than 60, but it's
  within noise. Keep 60.
- **MOLI / Core Burn (65):** OSM 150, 2.3x. Over-captures a larger parcel. Keep 65.

## Bottom line

The curation VALIDATES the hand inventory rather than replacing it. For 4 of 5
zones the hand estimate is the better PUBLIC number; OSM confirms the lot
LOCATIONS but its polygons over-capture (whole-block parcels) or under-capture
(split lots / decks). The OSM "public-candidate" inflation (820 matched, 1,368
total) is parcel-capture artifact, not real public spaces.

So: **do NOT adopt the OSM off-street counts into `data.ts`. The hand 443 holds.**
One open item for you: eyeball the Saks parcel (9,652 m²) on the worksheet map
link to decide whether it's a large public lot worth revising 115 upward.
