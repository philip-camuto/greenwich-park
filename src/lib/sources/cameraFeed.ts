// =========================================================================
// PHASE 4 STUB — Raspberry Pi + YOLO live occupancy
// =========================================================================
//
// Status: blocked on (a) Greenwich Parking Services approval to install a
// camera in a downtown lot, (b) Raspberry Pi hardware procurement, and
// (c) outdoor enclosure + power source. Owner: Philip.
//
// What the data is:
//   A Raspberry Pi mounted overlooking one of the downtown lots runs a
//   small YOLO model at ~30s cadence, counting vehicles in frame against
//   a hand-labeled set of parking-space polygons. Each tick posts:
//     { lot_id, observed_at, vehicles_detected, capacity, model_version }
//   to /api/camera/ingest (planned, Phase 4) over HTTPS with a Bearer
//   secret. Server stores it in a `camera_readings` table.
//
// Why it matters:
//   This is GROUND TRUTH. Every other signal in Phases 1-3 is a proxy.
//   Even a single lot's live occupancy is enough to:
//     - validate or refute the heuristic priors for that lot
//     - serve as the training label for the Phase 2 model
//     - power a "this lot has N spots open right now" UI element
//
// Where it plugs in:
//   - new endpoint: POST /api/camera/ingest (Bearer auth via CAMERA_SECRET)
//   - new table: camera_readings
//   - new column on observations OR a join key: live occupancy from the
//     pilot lot at ingest time
//   - new modifier in heuristic (or full prior replacement, depending on
//     how confident the YOLO model is and how well-calibrated the lot is)
//
// Implementation outline (post-approval):
//   1. Pi setup: Pi 5, USB cam, weatherproof housing, PoE or outlet,
//      a tiny systemd unit running the YOLO loop.
//   2. YOLO model: COCO-pretrained YOLOv8n or v11n, with manual
//      space-polygon ROI. Small model so it fits on the Pi.
//   3. /api/camera/ingest validates the secret, parses payload, inserts
//      one row. No retry logic — best-effort telemetry.
//   4. fetchLatestCameraReadings() reads MAX(observed_at) per lot_id.
//   5. Confidence boost in DemandScore: if a camera-monitored lot reports
//      live occupancy, surface it directly ("3 of 24 spots open") and
//      raise overall confidence to "high (live)".
//
// Do NOT implement until the hardware is deployed. The /api/camera/ingest
// endpoint is the only thing that could ship in advance, and even that
// risks creating an empty-table footgun.
// =========================================================================

export type CameraReading = {
  lotId: string;
  observedAt: string; // ISO 8601
  vehiclesDetected: number;
  capacity: number;
  modelVersion: string;
};

export type LotOccupancySnapshot = {
  lotId: string;
  lotLabel: string;
  observedAt: string;
  occupied: number;
  capacity: number;
  occupancyPct: number; // 0..1
  fresh: boolean; // false if reading is older than 5min
};

/**
 * Returns the latest reading per camera-monitored lot. Phase 1 returns [].
 * Phase 4 implementation queries `MAX(observed_at)` per lot_id from the
 * `camera_readings` table.
 */
export async function fetchLatestCameraReadings(): Promise<CameraReading[]> {
  return [];
}

/**
 * Higher-level shape: per-lot occupancy snapshot with a freshness flag.
 * This is what UI components consume; raw readings are only for analytics.
 */
export async function fetchLotOccupancy(): Promise<LotOccupancySnapshot[]> {
  return [];
}
