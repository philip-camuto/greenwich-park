import { describe, expect, it } from "vitest";
import { HOTSPOTS, hotspotById } from "./hotspots";
import { BLOCKS } from "@/components/avenue-map-data";

describe("HOTSPOTS", () => {
  it("has one entry per avenue block (6)", () => {
    expect(HOTSPOTS).toHaveLength(6);
  });
  it("covers every avenue block exactly once", () => {
    const blockIds = HOTSPOTS.map((h) => h.blockId);
    expect(new Set(blockIds).size).toBe(BLOCKS.length);
    expect(blockIds).toHaveLength(BLOCKS.length);
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
  it("includes the six expected names", () => {
    const names = HOTSPOTS.map((h) => h.name).sort();
    expect(names).toEqual(
      [
        "CVS",
        "Eastend",
        "Hermès",
        "La Taqueria",
        "RH Gallery",
        "Saks Fifth Avenue",
      ].sort(),
    );
  });
});

describe("hotspotById", () => {
  it("returns the matching hotspot", () => {
    expect(hotspotById("la-taqueria")?.name).toBe("La Taqueria");
  });
  it("returns null on miss", () => {
    expect(hotspotById("nope")).toBeNull();
  });
});
