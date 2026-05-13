// Four hand-picked landmarks on Greenwich Ave. Each maps to a block id from
// `avenue-map-data.ts`. Phase 1: per-hotspot score = its block's per-block
// score (which itself is global score + block.offset).

export type Hotspot = {
  id: string;
  name: string;
  address: string;
  subLabel: string; // shown under the name on the drill-down page
  blockId: string;
};

export const HOTSPOTS: Hotspot[] = [
  {
    id: "ginger-man",
    name: "The Ginger Man",
    address: "64 Greenwich Ave",
    subLabel: "Lower Ave · restaurant block",
    blockId: "havemeyer__arch",
  },
  {
    id: "terra",
    name: "Terra",
    address: "156 Greenwich Ave",
    subLabel: "Central Ave · Lewis to Mason",
    blockId: "lewis__mason",
  },
  {
    id: "apple",
    name: "Apple",
    address: "356 Greenwich Ave",
    subLabel: "Upper Ave · Apple/RH block",
    blockId: "lafayette__elm",
  },
  {
    id: "saks",
    name: "Saks",
    address: "205 Greenwich Ave",
    subLabel: "Central Ave · retail block",
    blockId: "mason__havemeyer",
  },
];

export function hotspotById(id: string): Hotspot | null {
  return HOTSPOTS.find((h) => h.id === id) ?? null;
}
