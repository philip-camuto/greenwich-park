// =========================================================================
// PHASE 3 STUB — ParkMobile partnership data
// =========================================================================
//
// Status: blocked on partnership conversation with ParkMobile / Greenwich
// Parking Services. Owner: Philip (relationship + legal review).
//
// What the data is:
//   Live meter transactions for ParkMobile-enabled zones on and around
//   Greenwich Ave. Per session: zone_id, started_at, duration_minutes,
//   rate_paid. Aggregated to "active sessions per zone right now," this is
//   close to a direct occupancy measurement for the metered curb.
//
// Why it's the strongest non-camera signal:
//   - ~50%+ of Greenwich Ave meter payments go through ParkMobile (number
//     to verify with partner). Even partial coverage approximates the
//     full-curb pattern because non-app payers tend to follow the same
//     time-of-week rhythm.
//   - Direct: more sessions = more cars at meters = less availability.
//   - Avoids the citation-feed's "patrol bias" entirely.
//
// Where it plugs in:
//   - new columns on `observations`: `pm_active_sessions`, `pm_avg_minutes_left`
//   - new modifier in heuristic OR direct replacement of priors during
//     hours when meters are enforced (priors keep handling Sunday/free hours)
//   - direct occupancy estimate for the curbside lots:
//        availability = capacity - active_sessions
//
// Implementation outline (post-partnership):
//   1. Identify ParkMobile zone IDs covering Greenwich Ave + side streets.
//   2. Implement webhook or polling pull (depends on partner's API model).
//   3. Persist to `parkmobile_sessions` table.
//   4. Aggregate per-zone session count into the inputs to the model.
//
// Do NOT implement until the partnership exists and the zone IDs are known.
// =========================================================================

export type ParkMobileZoneSnapshot = {
  zoneId: string;
  zoneLabel: string;
  capacity: number | null;
  activeSessions: number;
  avgMinutesRemaining: number | null;
};

export type ParkMobileSession = {
  sessionId: string;
  zoneId: string;
  startedAt: string; // ISO 8601
  endsAt: string | null;
  durationMinutes: number;
};

/**
 * Returns active ParkMobile sessions across the Greenwich Ave zones.
 * Phase 1 returns []; Phase 3 implementation reads from the
 * `parkmobile_sessions` table (or directly from the partner API).
 */
export async function fetchActiveParkMobileSessions(): Promise<ParkMobileSession[]> {
  return [];
}

/**
 * Aggregated zone-level snapshot: capacity, active session count, avg
 * minutes-remaining. This is the shape callers (heuristic / Phase 2 model)
 * should depend on — easier to migrate when the partner API changes.
 */
export async function fetchGreenwichZoneSnapshots(): Promise<ParkMobileZoneSnapshot[]> {
  return [];
}
