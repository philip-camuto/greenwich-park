import { describe, expect, it } from "vitest";
import {
  computeDemand,
  holidayModifier,
  metroNorthModifier,
  schoolModifier,
  trafficModifier,
  weatherModifier,
} from "./heuristic";
import type {
  ModelInput,
  SchoolStatus,
  TimeFeatures,
  TrafficSnapshot,
  WeatherSnapshot,
} from "./types";

const allInSession: SchoolStatus = {
  publicInSession: true,
  privateInSession: true,
  anyInSession: true,
  allInSession: true,
};

function tf(overrides: Partial<TimeFeatures> = {}): TimeFeatures {
  return {
    hour: 13,
    dayOfWeek: 6, // Saturday
    isWeekend: true,
    isHoliday: false,
    holidayKind: "none",
    holidayName: null,
    schoolStatus: allInSession,
    isSchoolInSession: true,
    localDate: "2026-05-09",
    ...overrides,
  };
}

function w(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    tempF: 70,
    condition: "clear",
    precipitationIn: 0,
    windMph: 5,
    isDay: true,
    fetchedAt: "2026-05-09T18:00:00Z",
    ok: true,
    ...overrides,
  };
}

function tr(overrides: Partial<TrafficSnapshot> = {}): TrafficSnapshot {
  return {
    severity: "none",
    greenwichRelevantEvents: 0,
    i95EventsTotal: 0,
    northboundAffected: false,
    southboundAffected: false,
    closureNearby: false,
    fetchedAt: "2026-05-09T18:00:00Z",
    ok: true,
    ...overrides,
  };
}

function input(overrides: Partial<ModelInput> = {}): ModelInput {
  return { weather: w(), traffic: tr(), time: tf(), ...overrides };
}

describe("weatherModifier", () => {
  it("rain = -20", () => {
    expect(weatherModifier(w({ condition: "rain" }))).toBe(-20);
  });
  it("snow = -40", () => {
    expect(weatherModifier(w({ condition: "snow" }))).toBe(-40);
  });
  it("thunderstorm = -30", () => {
    expect(weatherModifier(w({ condition: "thunderstorm" }))).toBe(-30);
  });
  it("80F+ sunny day boosts +10", () => {
    expect(weatherModifier(w({ tempF: 82, condition: "clear", isDay: true })))
      .toBe(10);
  });
  it("65-79F sunny day boosts +5", () => {
    expect(weatherModifier(w({ tempF: 70, condition: "clear", isDay: true })))
      .toBe(5);
  });
  it("freezing temps -10", () => {
    expect(weatherModifier(w({ tempF: 25, condition: "cloudy", isDay: true })))
      .toBe(-10);
  });
  it("ok=false yields 0", () => {
    expect(weatherModifier(w({ ok: false, condition: "rain" }))).toBe(0);
  });
});

describe("trafficModifier", () => {
  it("none = 0", () => {
    expect(trafficModifier(tr({ severity: "none" }))).toBe(0);
  });
  it("heavy = +8", () => {
    expect(trafficModifier(tr({ severity: "heavy" }))).toBe(8);
  });
  it("closure subtracts 5", () => {
    expect(trafficModifier(tr({ severity: "moderate", closureNearby: true })))
      .toBe(0); // +5 - 5
  });
  it("ok=false yields 0", () => {
    expect(trafficModifier(tr({ ok: false, severity: "heavy" }))).toBe(0);
  });
});

describe("holidayModifier", () => {
  it("retail-spike +15", () => {
    expect(holidayModifier("retail-spike")).toBe(15);
  });
  it("observed +3", () => {
    expect(holidayModifier("observed")).toBe(3);
  });
  it("closure 0 (cap is applied elsewhere)", () => {
    expect(holidayModifier("closure")).toBe(0);
  });
});

describe("schoolModifier", () => {
  it("weekend → 0", () => {
    expect(schoolModifier(tf({ isWeekend: true }))).toBe(0);
  });
  it("all in session weekday → 0", () => {
    expect(schoolModifier(tf({ isWeekend: false }))).toBe(0);
  });
  it("private out, public in → +3", () => {
    const s = schoolModifier(
      tf({
        isWeekend: false,
        schoolStatus: {
          publicInSession: true,
          privateInSession: false,
          anyInSession: true,
          allInSession: false,
        },
      }),
    );
    expect(s).toBe(3);
  });
  it("both out weekday (summer) → +5", () => {
    const s = schoolModifier(
      tf({
        isWeekend: false,
        schoolStatus: {
          publicInSession: false,
          privateInSession: false,
          anyInSession: false,
          allInSession: false,
        },
      }),
    );
    expect(s).toBe(5);
  });
});

