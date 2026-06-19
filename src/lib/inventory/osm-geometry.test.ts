import { describe, expect, it } from "vitest";
import { blockProfiles } from "@/lib/per-block";
import {
  getOsmBlockGeometry,
  osmBlockGeometry,
  osmCapacityTiers,
  osmGeometryMeta,
  osmReliefTiers,
  tierDisagreements,
} from "./osm-geometry";

// The 6 Greenwich Ave blocks, in the same set per-block.ts models.
const BLOCK_IDS = Object.keys(blockProfiles);

describe("osm-geometry artifact integrity", () => {
  it("covers every modeled block exactly once", () => {
    expect(Object.keys(osmBlockGeometry).sort()).toEqual([...BLOCK_IDS].sort());
  });

  it("on-street spaces are positive and derived from both-sides parkable curb", () => {
    const { sides, parkableFraction, metersPerSpace } = osmGeometryMeta;
    for (const b of Object.values(osmBlockGeometry)) {
      expect(b.onStreetSpaces).toBeGreaterThan(0);
      // spaces == round(sides * segmentMeters * parkableFraction / metersPerSpace)
      // — both curb sides minus unparkable, kept self-consistent with the meta.
      expect(b.onStreetSpaces).toBe(
        Math.round((sides * b.segmentMeters * parkableFraction) / metersPerSpace),
      );
    }
  });

  it("on-street total lands near the hand inventory (~223 vs 231 eyeballed)", () => {
    const total = Object.values(osmBlockGeometry).reduce(
      (s, b) => s + b.onStreetSpaces,
      0,
    );
    expect(total).toBeGreaterThan(200);
    expect(total).toBeLessThan(250);
  });

  it("block segments sum to roughly the full avenue (~905m), no gaps", () => {
    const total = Object.values(osmBlockGeometry).reduce(
      (s, b) => s + b.segmentMeters,
      0,
    );
    expect(total).toBeGreaterThan(880);
    expect(total).toBeLessThan(930);
  });

  it("getOsmBlockGeometry returns undefined for unknown blocks", () => {
    expect(getOsmBlockGeometry("not_a_block")).toBeUndefined();
    expect(getOsmBlockGeometry("lewis__mason")?.onStreetSpaces).toBe(53);
  });

  it("catchment is monotonic: 5-min reach >= 2-min reach, both non-negative", () => {
    for (const b of Object.values(osmBlockGeometry)) {
      expect(b.publicSpacesWithin2min).toBeGreaterThanOrEqual(0);
      expect(b.publicSpacesWithin5min).toBeGreaterThanOrEqual(
        b.publicSpacesWithin2min,
      );
    }
  });

  it("a central block reaches more parking in 2 min than a peripheral one", () => {
    // lewis__mason sits mid-avenue with lots behind it; arch__railroad is the
    // short bottom block by the station. Catchment should rank them that way.
    expect(getOsmBlockGeometry("lewis__mason")!.publicSpacesWithin2min).toBeGreaterThan(
      getOsmBlockGeometry("arch__railroad")!.publicSpacesWithin2min,
    );
  });
});

describe("derived tiers", () => {
  it("ranks capacity high for the longest block, low for the shortest", () => {
    const cap = osmCapacityTiers();
    // lewis__mason is the longest block (214m, 33 spaces) -> high capacity.
    expect(cap.lewis__mason).toBe("high");
    // arch__railroad is the short bottom block (63m, 10 spaces) -> low.
    expect(cap.arch__railroad).toBe("low");
  });

  it("ranks relief high where the nearest PUBLIC lot is closest", () => {
    const relief = osmReliefTiers();
    // lewis__mason (19m) and havemeyer__arch (18m) have public lots right behind.
    expect(relief.lewis__mason).toBe("high");
    expect(relief.havemeyer__arch).toBe("high");
    // elm__lewis: private parking is adjacent, but the nearest PUBLIC lot is
    // 166m away -> low relief. This is the correctness fix: relief routes to
    // usable public lots, not any parking polygon.
    expect(relief.elm__lewis).toBe("low");
  });

  it("splits 6 blocks into 2 low / 2 medium / 2 high", () => {
    const tally = (t: Record<string, string>) =>
      Object.values(t).reduce<Record<string, number>>(
        (a, v) => ({ ...a, [v]: (a[v] ?? 0) + 1 }),
        {},
      );
    expect(tally(osmCapacityTiers())).toEqual({ low: 2, medium: 2, high: 2 });
    expect(tally(osmReliefTiers())).toEqual({ low: 2, medium: 2, high: 2 });
  });
});

describe("tierDisagreements (calibration surface)", () => {
  it("flags the lewis__mason capacity contradiction (hand low, OSM high)", () => {
    // Locks the key finding into a test: the Saks block is hand-set capacity
    // "low" but is geometrically the highest-capacity block. If someone
    // changes the hand tier OR the artifact, this test forces a re-look.
    const d = tierDisagreements();
    expect(d).toContainEqual({
      blockId: "lewis__mason",
      field: "capacity",
      hand: "low",
      osm: "high",
    });
  });

  it("every disagreement references a real block and a real field", () => {
    for (const d of tierDisagreements()) {
      expect(BLOCK_IDS).toContain(d.blockId);
      expect(["capacity", "relief"]).toContain(d.field);
      expect(d.hand).not.toBe(d.osm);
    }
  });
});
