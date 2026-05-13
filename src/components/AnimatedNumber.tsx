"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
};

// Tween between integer values with requestAnimationFrame. Only re-runs when
// `value` actually changes — equal-value re-renders are no-ops.
export function AnimatedNumber({
  value,
  durationMs = 700,
  className,
  style,
}: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === fromRef.current) return;
    const from = fromRef.current;
    const to = value;
    const start = performance.now();

    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const next = Math.round(from + (to - from) * eased);
      setDisplay(next);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        rafRef.current = null;
      }
    };

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return (
    <span className={className} style={style}>
      {display}
    </span>
  );
}
