import Link from "next/link";
import type { DemandCategory } from "@/lib/model/types";

type Props = {
  id: string;
  name: string;
  subLabel: string;
  score: number;
  category: DemandCategory;
  reasons?: string[];
};

const ACCENT: Record<DemandCategory, string> = {
  green: "var(--state-quiet)",
  yellow: "var(--state-busy)",
  red: "var(--state-tough)",
};

export function HotspotRow({ id, name, subLabel, score, category, reasons }: Props) {
  const reason = reasons?.[0] ?? "block demand model";
  return (
    <Link
      href={`/hotspot/${id}`}
      aria-label={`${name}, demand ${score} of 100`}
      className="flex min-h-[56px] items-center justify-between gap-4 py-3 lg:min-h-[64px]"
    >
      <span className="min-w-0">
        <span className="block truncate text-[17px] text-[var(--label-primary)] lg:text-[18px]">
          {name}
        </span>
        <span className="mt-0.5 block truncate text-[12px] font-medium text-[var(--label-secondary)]">
          {subLabel} · {reason}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span
          className="text-[18px] font-semibold tabular-nums tracking-normal lg:text-[20px]"
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
