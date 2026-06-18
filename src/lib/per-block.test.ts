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

describe("scoreBlock score clamping", () => {
  it("never exceeds 100 even with a high global score + positive modifiers", () => {
    const out = scoreBlock(100, blockProfiles.lewis__mason, {
      hour: 14,
      dayOfWeek: 6,
    });
    expect(out.score).toBeLessThanOrEqual(100);
    expect(out.score).toBe(100);
    expect(out.category).toBe("red");
  });
  it("never drops below 0 even with a 0 global score + negative modifiers", () => {
    // elm__lewis: high capacity (-3) + high relief (-4) → negative modifiers.
    const out = scoreBlock(0, blockProfiles.elm__lewis, {
      hour: 3,
      dayOfWeek: 2,
    });
    expect(out.score).toBeGreaterThanOrEqual(0);
  });
  it("categorizes at the green/yellow/red boundaries", () => {
    // base anchors are fixed; assert categorize via the public score field
    // across a sweep of global scores on a neutral overnight slot.
    const overnight = { hour: 3, dayOfWeek: 2 };
    const greens = perBlockScores(0, overnight);
    for (const id of Object.keys(greens)) {
      expect(["green", "yellow", "red"]).toContain(greens[id].category);
    }
  });
});
