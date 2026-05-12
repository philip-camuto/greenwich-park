// Phase 3 stub. ParkMobile partnership data (if approved). Real meter
// transactions correlate tightly with on-street occupancy.

export type ParkMobileSession = {
  zoneId: string;
  startedAt: number;
  durationMinutes: number;
};

export async function fetchActiveParkMobileSessions(): Promise<ParkMobileSession[]> {
  // TODO Phase 3: partnership API.
  return [];
}
