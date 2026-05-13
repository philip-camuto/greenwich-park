import { describe, expect, it } from "vitest";
import { blockProfiles, perBlockScores, scoreBlock } from "./per-block";
import { BLOCKS } from "@/components/avenue-map-data";

describe("scoreBlock", () => {
  it("combines capacity, anchor, time, and relief into an explainable score", () => {
    const saksBlock = blockProfiles.lewis__mason;
    const out = scoreBlock(55, saksBlock, { hour: 14, dayOfWeek: 6 });
    expect(out.score).toBeGreaterThan(55);
    expect(out.reasons.join(" ")).toMatch(/Saks/i);
    expect(out.reasons.join(" ")).toMatch(/shopping/i);
  });
  it("the topmost block (offices + banks) scores below an anchor-heavy block", () => {
    const top = blockProfiles.lafayette__elm;
    const out = scoreBlock(55, top, { hour: 14, dayOfWeek: 2 });
    expect(out.score).toBeLessThan(
      scoreBlock(55, blockProfiles.lewis__mason, { hour: 14, dayOfWeek: 2 }).score,
    );
  });
});

describe("perBlockScores", () => {
  it("returns one entry per block keyed by block id", () => {
    const out = perBlockScores(60);
    expect(Object.keys(out).sort()).toEqual(BLOCKS.map((b) => b.id).sort());
  });
  it("each score includes category", () => {
    const out = perBlockScores(60, { hour: 19, dayOfWeek: 5 });
    for (const id of Object.keys(out)) {
      expect(["green", "yellow", "red"]).toContain(out[id].category);
      expect(out[id].reasons.length).toBeGreaterThan(0);
    }
  });
  it("restaurant-heavy blocks heat up during dinner", () => {
    const dinner = perBlockScores(55, { hour: 19, dayOfWeek: 5 });
    const morning = perBlockScores(55, { hour: 9, dayOfWeek: 5 });
    expect(dinner.lafayette__elm.score).toBeGreaterThan(
      morning.lafayette__elm.score,
    );
  });
});
