import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForecastChart } from "./ForecastChart";

const points = [
  {
    timestamp: "2026-05-13T00:00:00.000Z",
    localHour: 20,
    score: 75,
    category: "red" as const,
  },
  {
    timestamp: "2026-05-13T00:15:00.000Z",
    localHour: 20,
    score: 60,
    category: "yellow" as const,
  },
  {
    timestamp: "2026-05-13T01:00:00.000Z",
    localHour: 21,
    score: 30,
    category: "green" as const,
  },
];

const bestTime = { timestamp: points[2].timestamp, localHour: 21, score: 30 };

describe("ForecastChart", () => {
  it("renders the intensity-bar SVG with an accessible label", () => {
    render(<ForecastChart points={points} bestTime={bestTime} />);
    expect(
      screen.getByRole("img", { name: /demand for the next 4 hours/i }),
    ).toBeInTheDocument();
  });

  it("shows a 'Best' pill when the best slot is not the current one", () => {
    render(<ForecastChart points={points} bestTime={bestTime} />);
    expect(screen.getByText(/^best$/i)).toBeInTheDocument();
    // Both the pill and the callout mention 9:00 PM.
    expect(screen.getAllByText(/9:00 PM/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders 5 relative-time ticks", () => {
    render(<ForecastChart points={points} bestTime={bestTime} />);
    for (const label of ["NOW", "+1H", "+2H", "+3H", "+4H"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders a plain-English callout", () => {
    render(<ForecastChart points={points} bestTime={bestTime} />);
    // current is red, gap is 45 → "Tight now. Much easier by 9:00 PM."
    expect(
      screen.getByText(/tight now\.?\s*much easier by 9:00 PM\./i),
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
});
