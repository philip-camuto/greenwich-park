import {
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const observations = pgTable("observations", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  weatherTemp: real("weather_temp"),
  weatherCondition: text("weather_condition"),
  weatherPrecipitation: real("weather_precipitation"),
  i95SpeedNb: real("i95_speed_nb"),
  i95SpeedSb: real("i95_speed_sb"),
  hour: integer("hour").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  isWeekend: boolean("is_weekend").notNull(),
  isHoliday: boolean("is_holiday").notNull(),
  computedDemand: integer("computed_demand").notNull(),
});

export type Observation = typeof observations.$inferSelect;
export type NewObservation = typeof observations.$inferInsert;
