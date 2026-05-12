// Pure data. Seven nodes (top → bottom = north → south), six blocks between
// them. `side` tells the renderer where to drop the cross-street label and
// whether the cross stub goes east, west, or both.
//
// Y positions are normalized 0..1 inside the SVG; the renderer scales them
// into actual pixels.

export type CrossSide = "east" | "west" | "both" | "terminus";

export type AvenueNode = {
  id: string;
  label: string;
  y: number; // 0 = top (north), 1 = bottom (south)
  side: CrossSide;
};

export const NODES: AvenueNode[] = [
  { id: "lafayette", label: "Lafayette / Putnam", y: 0.0, side: "terminus" },
  { id: "elm", label: "Elm St", y: 0.18, side: "both" },
  { id: "lewis", label: "Lewis Ct", y: 0.34, side: "east" },
  { id: "mason", label: "Mason / Bolling", y: 0.5, side: "both" },
  { id: "havemeyer", label: "Havemeyer Pl", y: 0.66, side: "east" },
  { id: "arch", label: "Arch St", y: 0.82, side: "both" },
  { id: "railroad", label: "Steamboat / Railroad", y: 1.0, side: "terminus" },
];

export type AvenueBlock = {
  id: string;
  northNodeId: string;
  southNodeId: string;
  label: string; // human-readable, used in tooltip
  offset: number;
};

// Hand-tuned per-block offsets (Phase 1.5). Calibration guesses based on
// common Greenwich Ave observation — Phase 3 FOIA data replaces these.
const OFFSET_BY_BLOCK_INDEX: Record<number, number> = {
  0: 3,  // Lafayette/Putnam → Elm
  1: 2,  // Elm → Lewis
  2: 0,  // Lewis → Mason
  3: -2, // Mason → Havemeyer
  4: 1,  // Havemeyer → Arch
  5: -3, // Arch → Steamboat
};

export const BLOCKS: AvenueBlock[] = NODES.slice(0, -1).map((n, i) => {
  const south = NODES[i + 1];
  return {
    id: `${n.id}__${south.id}`,
    northNodeId: n.id,
    southNodeId: south.id,
    label: `Between ${n.label} and ${south.label}`,
    offset: OFFSET_BY_BLOCK_INDEX[i] ?? 0,
  };
});
