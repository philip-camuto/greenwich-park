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
};

export const BLOCKS: AvenueBlock[] = NODES.slice(0, -1).map((n, i) => {
  const south = NODES[i + 1];
  return {
    id: `${n.id}__${south.id}`,
    northNodeId: n.id,
    southNodeId: south.id,
    label: `Between ${n.label} and ${south.label}`,
  };
});
