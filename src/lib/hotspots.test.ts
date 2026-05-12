import { describe, expect, it } from "vitest";
import { HOTSPOTS, hotspotById } from "./hotspots";
import { BLOCKS } from "@/components/avenue-map-data";

describe("HOTSPOTS", () => {
  it("has 4 entries", () => {
    expect(HOTSPOTS).toHaveLength(4);
  });
  it("each has a unique id", () => {
    const ids = HOTSPOTS.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every hotspot's blockId references a real block", () => {
    const blockIds = new Set(BLOCKS.map((b) => b.id));
    for (const h of HOTSPOTS) {
      expect(blockIds.has(h.blockId)).toBe(true);
    }
  });
  it("includes the four expected names", () => {
    const names = HOTSPOTS.map((h) => h.name).sort();
    expect(names).toEqual(
      ["Hinoki", "Rag & Bone", "Terra", "The Ginger Man"].sort(),
    );
  });
});

describe("hotspotById", () => {
  it("returns the matching hotspot", () => {
    expect(hotspotById("ginger-man")?.name).toBe("The Ginger Man");
  });
  it("returns null on miss", () => {
    expect(hotspotById("nope")).toBeNull();
  });
});
