// OSM-derived block geometry, consumed at build time from a static artifact.
//
// The artifact (osm-geometry.json) is generated offline by
// `analysis/osm_geometry.py` (OSMnx, Python). OSMnx is NEVER a runtime
// dependency: this module only reads the committed JSON.
//
// Two signals per Greenwich Ave block:
//   - onStreetSpaces        curb length / 6.5 m, one nominal side. Measures
//                           what the hand `capacity` tier was guessing at.
//   - nearestLotWalkMeters  walk-network distance anchor -> nearest public
//                           lot. Measures what the hand `relief` tier guessed.
//
// IMPORTANT: this module is additive. It does NOT change the live demand model.
// `per-block.ts` still uses its hand-tuned tiers. The geometry here measures the
// same things precisely, and `tierDisagreements()` surfaces where OSM contradicts
// the hand tiers — a calibration decision for a human, not an automatic swap.
// (e.g. lewis__mason is hand-set capacity "low" but is the LONGEST block.)

import artifact from "./osm-geometry.json";
import { blockProfiles } from "@/lib/per-block";

export type Tier = "low" | "medium" | "high";

export type OsmBlockGeometry = {
  blockId: string;
  segmentMeters: number;
  onStreetSpaces: number;
  nearestLotWalkMeters: number | null;
  /** Public parking spaces reachable on foot within ~2 / ~5 minutes (catchment). */
  publicSpacesWithin2min: number;
  publicSpacesWithin5min: number;
};

export const osmGeometryMeta = artifact._meta;

export const osmBlockGeometry: Record<string, OsmBlockGeometry> =
  Object.fromEntries(
    (artifact.blocks as OsmBlockGeometry[]).map((b) => [b.blockId, b]),
  );

export function getOsmBlockGeometry(
  blockId: string,
): OsmBlockGeometry | undefined {
  return osmBlockGeometry[blockId];
}

// Split N blocks into low/medium/high by rank — bottom third low, top third
// high. `higherIsMore` says whether a larger value means more of the quantity
// (true for capacity = more spaces; false for relief = a SHORTER walk is more
// relief). Deterministic and dependency-free so the thresholds are testable.
function tiersByRank(
  items: { id: string; v: number }[],
  higherIsMore: boolean,
): Record<string, Tier> {
  // Sort ascending in "amount of the quantity": index 0 = least.
  const sorted = [...items].sort((a, b) =>
    higherIsMore ? a.v - b.v : b.v - a.v,
  );
  const out: Record<string, Tier> = {};
  sorted.forEach((item, i) => {
    const frac = i / sorted.length;
    out[item.id] = frac < 1 / 3 ? "low" : frac < 2 / 3 ? "medium" : "high";
  });
  return out;
}

/** OSM-derived capacity tier per block (more curb spaces = higher capacity). */
export function osmCapacityTiers(): Record<string, Tier> {
  const items = Object.values(osmBlockGeometry).map((b) => ({
    id: b.blockId,
    v: b.onStreetSpaces,
  }));
  return tiersByRank(items, true);
}

/** OSM-derived relief tier per block (shorter walk to a lot = more relief). */
export function osmReliefTiers(): Record<string, Tier> {
  const items = Object.values(osmBlockGeometry)
    .filter((b) => b.nearestLotWalkMeters != null)
    .map((b) => ({ id: b.blockId, v: b.nearestLotWalkMeters as number }));
  return tiersByRank(items, false);
}

export type TierDisagreement = {
  blockId: string;
  field: "capacity" | "relief";
  hand: Tier;
  osm: Tier;
};

/**
 * Where the OSM-derived tier disagrees with the hand-tuned tier in per-block.ts.
 * This is the calibration surface: each entry is a block where geometry says the
 * hand guess may be wrong. Resolving these (override geometry with local
 * knowledge, or accept the data) is a reviewed decision, not an auto-swap.
 */
export function tierDisagreements(): TierDisagreement[] {
  const cap = osmCapacityTiers();
  const relief = osmReliefTiers();
  const out: TierDisagreement[] = [];
  for (const [blockId, profile] of Object.entries(blockProfiles)) {
    if (cap[blockId] && cap[blockId] !== profile.capacity) {
      out.push({ blockId, field: "capacity", hand: profile.capacity, osm: cap[blockId] });
    }
    if (relief[blockId] && relief[blockId] !== profile.relief) {
      out.push({ blockId, field: "relief", hand: profile.relief, osm: relief[blockId] });
    }
  }
  return out;
}
