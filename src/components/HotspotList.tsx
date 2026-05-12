import { Card } from "./Card";
import { HotspotRow } from "./HotspotRow";
import { HOTSPOTS } from "@/lib/hotspots";
import type { PerBlockScore } from "@/lib/per-block";

type Props = {
  perBlock: Record<string, PerBlockScore>;
};

export function HotspotList({ perBlock }: Props) {
  return (
    <Card>
      <ul className="flex flex-col">
        {HOTSPOTS.map((h, i) => {
          const block = perBlock[h.blockId];
          return (
            <li
              key={h.id}
              className={
                i === 0
                  ? ""
                  : "border-t border-[var(--separator-inset)] ml-0"
              }
            >
              <HotspotRow
                id={h.id}
                name={h.name}
                score={block?.score ?? 0}
                category={block?.category ?? "green"}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
