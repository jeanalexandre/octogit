import { describe, expect, it } from "vitest";
import {
  LANES_MARGIN,
  LANE_WIDTH,
  MIN_GRAPH_WIDTH,
  clampGraphWidth,
  defaultGraphWidth,
  lanesWidth,
} from "./graphWidth";

describe("lanesWidth", () => {
  it("is the width of the rightmost lane used by a node or an edge", () => {
    expect(lanesWidth([])).toBe(LANES_MARGIN);
    expect(lanesWidth([{ lane: 0, edges: [] }])).toBe(LANES_MARGIN);
    expect(
      lanesWidth([
        { lane: 1, edges: [{ kind: "out", from: 1, to: 4, color: 0 }] },
        { lane: 0, edges: [{ kind: "through", from: 2, to: 2, color: 0 }] },
      ]),
    ).toBe(4 * LANE_WIDTH + LANES_MARGIN);
  });
});

describe("defaultGraphWidth (organiser-l-espace CA-11)", () => {
  it("shows every lane when they all fit in 40 % of the zone", () => {
    expect(defaultGraphWidth(200, 1000)).toBe(200);
    expect(defaultGraphWidth(400, 1000)).toBe(400);
  });

  it("stops at 40 % of the zone when the lanes go beyond", () => {
    expect(defaultGraphWidth(1000, 1000)).toBe(400);
    expect(defaultGraphWidth(401, 1000)).toBe(400);
    expect(defaultGraphWidth(1000, 1001)).toBe(400);
  });

  it("shows every lane while the zone is not measured", () => {
    expect(defaultGraphWidth(700, 0)).toBe(700);
  });

  it("is 64 px for a single lane, and never goes below 64 px", () => {
    expect(MIN_GRAPH_WIDTH).toBe(64);
    expect(defaultGraphWidth(LANES_MARGIN, 1000)).toBe(64);
    expect(defaultGraphWidth(LANES_MARGIN, 0)).toBe(64);
    expect(defaultGraphWidth(1000, 40)).toBe(64);
  });
});

describe("clampGraphWidth (organiser-l-espace CA-13)", () => {
  it("keeps a dragged width between 64 px and all the lanes, in whole pixels", () => {
    expect(clampGraphWidth(10, 500)).toBe(64);
    expect(clampGraphWidth(900, 500)).toBe(500);
    expect(clampGraphWidth(100.4, 500)).toBe(100);
    expect(clampGraphWidth(100, 20)).toBe(64);
    expect(clampGraphWidth(200, LANES_MARGIN)).toBe(64);
  });
});
