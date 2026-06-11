// =========================================================================
// FOIA parking-citation data — RECEIVED 2026-06-11 (historical only)
// =========================================================================
//
// Status: Greenwich Parking Services answered the FOIA with a one-time
// historical export: 21,892 citations on Lower/Upper Greenwich Ave,
// Jan 2022 - Dec 2024, stored in `citations_raw` (see db/schema.ts and
// analysis/import_citations.ts).
//
// What changed vs. the original plan: there is NO live citation feed and
// none is coming — the town exports on request, ending Dec 2024. So the
// live-density ideas this file originally sketched (15-min density column
// on `observations`, a real-time citationModifier) are dead. The functions
// below stay empty on purpose; wiring 2024 tickets into a "right now"
// signal would pretend to know something we don't.
//
// What the data IS used for (offline):
//   - Recalibrating HOUR_DOW_PRIORS: analysis/recalibrate_priors.py
//     (patrol-adjusted, year-normalized hour-of-week intensity, blended
//     60/40 with the hand priors inside the 9am-4pm Mon-Sat enforcement
//     window). Applied 2026-06-11; see docs/citations-recalibration.md.
//   - Validating the weather modifiers via Poisson GLM against 3 years of
//     hourly Open-Meteo history (rain -20 confirmed once patrol staffing
//     is controlled for; snow -40 consistent).
//   - Phase 2 training features / Phase 3 per-block offsets, when those land.
//
// Known limits of the signal: enforcement runs ~9am-4pm Mon-Sat only
// (Sundays are free parking — 26 tickets in 3 years), 2023 volume is ~55%
// of 2022/2024 (staffing, not demand), and officer "999" is a shared
// device ID so per-officer patrol estimates undercount.
//
// If a recurring export gets negotiated (quarterly FOIA refresh), revisit:
//   1. Re-run analysis/import_citations.ts on the new file (idempotent,
//      upserts on citation_number).
//   2. Re-run the recalibration and bump the date in priors.ts.
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
