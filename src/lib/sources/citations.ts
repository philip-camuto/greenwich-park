// =========================================================================
// PHASE 3 STUB — FOIA parking-citation data
// =========================================================================
//
// Status: blocked on FOIA response from Greenwich Parking Services.
// Owner: Philip (FOIA correspondence is out of scope for this codebase).
//
// What the data is:
//   Parking citations issued on or near Greenwich Avenue. Public record once
//   FOIA'd. Each row is a single ticket; expected columns based on common
//   municipal datasets: issued_at, block (e.g. "200 Greenwich Ave"),
//   violation_type (overtime meter, no parking, expired plate, etc),
//   officer_id (sometimes redacted), plate (anonymized).
//
// Why it's signal:
//   Citations are issued where meters are full and overstayed. The
//   density of citations per block per 15-min bucket is a defensible proxy
//   for "this block is at capacity right now." Citations under-count by
//   roughly the rate at which officers actually patrol — but that bias is
//   stable hour-of-week, so it cancels out in a heuristic and gets baked
//   into a Phase 2 trained model.
//
// Where it plugs in:
//   - new column on `observations`: `citation_density_last_15min` (real)
//   - new modifier in heuristic: citationModifier(density) → +0..+10
//   - eventually: ground-truth label for "was this prior right?" by
//     comparing predicted demand against block-level citation density.
//
// Implementation outline (when FOIA returns):
//   1. Bulk-import the CSV into a `citations_raw` table.
//   2. Build a materialized view `citation_density_15min` keyed by
//      (block, fifteenMinBucket).
//   3. Replace the empty array below with a query that returns rows for
//      the current 15-min window.
//
// Do NOT implement until the FOIA returns and the dataset is in hand.
// Adding stub behavior risks shipping a feature that pretends to know
// something it doesn't.
// =========================================================================

export type CitationRecord = {
  citationId: string;
  issuedAt: string; // ISO 8601
  block: string; // e.g. "200 Greenwich Ave"
  violationType: string;
  officerId: string | null;
};

export type CitationDensity = {
  windowStart: string; // ISO 8601
  windowMinutes: number;
  byBlock: Record<string, number>;
  totalCount: number;
};

/**
 * Returns citations issued in the last `withinMinutes`. Phase 3 implementation
 * queries the `citations_raw` table. Phase 1 returns an empty array so callers
 * can safely depend on the shape today.
 */
export async function fetchRecentCitations(
  _withinMinutes = 60,
): Promise<CitationRecord[]> {
  return [];
}

/**
 * Aggregated citation count per block in the current 15-min window. This is
 * the shape the heuristic / Phase 2 model would actually consume; raw rows
 * are only useful for offline training.
 */
export async function fetchCitationDensity(
  _windowStart: Date = new Date(),
  _windowMinutes = 15,
): Promise<CitationDensity | null> {
  return null;
}
