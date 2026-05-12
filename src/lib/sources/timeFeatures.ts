import type { TimeFeatures } from "@/lib/model/types";

export function computeTimeFeatures(_at: Date = new Date()): TimeFeatures {
  // TODO Step 3: hour, dayOfWeek, isWeekend, isHoliday, isSchoolInSession.
  return { hour: 0, dayOfWeek: 0, isWeekend: false, isHoliday: false };
}
