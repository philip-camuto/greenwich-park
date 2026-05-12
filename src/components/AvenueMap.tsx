"use client";

import { useState } from "react";
import type { DemandCategory } from "@/lib/model/types";
import { BLOCKS, NODES } from "./avenue-map-data";

type Props = {
  category: DemandCategory;
  score: number;
  verdict: string;
};

const FILL: Record<DemandCategory, string> = {
  green: "var(--map-fill-quiet)",
  yellow: "var(--map-fill-busy)",
  red: "var(--map-fill-tough)",
};

// SVG geometry. The Ave is a vertical spine; stubs branch east/west.
const W = 280;
const H = 480;
const PAD = { t: 16, r: 80, b: 16, l: 80 };
const innerH = H - PAD.t - PAD.b;
const spineX = W / 2;
const stubLen = 56;

function yAt(yNorm: number): number {
  return PAD.t + yNorm * innerH;
}

export function AvenueMap({ category, score, verdict }: Props) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[320px] h-auto block mx-auto"
        role="group"
        aria-label="Greenwich Avenue block diagram"
      >
        {/* block fills (drawn behind the spine) */}
        {BLOCKS.map((b) => {
          const yN = yAt(NODES.find((n) => n.id === b.northNodeId)!.y);
          const yS = yAt(NODES.find((n) => n.id === b.southNodeId)!.y);
          const isActive = activeBlockId === b.id;
          return (
            <g key={b.id}>
              <rect
                x={spineX - 8}
                y={yN}
                width={16}
                height={yS - yN}
                fill={FILL[category]}
              />
              {/* hit + focus target */}
              <rect
                x={spineX - 20}
                y={yN}
                width={40}
                height={yS - yN}
                fill="transparent"
                stroke={isActive ? "var(--fg)" : "transparent"}
                strokeWidth={2}
                role="button"
                tabIndex={0}
                aria-label={b.label}
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
                style={{ cursor: "pointer", outline: "none" }}
              />
            </g>
          );
        })}

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
                fill="var(--muted)"
                fontSize={9}
                fontFamily="var(--font-mono), monospace"
                letterSpacing="0.1em"
                textAnchor={showEast || isTerm ? "start" : "end"}
              >
                {n.label.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* tooltip / readout */}
      <div
        aria-live="polite"
        className="mono text-[11px] tracking-[0.15em] uppercase text-[var(--muted)] text-center min-h-[1.2em]"
      >
        {activeBlockId
          ? readoutFor(activeBlockId, verdict, score)
          : "Hover or tap a block"}
      </div>

      <p className="mono text-[10px] tracking-[0.18em] uppercase text-[var(--muted)] text-center leading-relaxed">
        Block-level demand in Phase 3 (FOIA). Today, all blocks share the global score.
      </p>
    </div>
  );
}

function readoutFor(blockId: string, verdict: string, score: number): string {
  const b = BLOCKS.find((x) => x.id === blockId);
  if (!b) return "";
  return `${b.label.toUpperCase()} · ${verdict.toUpperCase()} · ${score}/100`;
}
