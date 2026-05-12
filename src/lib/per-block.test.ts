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
    const topBlock = out[BLOCKS[0].id];
    const bottomBlock = out[BLOCKS[BLOCKS.length - 1].id];
    expect(topBlock.score).toBeGreaterThan(bottomBlock.score);
  });
});
