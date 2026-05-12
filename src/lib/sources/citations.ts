// Phase 3 stub. FOIA parking-citation data (date, time, block, violation).
// Used as a proxy for high-demand blocks/times once the FOIA returns.

export type CitationRecord = {
  timestamp: number;
  block: string;
  violationType: string;
};

export async function fetchRecentCitations(): Promise<CitationRecord[]> {
  // TODO Phase 3: ingest FOIA dataset and expose query helpers.
  return [];
}
