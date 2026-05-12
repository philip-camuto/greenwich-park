import type { DemandScore, ModelInput } from "./types";

// Phase 1 heuristic model. Replaced by trained model in Phase 2.
// Inputs combine baseline-by-hour-and-dow with weather, traffic, and event modifiers.
export function computeDemand(_input: ModelInput): DemandScore {
  // TODO Step 4: implement per PRD formula.
  return { score: 0, category: "green", confidence: "low" };
}
