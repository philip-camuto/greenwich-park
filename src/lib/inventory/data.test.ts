import { describe, expect, it } from "vitest";
import {
  INVENTORY_TOTALS,
  PARKING_ZONES,
  getTotalByType,
  getZoneById,
  getZonesByType,
} from "./data";

describe("PARKING_ZONES", () => {
  it("has 12 zones", () => {
    expect(PARKING_ZONES).toHaveLength(12);
  });
  it("every id is unique", () => {
    const ids = PARKING_ZONES.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every section number is unique", () => {
    const sections = PARKING_ZONES.map((z) => z.section);
    expect(new Set(sections).size).toBe(sections.length);
  });
  it("every estimatedSpaces is a positive integer", () => {
    for (const z of PARKING_ZONES) {
      expect(z.estimatedSpaces).toBeGreaterThan(0);
      expect(Number.isInteger(z.estimatedSpaces)).toBe(true);
    }
  });
});

describe("helpers", () => {
  it("getZonesByType('ave_street') returns the 6 Ave zones", () => {
    expect(getZonesByType("ave_street")).toHaveLength(6);
  });
  it("getZonesByType('side_street') returns the 1 side-street zone", () => {
    expect(getZonesByType("side_street")).toHaveLength(1);
  });
  it("getZonesByType('off_ave_lot') returns the 5 lot zones", () => {
    expect(getZonesByType("off_ave_lot")).toHaveLength(5);
  });
  it("getTotalByType sums correctly", () => {
    expect(getTotalByType("ave_street")).toBe(231);
    expect(getTotalByType("side_street")).toBe(55);
    expect(getTotalByType("off_ave_lot")).toBe(443);
  });
  it("getZoneById finds and misses correctly", () => {
    expect(getZoneById("ave-1-north")?.section).toBe(1);
    expect(getZoneById("nope")).toBeNull();
  });
});

describe("INVENTORY_TOTALS", () => {
  it("derives totals from PARKING_ZONES", () => {
    expect(INVENTORY_TOTALS.aveStreet).toBe(231);
    expect(INVENTORY_TOTALS.sideStreet).toBe(55);
    expect(INVENTORY_TOTALS.offAveLots).toBe(443);
    expect(INVENTORY_TOTALS.total).toBe(729);
  });
  it("source string includes the source date", () => {
    expect(INVENTORY_TOTALS.source).toMatch(/2026-05-12/);
  });
});
