import Link from "next/link";
import { AnimatedNumber } from "./AnimatedNumber";
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

export function HotspotRow({ id, name, subLabel, score, category }: Props) {
  // The anchor reason is intentionally NOT shown here: it starts with the
  // row's own name ("The Ginger Man + upper Ave..."), so on phones it
  // truncated into a stutter. It lives on the detail page instead.
  return (
    <Link
      href={`/hotspot/${id}`}
      aria-label={`${name}, demand ${score} of 100`}
      className="flex min-h-[54px] items-center justify-between gap-4 py-2.5 transition-colors duration-200 hover:bg-[rgba(255,255,255,0.025)] lg:min-h-[58px]"
    >
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium text-[var(--label-primary)] lg:text-[16px]">
          {name}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-[var(--label-tertiary)]">
          {subLabel}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <AnimatedNumber
          value={score}
          className="mono text-[16px] font-semibold tabular-nums tracking-[-0.02em] lg:text-[18px]"
          style={{
            color: ACCENT[category],
            transition: "color 500ms ease-out",
          }}
        />
        <span
          aria-hidden
          className="text-[14px] text-[var(--label-tertiary)]"
        >
          ›
        </span>
      </span>
    </Link>
  );
}
