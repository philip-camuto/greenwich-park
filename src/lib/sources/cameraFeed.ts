// Phase 4 stub. Live occupancy counts from a Raspberry Pi YOLO detector
// running in a downtown parking lot, pending Greenwich Parking Services
// approval. This becomes ground truth and replaces heuristic priors.

export type CameraOccupancyReading = {
  lotId: string;
  observedAt: number;
  vehiclesCount: number;
  capacity: number;
};

export async function fetchLatestCameraReadings(): Promise<CameraOccupancyReading[]> {
  // TODO Phase 4: POST endpoint receives Pi telemetry; this reads latest per lot.
  return [];
}
