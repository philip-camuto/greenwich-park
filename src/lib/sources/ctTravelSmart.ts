import type { TrafficSnapshot } from "@/lib/model/types";

// CT Travel Smart REST API. I-95 cameras and speed sensors near Exits 3-4.
// Rate limit 10/60s. Cache 5min minimum.
export async function fetchGreenwichTraffic(): Promise<TrafficSnapshot> {
  // TODO Step 2: real implementation with caching + graceful degradation.
  return { i95SpeedNb: null, i95SpeedSb: null };
}
