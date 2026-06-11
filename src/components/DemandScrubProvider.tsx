"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

// Shared scrub state for the home page. Only the *pinned* index is shared —
// hover previews stay local to the ForecastChart so the big score, modeled
// time, and breakdown card don't twitch on every cursor move. The chart
// writes via setPinnedIdx; the ScoreCard / BreakdownCard read via
// useScrubState() and re-render only when the user actually taps, drags,
// or arrow-keys to a new slot.

type ScrubState = {
  pinnedIdx: number | null;
  setPinnedIdx: (idx: number | null) => void;
};

const ScrubContext = createContext<ScrubState | null>(null);

export function DemandScrubProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [pinnedIdx, setPinnedIdxState] = useState<number | null>(null);
  const setPinnedIdx = useCallback((idx: number | null) => {
    setPinnedIdxState(idx);
  }, []);
  return (
    <ScrubContext.Provider value={{ pinnedIdx, setPinnedIdx }}>
      {children}
    </ScrubContext.Provider>
  );
}

export function useScrubState(): ScrubState {
  const ctx = useContext(ScrubContext);
  if (!ctx) {
    throw new Error("useScrubState must be used inside DemandScrubProvider");
  }
  return ctx;
}
