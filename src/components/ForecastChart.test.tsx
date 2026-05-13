import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ForecastChart } from "./ForecastChart";

const points = [
  {
    timestamp: "2026-05-13T00:00:00.000Z",
    localHour: 20,
    score: 57,
    category: "yellow" as const,
  },
  {
    timestamp: "2026-05-13T00:15:00.000Z",
    localHour: 20,
    score: 54,
    category: "yellow" as const,
  },
  {
    timestamp: "2026-05-13T01:00:00.000Z",
    localHour: 21,
    score: 42,
    category: "yellow" as const,
  },
];

describe("ForecastChart", () => {
  it("shows forecast times and updates the selected point when clicked", async () => {
    const user = userEvent.setup();
    render(<ForecastChart points={points} bestTime={points[2]} />);

    expect(screen.getByRole("button", { name: /8:00 PM/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /9:00 PM/i })).toBeInTheDocument();
    expect(screen.getByText(/8:00 PM/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /9:00 PM/i }));

    expect(
      screen.getByRole("status", { name: /selected forecast 9:00 PM, 42 of 100/i }),
    ).toBeInTheDocument();
  });
});
