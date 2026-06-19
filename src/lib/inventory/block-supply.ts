// block-supply.ts — the assembled best estimate of parking supply per block.
//
// This is the synthesis layer. It consolidates the two OSM artifacts and the
// hand inventory, taking the most accurate source for each field rather than
// trusting one source wholesale:
//
//   field                     source                        confidence
//   ───────────────────────   ───────────────────────────   ──────────
//   onStreetSpaces            OSM both-sides parkable curb   HIGH   (geometry,
//                             (osm-geometry.ts)                     ~223 total vs
//                                                                   231 eyeballed)
//   offStreetPublicEstimate   OSM measured public-candidate  MEDIUM (footprint is
//                             lots in this block                    real; "public"
//                             (osm-lots.ts)                         is a size/dist
//                                                                   heuristic, not
//                                                                   curated)
//   nearestLotWalkMeters      OSM walk-network routing       HIGH
//                             (osm-geometry.ts)
//
// Nothing here is ground truth — FOIA stall counts from Greenwich Parking
// Services settle that. Until then this is the defensible geometric estimate.
// It is additive: the live demand model still uses per-block.ts's hand tiers.

import { getOsmBlockGeometry, osmBlockGeometry } from "./osm-geometry";
import { getOsmLotsForBlock } from "./osm-lots";

export type SupplyConfidence = "high" | "medium" | "low";

export type BlockSupply = {
  blockId: string;
  /** OSM both-sides parkable curb. Geometry-grounded, per block. */
  onStreetSpaces: number;
  /** Measured footprint of the block's likely-public lots (size+distance hint). */
  offStreetPublicEstimate: number;
  /** All off-street footprint in the block, public + private (context only). */
  offStreetAllOwners: number;
  /** Real walk-network distance from the block anchor to the nearest public lot. */
  nearestLotWalkMeters: number | null;
  /** Public spaces reachable on foot within ~2 / ~5 min (catchment supply). */
  publicSpacesWithin2min: number;
  publicSpacesWithin5min: number;
  /** onStreet + offStreetPublicEstimate. The headline "spots near here." */
  totalPublicEstimate: number;
  confidence: { onStreet: SupplyConfidence; offStreet: SupplyConfidence };
};

export function blockSupply(blockId: string): BlockSupply | undefined {
  const geo = getOsmBlockGeometry(blockId);
  if (!geo) return undefined;

  const lots = getOsmLotsForBlock(blockId);
  const offStreetPublicEstimate = lots
    .filter((l) => l.candidatePublic)
    .reduce((s, l) => s + l.derivedSpaces, 0);
  const offStreetAllOwners = lots.reduce((s, l) => s + l.derivedSpaces, 0);

  return {
    blockId,
    onStreetSpaces: geo.onStreetSpaces,
    offStreetPublicEstimate,
    offStreetAllOwners,
    nearestLotWalkMeters: geo.nearestLotWalkMeters,
    publicSpacesWithin2min: geo.publicSpacesWithin2min,
    publicSpacesWithin5min: geo.publicSpacesWithin5min,
    totalPublicEstimate: geo.onStreetSpaces + offStreetPublicEstimate,
    confidence: { onStreet: "high", offStreet: "medium" },
  };
}

export function allBlockSupply(): BlockSupply[] {
  // osm-geometry.ts owns the canonical block set; drive off it (no duplicate list).
  return Object.keys(osmBlockGeometry)
    .map((id) => blockSupply(id))
    .filter((b): b is BlockSupply => b != null);
}
