import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HotspotList } from "./HotspotList";
import { perBlockScores } from "@/lib/per-block";
import { HOTSPOTS } from "@/lib/hotspots";

describe("HotspotList", () => {
  const perBlock = perBlockScores(60);

  it("renders all 4 hotspots as links", () => {
    render(<HotspotList perBlock={perBlock} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
  });

  it("each link goes to /hotspot/<id>", () => {
    render(<HotspotList perBlock={perBlock} />);
    for (const h of HOTSPOTS) {
      const link = screen.getByRole("link", { name: new RegExp(h.name) });
      expect(link.getAttribute("href")).toBe(`/hotspot/${h.id}`);
    }
  });

  it("displays each hotspot's per-block score", () => {
    render(<HotspotList perBlock={perBlock} />);
    for (const h of HOTSPOTS) {
      const score = perBlock[h.blockId].score;
      expect(
        screen.getByRole("link", { name: new RegExp(`${h.name}.*${score}`) }),
      ).toBeTruthy();
    }
  });
});
