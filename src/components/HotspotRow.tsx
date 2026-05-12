import Link from "next/link";
import type { DemandCategory } from "@/lib/model/types";

type Props = {
  id: string;
  name: string;
  score: number;
  category: DemandCategory;
};

const ACCENT: Record<DemandCategory, string> = {
  green: "var(--state-quiet)",
  yellow: "var(--state-busy)",
  red: "var(--state-tough)",
};

export function HotspotRow({ id, name, score, category }: Props) {
  return (
    <Link
      href={`/hotspot/${id}`}
      className="flex items-center justify-between min-h-[44px] py-2"
      aria-label={`${name}, demand ${score} of 100, view forecast`}
    >
      <span className="text-[17px] text-[var(--label-primary)]">{name}</span>
      <span className="flex items-center gap-2">
        <span
          className="mono text-[17px] font-medium tabular-nums"
          style={{ color: ACCENT[category] }}
        >
          {score}
        </span>
        <span
          aria-hidden
          className="text-[var(--label-tertiary)] text-[14px]"
        >
          ›
        </span>
      </span>
    </Link>
  );
}
