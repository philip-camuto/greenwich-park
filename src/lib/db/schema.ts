import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// One row per ingest. Phase 2 model training reads from this table.
// Schema fields mirror what the heuristic actually consumes today; if Phase 2
// wants more raw signal (raw WMO code, raw event list), add columns and
// backfill — don't remove the existing columns.
export const observations = pgTable("observations", {
  id: serial("id").primaryKey(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),

  // Weather (Open-Meteo).
  weatherTempF: real("weather_temp_f"),
  weatherCondition: text("weather_condition"), // clear|cloudy|rain|snow|fog|thunderstorm|unknown
  weatherPrecipitationIn: real("weather_precipitation_in"),
  weatherWindMph: real("weather_wind_mph"),
  weatherIsDay: boolean("weather_is_day"),
  weatherOk: boolean("weather_ok").notNull().default(false),

  // Traffic (CT 511 event feed).
  trafficSeverity: text("traffic_severity"), // none|light|moderate|heavy
  trafficEventsRelevant: integer("traffic_events_relevant"),
  trafficEventsTotal: integer("traffic_events_total"),
  trafficNorthboundAffected: boolean("traffic_northbound_affected"),
  trafficSouthboundAffected: boolean("traffic_southbound_affected"),
  trafficClosureNearby: boolean("traffic_closure_nearby"),
  trafficOk: boolean("traffic_ok").notNull().default(false),

  // Time features (Greenwich local).
  localDate: text("local_date").notNull(), // YYYY-MM-DD
  hour: integer("hour").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  isWeekend: boolean("is_weekend").notNull(),
  isHoliday: boolean("is_holiday").notNull(),
  holidayKind: text("holiday_kind"), // closure|retail-spike|observed|none
  holidayName: text("holiday_name"),
  publicInSession: boolean("public_in_session").notNull(),
  privateInSession: boolean("private_in_session").notNull(),

  // Heuristic output + breakdown.
  computedScore: integer("computed_score").notNull(),
  computedCategory: text("computed_category").notNull(),
  computedConfidence: text("computed_confidence").notNull(),
  basePrior: integer("base_prior").notNull(),
  weatherMod: integer("weather_mod").notNull(),
  trafficMod: integer("traffic_mod").notNull(),
  holidayMod: integer("holiday_mod").notNull(),
  schoolMod: integer("school_mod").notNull(),
  eventMod: integer("event_mod").notNull(),
  rawSum: integer("raw_sum").notNull(),
  closureCapped: boolean("closure_capped").notNull(),
});

export type Observation = typeof observations.$inferSelect;
export type NewObservation = typeof observations.$inferInsert;

// Phase 3 prep. Zone-level occupancy ingested from FOIA citations and/or
// camera readings. Empty in Phase 1; populated when ground-truth data lands.
export const observationsByZone = pgTable("observations_by_zone", {
  id: serial("id").primaryKey(),
  zoneId: text("zone_id").notNull(), // references PARKING_ZONES[].id (no FK constraint — inventory lives in code)
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  occupiedCount: integer("occupied_count"), // null until Phase 3
  occupancyRate: real("occupancy_rate"), // 0..1, null until Phase 3
});

export type ObservationByZone = typeof observationsByZone.$inferSelect;
export type NewObservationByZone = typeof observationsByZone.$inferInsert;
