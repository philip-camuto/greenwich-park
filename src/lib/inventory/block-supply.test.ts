import { describe, expect, it } from "vitest";
import { blockProfiles } from "@/lib/per-block";
import { getOsmBlockGeometry } from "./osm-geometry";
import { getOsmLotsForBlock } from "./osm-lots";
import { allBlockSupply, blockSupply } from "./block-supply";

const BLOCK_IDS = Object.keys(blockProfiles);

describe("blockSupply (assembled best estimate)", () => {
  it("covers every modeled block", () => {
    expect(allBlockSupply().map((b) => b.blockId).sort()).toEqual(
      [...BLOCK_IDS].sort(),
    );
  });

  it("returns undefined for an unknown block", () => {
    expect(blockSupply("not_a_block")).toBeUndefined();
  });

  it("takes on-street straight from the geometry artifact", () => {
    for (const id of BLOCK_IDS) {
      expect(blockSupply(id)!.onStreetSpaces).toBe(
        getOsmBlockGeometry(id)!.onStreetSpaces,
      );
    }
  });

  it("off-street public estimate = sum of this block's candidate-public lots", () => {
    for (const id of BLOCK_IDS) {
      const expected = getOsmLotsForBlock(id)
        .filter((l) => l.candidatePublic)
        .reduce((s, l) => s + l.derivedSpaces, 0);
      expect(blockSupply(id)!.offStreetPublicEstimate).toBe(expected);
    }
  });

  it("public estimate never exceeds all-owner footprint", () => {
    for (const b of allBlockSupply()) {
      expect(b.offStreetPublicEstimate).toBeLessThanOrEqual(b.offStreetAllOwners);
    }
  });

  it("total = on-street + off-street public, and is the headline number", () => {
    for (const b of allBlockSupply()) {
      expect(b.totalPublicEstimate).toBe(
        b.onStreetSpaces + b.offStreetPublicEstimate,
      );
    }
  });

  it("labels on-street high confidence and off-street medium (honest provenance)", () => {
    const b = blockSupply("lewis__mason")!;
    expect(b.confidence.onStreet).toBe("high");
    expect(b.confidence.offStreet).toBe("medium");
  });

  it("carries catchment through from the geometry layer", () => {
    for (const id of BLOCK_IDS) {
      const s = blockSupply(id)!;
      const geo = getOsmBlockGeometry(id)!;
      expect(s.publicSpacesWithin2min).toBe(geo.publicSpacesWithin2min);
      expect(s.publicSpacesWithin5min).toBe(geo.publicSpacesWithin5min);
    }
  });
});
