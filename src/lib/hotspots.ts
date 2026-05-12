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
    subLabel: "Lower Ave · Havemeyer Pl to Arch St",
    blockId: "havemeyer__arch",
  },
  {
    id: "terra",
    name: "Terra",
    address: "156 Greenwich Ave",
    subLabel: "Mid Ave · Lewis Ct to Mason / Bolling",
    blockId: "lewis__mason",
  },
  {
    id: "rag-bone",
    name: "Rag & Bone",
    address: "50 Greenwich Ave",
    subLabel: "Lower Ave · Havemeyer Pl to Arch St",
    blockId: "havemeyer__arch",
  },
  {
    id: "hinoki",
    name: "Hinoki",
    address: "298 Greenwich Ave",
    subLabel: "Upper-mid Ave · Lewis Ct to Mason / Bolling",
    blockId: "lewis__mason",
  },
];

export function hotspotById(id: string): Hotspot | null {
  return HOTSPOTS.find((h) => h.id === id) ?? null;
}
