import { describe, expect, it } from "vitest";
import {
  FIELD_RATING_OPTIONS,
  categoryForScore,
  fieldRatingLabel,
  scoreForFieldRating,
} from "./field-calibration";

describe("field calibration scale", () => {
  it("maps concrete field ratings to demand scores", () => {
    expect(FIELD_RATING_OPTIONS.map((x) => x.score)).toEqual([10, 25, 40, 60, 78, 92]);
    expect(scoreForFieldRating(0)).toBe(10);
    expect(scoreForFieldRating(5)).toBe(92);
    expect(scoreForFieldRating(6)).toBeNull();
  });

  it("categorizes mapped scores using app thresholds", () => {
    expect(categoryForScore(40)).toBe("green");
    expect(categoryForScore(60)).toBe("yellow");
    expect(categoryForScore(92)).toBe("red");
  });

  it("returns readable labels", () => {
    expect(fieldRatingLabel(3)).toBe("Annoying");
    expect(fieldRatingLabel(99)).toBe("Unknown");
  });
});
