// Real-time Metro-North service alerts via the camsys collector that powers
// the public mta.info status widget. JSON, no auth, no key rotation in
// practice (it's served to every visitor on the MTA site).
//
// Why this signal matters separately from the daily ridership feed:
//   ridership tells us "what does the weekly commute pattern look like",
//   alerts tell us "are New Haven Line trains running today, right now".
//   Delays / suspensions push commuters into cars → demand on the Ave goes
//   UP. Yesterday's ridership total can't see that.
//
// Greenwich sits on the New Haven Line. Route IDs in this feed:
//   MNR_3  = New Haven (main)            ← THE signal for Greenwich
//   MNR_4  = New Haven (branch group, color shared with NH)
//   MNR_5  = Danbury  (branch off NH)
//   MNR_6  = Waterbury (branch off NH)
// Other MNR_* lines (Harlem, Hudson, Pascack, Wassaic) don't serve Greenwich.

const ENDPOINT =
  "https://collector-otp-prod.camsys-apps.com/realtime/serviceStatus";
// Public client key embedded in the mta.info status page; not a secret.
const API_KEY = "qeqy84JE7hUKfaI0Lxm6Ts8viFRGo3X19v";
const REVALIDATE_SECONDS = 300; // 5 min; alerts change on the minute scale

// Route IDs we care about for Greenwich Ave.
const NEW_HAVEN_FAMILY = new Set(["MNR_3", "MNR_4", "MNR_5", "MNR_6"]);

// Ordered from "least bad" to "worst". A line's status is the worst-active
// summary across alerts touching it.
export type NewHavenLineStatus =
  | "normal"
  | "planned-work"
  | "minor-delays"
  | "major-delays"
  | "suspended"
  | "unknown";

const STATUS_RANK: Record<NewHavenLineStatus, number> = {
  unknown: -1,
  normal: 0,
  "planned-work": 1,
  "minor-delays": 2,
  "major-delays": 3,
  suspended: 4,
};

export type MetroNorthAlerts = {
  newHavenLineStatus: NewHavenLineStatus;
  activeAlertCount: number; // alerts touching any NH-family route
  ok: boolean;
  fetchedAt: string;
};

type RouteDetail = {
  agency?: string;
  routeId?: string;
  inService?: boolean;
  statusDetails?: StatusDetail[];
};

type StatusDetail = {
  statusSummary?: string;
  statusDescription?: string;
  startDate?: string;
  endDate?: string | null;
};

type Payload = {
  lastUpdated?: string;
  routeDetails?: RouteDetail[];
};

export function classifyStatusSummary(summary: string): NewHavenLineStatus {
  // MTA's `statusSummary` values are short labels like "Some Delays",
  // "Suspended", "Planned - Substitute Buses", "Station Notice", etc.
  // We map them into a small ordinal so the modifier can stay simple.
  const s = summary.trim().toLowerCase();
  if (s.includes("suspend")) return "suspended";
  if (s.includes("severe") || s.includes("major")) return "major-delays";
  if (s.includes("delay")) {
    // "Some Delays" / "Delays" → minor; "Severe Delays" caught above.
    return "minor-delays";
  }
  if (s.startsWith("planned")) return "planned-work";
  // "Station Notice", "Special Schedule", "Boarding Change", etc. are
  // informational and don't push riders into cars. Treat as normal.
  return "normal";
}

function activeNow(s: StatusDetail, nowMs: number): boolean {
  if (s.startDate) {
    const start = Date.parse(s.startDate);
    if (Number.isFinite(start) && start > nowMs) return false;
  }
  if (s.endDate) {
    const end = Date.parse(s.endDate);
    if (Number.isFinite(end) && end < nowMs) return false;
  }
  return true;
}

export function summarizeForNewHaven(
  payload: Payload,
  now: Date = new Date(),
): MetroNorthAlerts {
  const fetchedAt = new Date().toISOString();
  const routes = payload.routeDetails ?? [];
  const nhRoutes = routes.filter(
    (r) => r.agency === "MNR" && r.routeId && NEW_HAVEN_FAMILY.has(r.routeId),
  );
  if (nhRoutes.length === 0) {
    return {
      newHavenLineStatus: "unknown",
      activeAlertCount: 0,
      ok: false,
      fetchedAt,
    };
  }

  const nowMs = now.getTime();
  let worst: NewHavenLineStatus = "normal";
  let activeAlertCount = 0;

  for (const r of nhRoutes) {
    if (r.inService === false) {
      // The line itself is out of service in the feed — treat as suspended.
      worst = "suspended";
    }
    for (const s of r.statusDetails ?? []) {
      if (!activeNow(s, nowMs)) continue;
      if (!s.statusSummary) continue;
      activeAlertCount += 1;
      const mapped = classifyStatusSummary(s.statusSummary);
      if (STATUS_RANK[mapped] > STATUS_RANK[worst]) worst = mapped;
    }
  }

  return {
    newHavenLineStatus: worst,
    activeAlertCount,
    ok: true,
    fetchedAt,
  };
}

export async function fetchMetroNorthAlerts(): Promise<MetroNorthAlerts> {
  try {
    const url = `${ENDPOINT}?apikey=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return empty();
    const payload = (await res.json()) as Payload;
    return summarizeForNewHaven(payload);
  } catch {
    return empty();
  }
}

function empty(): MetroNorthAlerts {
  return {
    newHavenLineStatus: "unknown",
    activeAlertCount: 0,
    ok: false,
    fetchedAt: new Date().toISOString(),
  };
}
