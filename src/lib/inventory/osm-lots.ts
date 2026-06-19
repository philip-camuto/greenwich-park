// OSM-measured off-street parking footprints, consumed at build time from a
// static artifact generated offline by `analysis/osm_lots.py` (OSMnx). OSMnx is
// never a runtime dependency.
//
// This REPLACES the eyeballed-from-satellite premise of the off-street counts in
// data.ts with footprint-derived measurements. Honest caveats, baked into the
// reconciliation below:
//   - OSM has no `access` tags downtown, so this is ALL off-street footprint
//     (public + private). data.ts's off_ave_lot zones are PUBLIC rear lots only
//     -- a subset. The totals are NOT the same population.
//   - `parking=street_side` (on-street curb) is excluded upstream; it's counted
//     by osm-geometry.ts instead.
//   - multi-storey garages: derivedSpaces is a one-level FLOOR, not a true count.

import artifact from "./osm-lots.json";
import { getTotalByType } from "./data";

export type OsmLot = {
  id: string;
  areaM2: number;
  derivedSpaces: number;
  parkingType: string | null;
  multiStorey: boolean;
  name: string | null;
  blockId: string;
  distToAveM: number;
  lat: number;
  lon: number;
  candidatePublic: boolean;
};

export type OsmLotsByBlock = {
  blockId: string;
  lotCount: number;
  offStreetSpaces: number;
};

export const osmLotsMeta = artifact._meta;
export const osmLots = artifact.lots as OsmLot[];

export const osmLotsByBlock: Record<string, OsmLotsByBlock> = Object.fromEntries(
  (artifact.byBlock as OsmLotsByBlock[]).map((b) => [b.blockId, b]),
);

export function getOsmLotsForBlock(blockId: string): OsmLot[] {
  return osmLots.filter((l) => l.blockId === blockId);
}

export type OffStreetReconciliation = {
  /** All off-street footprint OSM sees near the Ave (public + private). */
  osmTotalAllOwners: number;
  /** OSM lots large + close enough to read as public/commercial (a hint). */
  osmLikelyPublic: number;
  /** data.ts hand estimate, PUBLIC rear lots only. */
  inventoryPublicTotal: number;
  /** Why the totals differ -- they are different populations, not a bug. */
  note: string;
};

/**
 * Reconcile OSM footprint measurements against the hand-built public-lot
 * inventory. The point is NOT "OSM proves the inventory wrong": OSM counts every
 * owner's lot, the inventory counts public rear lots only. The useful output is
 * the measured footprint (per lot, per block) plus this explicit framing so the
 * gap isn't mistaken for an error.
 */
export function offStreetReconciliation(): OffStreetReconciliation {
  const osmTotalAllOwners = osmLots.reduce((s, l) => s + l.derivedSpaces, 0);
  const osmLikelyPublic = osmLots
    .filter((l) => l.candidatePublic)
    .reduce((s, l) => s + l.derivedSpaces, 0);
  const inventoryPublicTotal = getTotalByType("off_ave_lot");
  return {
    osmTotalAllOwners,
    osmLikelyPublic,
    inventoryPublicTotal,
    note:
      "OSM measures all off-street footprint near the Ave (public + private); " +
      "the inventory tracks public rear lots only. The gap is mostly private " +
      "and institutional lots, not an inventory error. Naming which OSM lots " +
      "are the public ones needs a human (OSM has no access tags downtown).",
  };
}
