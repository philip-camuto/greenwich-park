import { describe, expect, it } from "vitest";
import { blockProfiles } from "@/lib/per-block";
import { getTotalByType } from "./data";
import {
  getOsmLotsForBlock,
  offStreetReconciliation,
  osmLots,
  osmLotsByBlock,
  osmLotsMeta,
} from "./osm-lots";

const BLOCK_IDS = Object.keys(blockProfiles);

describe("osm-lots artifact integrity", () => {
  it("has lots, each with a positive footprint and derived spaces", () => {
    expect(osmLots.length).toBeGreaterThan(0);
    for (const l of osmLots) {
      expect(l.areaM2).toBeGreaterThan(0);
      expect(l.derivedSpaces).toBeGreaterThan(0);
      // derivedSpaces == round(area / 30) -- keep the artifact self-consistent.
      expect(l.derivedSpaces).toBe(Math.round(l.areaM2 / osmLotsMeta.m2PerStall));
    }
  });

  it("excludes on-street street_side bays (counted by osm-geometry, not here)", () => {
    for (const l of osmLots) {
      expect(l.parkingType).not.toBe("street_side");
    }
    expect(osmLotsMeta.droppedStreetSide).toBeGreaterThan(0);
  });

  it("assigns every lot to a real modeled block", () => {
    for (const l of osmLots) {
      expect(BLOCK_IDS).toContain(l.blockId);
    }
  });

  it("every lot has coordinates inside downtown Greenwich", () => {
    for (const l of osmLots) {
      expect(l.lat).toBeGreaterThan(41.02);
      expect(l.lat).toBeLessThan(41.035);
      expect(l.lon).toBeGreaterThan(-73.632);
      expect(l.lon).toBeLessThan(-73.623);
    }
  });

  it("per-block totals match the sum of that block's lots", () => {
    for (const bid of BLOCK_IDS) {
      const byBlock = osmLotsByBlock[bid];
      const lots = getOsmLotsForBlock(bid);
      expect(byBlock.lotCount).toBe(lots.length);
      expect(byBlock.offStreetSpaces).toBe(
        lots.reduce((s, l) => s + l.derivedSpaces, 0),
      );
    }
  });
});

describe("offStreetReconciliation (flag vs hand counts)", () => {
  it("reports the inventory's live public off-lot total", () => {
    const r = offStreetReconciliation();
    expect(r.inventoryPublicTotal).toBe(getTotalByType("off_ave_lot"));
  });

  it("OSM all-owner footprint is a superset, far larger than public inventory", () => {
    // Locks the key finding: OSM sweeps in private/institutional lots, so its
    // total dwarfs the public-only inventory. This is the population gap, not a
    // discrepancy to 'fix'. If this ever inverts, something changed -- re-look.
    const r = offStreetReconciliation();
    expect(r.osmTotalAllOwners).toBeGreaterThan(r.inventoryPublicTotal);
    expect(r.osmLikelyPublic).toBeLessThanOrEqual(r.osmTotalAllOwners);
  });
});
