import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForecastChart } from "./ForecastChart";

// 25 points spanning 12 hours in 30-min steps, matching production sizing.
// Categories are interleaved enough that "Best" pill + callout assertions
// have real signal to test against.
const points = Array.from({ length: 25 }, (_, i) => {
  const startMs = new Date("2026-05-13T00:00:00.000Z").getTime();
  const t = new Date(startMs + i * 30 * 60_000);
  const isRed = i < 8;
  const isYellow = i >= 8 && i < 16;
  const score = isRed ? 75 : isYellow ? 60 : 30;
  return {
    timestamp: t.toISOString(),
    localHour: t.getUTCHours(),
    score,
    category: (isRed ? "red" : isYellow ? "yellow" : "green") as
      | "red"
      | "yellow"
      | "green",
  };
});

// Best slot lands at index 18 (T+9h = 09:00 UTC = "5:00 AM" Greenwich).
const bestTime = {
  timestamp: points[18].timestamp,
  localHour: points[18].localHour,
  score: points[18].score,
};

describe("ForecastChart", () => {
  it("renders the intensity-bar SVG with an accessible label", () => {
    render(<ForecastChart points={points} bestTime={bestTime} />);
    expect(
      screen.getByRole("slider", { name: /demand forecast for the next 12 hours/i }),
    ).toBeInTheDocument();
  });

  it("shows a 'Best' pill when the best slot is not the current one", () => {
    render(<ForecastChart points={points} bestTime={bestTime} />);
    expect(screen.getByText(/^best$/i)).toBeInTheDocument();
    // Best slot is i=18 → 09:00 UTC → "5:00 AM" Greenwich. The pill renders it.
    expect(screen.getAllByText(/5:00 AM/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders 5 relative-time ticks reflecting the actual window", () => {
    render(<ForecastChart points={points} bestTime={bestTime} />);
    // 25 points / 30-min steps → tick fractions land at indices
    // 0, 6, 12, 18, 24 → +0h, +3h, +6h, +9h, +12h.
    for (const label of ["NOW", "+3H", "+6H", "+9H", "+12H"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders a plain-English callout", () => {
    render(<ForecastChart points={points} bestTime={bestTime} />);
    // current is red, gap is 45 → "Tight now. Much easier by 5:00 AM."
    expect(
      screen.getByText(/tight now\.?\s*much easier by 5:00 AM\./i),
    ).toBeInTheDocument();
  });

  it("hides the Best pill when current is already the best slot", () => {
    const sameBest = { timestamp: points[0].timestamp, localHour: 20, score: 75 };
    render(<ForecastChart points={points} bestTime={sameBest} />);
    expect(screen.queryByText(/^best$/i)).not.toBeInTheDocument();
  });

  it("returns null on empty points", () => {
    const { container } = render(<ForecastChart points={[]} bestTime={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("removes the best marker from the track once a time is selected", () => {
    const { container } = render(<ForecastChart points={points} bestTime={bestTime} />);
    expect(container.querySelector(".forecast-best-ring")).toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByRole("slider", { name: /demand forecast/i }),
      { key: "ArrowRight" },
    );

    expect(container.querySelector(".forecast-best-ring")).not.toBeInTheDocument();
  });
});
