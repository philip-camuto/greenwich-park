import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvenueMap } from "./AvenueMap";
import { BLOCKS } from "./avenue-map-data";

describe("AvenueMap", () => {
  it("renders all 6 blocks", () => {
    render(<AvenueMap category="yellow" score={60} verdict="Moderately busy" />);
    const blocks = screen.getAllByRole("button");
    expect(blocks).toHaveLength(BLOCKS.length);
    expect(BLOCKS).toHaveLength(6);
  });

  it("labels each block with its aria-label", () => {
    render(<AvenueMap category="yellow" score={60} verdict="Moderately busy" />);
    for (const b of BLOCKS) {
      expect(
        screen.getByRole("button", { name: new RegExp(b.label) }),
      ).toBeTruthy();
    }
  });

  it("renders the Phase-3 disclaimer", () => {
    render(<AvenueMap category="green" score={20} verdict="Plenty of spots" />);
    expect(
      screen.getByText(/Block-level demand in Phase 3/),
    ).toBeTruthy();
  });
});
