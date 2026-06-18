"use client";

import { useState } from "react";
import { verdictFor } from "@/lib/copy";
import type { DemandCategory } from "@/lib/model/types";
import type { PerBlockScore } from "@/lib/per-block";
import { BLOCKS, NODES } from "./avenue-map-data";

type Props = {
  category: DemandCategory;
  perBlock?: Record<string, PerBlockScore>;
  score: number;
  verdict: string;
};

const FILL: Record<DemandCategory, string> = {
  green: "var(--map-fill-quiet)",
  yellow: "var(--map-fill-busy)",
  red: "var(--map-fill-tough)",
};

// SVG geometry. The Ave is a vertical spine; stubs branch east/west.
const W = 340;
const H = 480;
const PAD = { t: 16, r: 96, b: 16, l: 96 };
const innerH = H - PAD.t - PAD.b;
const spineX = W / 2;
const stubLen = 56;

function yAt(yNorm: number): number {
  return PAD.t + yNorm * innerH;
}

export function AvenueMap({ category, perBlock, score, verdict }: Props) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto block h-auto w-full max-w-[320px] lg:max-w-[360px]"
        role="group"
        aria-label="Greenwich Avenue block diagram"
      >
        {/* block fills (drawn behind the spine) */}
        {BLOCKS.map((b) => {
          const yN = yAt(NODES.find((n) => n.id === b.northNodeId)!.y);
          const yS = yAt(NODES.find((n) => n.id === b.southNodeId)!.y);
          const isActive = activeBlockId === b.id;
          const block = perBlock?.[b.id];
          return (
            <g key={b.id}>
              <rect
                x={spineX - 8}
                y={yN}
                width={16}
                height={yS - yN}
                fill={FILL[block?.category ?? category]}
                style={{ transition: "fill 600ms ease-out" }}
              />
              {/* hit + focus target */}
              <rect
                x={spineX - 20}
                y={yN}
                width={40}
                height={yS - yN}
                fill={isActive ? "var(--hover-fill)" : "transparent"}
                stroke={isActive ? "var(--label-primary)" : "transparent"}
                strokeWidth={2.5}
                role="button"
                tabIndex={0}
                aria-label={`${b.label}, demand ${block?.score ?? score} of 100`}
                onMouseEnter={() => setActiveBlockId(b.id)}
                onMouseLeave={() =>
                  setActiveBlockId((cur) => (cur === b.id ? null : cur))
                }
                onFocus={() => setActiveBlockId(b.id)}
                onBlur={() =>
                  setActiveBlockId((cur) => (cur === b.id ? null : cur))
                }
                onClick={() => setActiveBlockId(b.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveBlockId(b.id);
                  }
                }}
                style={{
                  cursor: "pointer",
                  outline: "none",
                  transition: "stroke 200ms ease-out, fill 200ms ease-out",
                }}
              />
            </g>
          );
        })}

        {/* Decorations sit visually on top of the hit targets, so route
            pointer events past them — otherwise the 1px spine line steals
            the hover when the cursor lands exactly on it. */}
        <g pointerEvents="none">
          {/* Ave spine */}
          <line
            x1={spineX}
            y1={PAD.t}
            x2={spineX}
            y2={H - PAD.b}
            stroke="var(--map-line)"
            strokeWidth={1}
          />

          {/* cross-street stubs + nodes + labels */}
          {NODES.map((n) => {
          const y = yAt(n.y);
          const showEast = n.side === "east" || n.side === "both";
          const showWest = n.side === "west" || n.side === "both";
          const isTerm = n.side === "terminus";
          return (
            <g key={n.id}>
              {/* node dot */}
              <circle cx={spineX} cy={y} r={3} fill="var(--map-line)" />

              {/* east stub */}
              {showEast && (
                <line
                  x1={spineX}
                  y1={y}
                  x2={spineX + stubLen}
                  y2={y}
                  stroke="var(--map-line)"
                  strokeWidth={1}
                />
              )}
              {/* west stub */}
              {showWest && (
                <line
                  x1={spineX}
                  y1={y}
                  x2={spineX - stubLen}
                  y2={y}
                  stroke="var(--map-line)"
                  strokeWidth={1}
                />
              )}
              {/* terminus tick */}
              {isTerm && (
                <line
                  x1={spineX - 16}
                  y1={y}
                  x2={spineX + 16}
                  y2={y}
                  stroke="var(--map-line)"
                  strokeWidth={1}
                />
              )}

              {/* label */}
              <text
                x={
                  showEast || isTerm
                    ? spineX + stubLen + 6
                    : spineX - stubLen - 6
                }
                y={y + 3}
                fill="var(--label-secondary)"
                fontSize={10}
                fontFamily="var(--font-mono), ui-monospace, monospace"
                fontWeight={500}
                letterSpacing="0.08em"
                textAnchor={showEast || isTerm ? "start" : "end"}
              >
                {n.shortLabel.toUpperCase()}
              </text>
            </g>
          );
        })}
        </g>
      </svg>

      {/* Tooltip / readout. Reserves ~3 lines of height so swapping between
          the empty hint and a hover string keeps reflow of the description
          and BreakdownCard below to a minimum. Full text shown (no clamp) so
          the whole block readout is legible on a tap. */}
      <div
        aria-live="polite"
        className="mono min-h-[3.4em] text-center text-[11px] font-medium uppercase leading-snug tracking-[0.08em] text-[var(--label-secondary)]"
      >
        {activeBlockId
          ? readoutFor(activeBlockId, verdict, score, perBlock)
          : "Tap a block"}
      </div>

      <p className="text-center text-[12px] leading-relaxed text-[var(--label-tertiary)]">
        The trained demand surface scored block by block down Greenwich Ave, top of the Ave to the train.
      </p>
    </div>
  );
}

function readoutFor(
  blockId: string,
  verdict: string,
  score: number,
  perBlock?: Record<string, PerBlockScore>,
): string {
  const b = BLOCKS.find((x) => x.id === blockId);
  if (!b) return "";
  const block = perBlock?.[blockId];
  const blockScore = block?.score ?? score;
  const blockVerdict = block ? verdictFor(block.category) : verdict;
  const reason = block?.reasons[0];
  return [
    b.label.toUpperCase(),
    blockVerdict.toUpperCase(),
    `${blockScore}/100`,
    reason,
  ]
    .filter(Boolean)
    .join(", ");
}
