import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { perBlockScores } from "@/lib/per-block";
import { AvenueMap } from "./AvenueMap";
import { BLOCKS } from "./avenue-map-data";

const perBlock = perBlockScores(60, { hour: 19, dayOfWeek: 5 });

describe("AvenueMap", () => {
  it("renders all 6 blocks", () => {
    render(<AvenueMap category="yellow" score={60} verdict="Moderately busy" />);
    const blocks = screen.getAllByRole("button");
    expect(blocks).toHaveLength(BLOCKS.length);
    expect(BLOCKS).toHaveLength(6);
  });

  it("labels each block with its aria-label", () => {
    render(
      <AvenueMap
        category="yellow"
        perBlock={perBlock}
        score={60}
        verdict="Moderately busy"
      />,
    );
    for (const b of BLOCKS) {
      expect(
        screen.getByRole("button", {
          name: `${b.label}, demand ${perBlock[b.id].score} of 100`,
        }),
      ).toBeTruthy();
    }
  });

  it("renders the block model caption", () => {
    render(<AvenueMap category="green" score={20} verdict="Plenty of spots" />);
    expect(
      screen.getByText(/trained demand surface scored block by block/),
    ).toBeTruthy();
  });

  it("shows the active-block readout when a block is clicked", async () => {
    const user = userEvent.setup();
    render(
      <AvenueMap
        category="yellow"
        perBlock={perBlock}
        score={60}
        verdict="Moderately busy"
      />,
    );
    await user.click(screen.getAllByRole("button")[0]);
    expect(
      screen.getByText(/GINGER MAN.*ANCHOR DEMAND/i),
    ).toBeInTheDocument();
  });

  it("activates a block when Enter is pressed on a focused block", async () => {
    const user = userEvent.setup();
    render(<AvenueMap category="yellow" score={60} verdict="Moderately busy" />);
    const firstBlock = screen.getAllByRole("button")[0];
    firstBlock.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText(/BETWEEN/i)).toBeInTheDocument();
  });
});