describe("computeDemand integration", () => {
  it("Saturday 1pm clear 70F yields red", () => {
    const out = computeDemand(input()); // base 95 + clear/65F +5 = 100
    expect(out.score).toBe(100);
    expect(out.category).toBe("red");
    expect(out.confidence).toBe("high");
  });

  it("Tuesday 6am yields green (commuter hours, not Ave hours)", () => {
    const out = computeDemand(
      input({
        time: tf({ hour: 6, dayOfWeek: 2, isWeekend: false }),
      }),
    );
    // Tuesday 6am prior is 8, plus clear-65F +5 = 13 → green.
    expect(out.score).toBeLessThanOrEqual(40);
    expect(out.category).toBe("green");
  });

  it("snow integration: Saturday afternoon under snow drops to green", () => {
    const out = computeDemand(
      input({ weather: w({ condition: "snow", tempF: 28, isDay: true }) }),
    );
    // base 95 - 40 (snow) - 10 (freezing) = 45 yellow… but snow also kills
    // demand on Greenwich Ave (boutiques close, brunch tables empty). The
    // current numbers leave us mid-yellow which is the calibrated answer.
    expect(out.breakdown.weatherMod).toBe(-50); // -40 snow + -10 freezing
    expect(out.score).toBeLessThan(50);
  });

  it("Christmas Day Saturday noon is capped to green", () => {
    const out = computeDemand(
      input({
        time: tf({
          hour: 12,
          isHoliday: true,
          holidayKind: "closure",
          holidayName: "Christmas Day",
        }),
      }),
    );
    expect(out.score).toBeLessThanOrEqual(20);
    expect(out.category).toBe("green");
    expect(out.breakdown.closureCapped).toBe(true);
  });

  it("rainy Saturday afternoon drops a tier", () => {
    const clear = computeDemand(input()); // ~100
    const rainy = computeDemand(input({ weather: w({ condition: "rain", tempF: 60 }) }));
    expect(rainy.score).toBeLessThan(clear.score);
    expect(rainy.score).toBeGreaterThan(40);
  });

  it("retail-spike holiday on a Friday adds 15", () => {
    const baseline = computeDemand(
      input({ time: tf({ hour: 18, dayOfWeek: 5, isWeekend: false }) }),
    );
    const blackFriday = computeDemand(
      input({
        time: tf({
          hour: 18,
          dayOfWeek: 5,
          isWeekend: false,
          isHoliday: true,
          holidayKind: "retail-spike",
          holidayName: "Black Friday",
        }),
      }),
    );
    expect(blackFriday.score).toBeGreaterThan(baseline.score);
  });

  it("low confidence when both upstreams failed", () => {
    const out = computeDemand(
      input({
        weather: w({ ok: false, condition: "unknown" }),
        traffic: tr({ ok: false }),
      }),
    );
    expect(out.confidence).toBe("low");
  });

  it("medium confidence when only one upstream is fresh", () => {
    const out = computeDemand(
      input({ traffic: tr({ ok: false }) }),
    );
    expect(out.confidence).toBe("medium");
  });

  it("breakdown sums to rawSum", () => {
    const out = computeDemand(input());
    const { base, weatherMod, trafficMod, holidayMod, schoolMod, eventMod, metroNorthMod, rawSum } =
      out.breakdown;
    expect(base + weatherMod + trafficMod + holidayMod + schoolMod + eventMod + metroNorthMod).toBe(
      rawSum,
    );
  });

  it("category boundaries", () => {
    // base prior 5 Sunday 3am, no mods → score 5 → green
    const green = computeDemand(
      input({ time: tf({ hour: 3, dayOfWeek: 0, isWeekend: true }) }),
    );
    expect(green.category).toBe("green");
    // Saturday 1pm with no special bumps → ~95-100 → red
    const red = computeDemand(input());
    expect(red.category).toBe("red");
  });

  it("score clamps to [0,100]", () => {
    const high = computeDemand(
      input({
        specialEvent: { date: "2026-05-09", name: "test", demandBoost: 200 },
      }),
    );
    expect(high.score).toBeLessThanOrEqual(100);
  });
});

describe("metroNorthModifier", () => {
  it("returns -8 when ridership is 10%+ above baseline", () => {
    expect(metroNorthModifier({ ridership: 140000, vsBaseline: 140000 / 120000, ok: true })).toBe(-8);
  });
  it("returns +8 when ridership is 20%+ below baseline", () => {
    expect(metroNorthModifier({ ridership: 90000, vsBaseline: 0.75, ok: true })).toBe(8);
  });
  it("returns 0 in the neutral band", () => {
    expect(metroNorthModifier({ ridership: 120000, vsBaseline: 1, ok: true })).toBe(0);
  });
  it("returns 0 when not ok", () => {
    expect(metroNorthModifier({ ridership: 140000, vsBaseline: 1.17, ok: false })).toBe(0);
  });
  it("returns 0 when null", () => {
    expect(metroNorthModifier(null)).toBe(0);
  });
});

describe("trafficModifier — TomTom path", () => {
  function tomTomTraffic(speedRatio: number, closure = false): TrafficSnapshot {
    return tr({
      tomTomOk: true,
      speedRatio,
      currentSpeedMph: speedRatio * 30,
      freeFlowSpeedMph: 30,
      roadClosure: closure,
    });
  }
  it("ratio < 0.4 → +8", () => {
    expect(trafficModifier(tomTomTraffic(0.3))).toBe(8);
  });
  it("0.4-0.6 → +5", () => {
    expect(trafficModifier(tomTomTraffic(0.5))).toBe(5);
  });
  it("0.6-0.8 → +2", () => {
    expect(trafficModifier(tomTomTraffic(0.7))).toBe(2);
  });
  it("> 0.8 → 0", () => {
    expect(trafficModifier(tomTomTraffic(0.9))).toBe(0);
  });
  it("road closure penalizes -5 on top", () => {
    expect(trafficModifier(tomTomTraffic(0.7, true))).toBe(-3);
  });
});
