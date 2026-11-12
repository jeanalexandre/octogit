import { describe, expect, it } from "vitest";
import {
  LANE_WIDTH,
  MIN_GRAPH_WIDTH,
  clampGraphWidth,
  defaultGraphWidth,
  lanesWidth,
} from "./graphWidth";

describe("lanesWidth", () => {
  it("is the width of the rightmost lane used by a node or an edge", () => {
    expect(lanesWidth([])).toBe(MIN_GRAPH_WIDTH);
    expect(lanesWidth([{ lane: 0, edges: [] }])).toBe(MIN_GRAPH_WIDTH);
    expect(
      lanesWidth([
        { lane: 1, edges: [{ kind: "out", from: 1, to: 4, color: 0 }] },
        { lane: 0, edges: [{ kind: "through", from: 2, to: 2, color: 0 }] },
      ]),
    ).toBe(4 * LANE_WIDTH + MIN_GRAPH_WIDTH);
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

  it("never goes below one lane", () => {
    expect(defaultGraphWidth(1000, 40)).toBe(MIN_GRAPH_WIDTH);
  });
});

describe("clampGraphWidth (organiser-l-espace CA-13)", () => {
  it("keeps a dragged width between one lane and all the lanes, in whole pixels", () => {
    expect(clampGraphWidth(10, 500)).toBe(MIN_GRAPH_WIDTH);
    expect(clampGraphWidth(900, 500)).toBe(500);
    expect(clampGraphWidth(100.4, 500)).toBe(100);
    expect(clampGraphWidth(100, 20)).toBe(MIN_GRAPH_WIDTH);
  });
});
