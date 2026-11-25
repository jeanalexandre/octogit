import { describe, expect, it } from "vitest";
import { parentCount } from "./graphParents";

const edge = (kind: "through" | "in" | "out") => ({ kind, from: 0, to: 0, color: 0 });

describe("parentCount", () => {
  it("revenir-en-arriere CA-20: counts one out edge per parent, ignoring lanes that pass or arrive", () => {
    expect(parentCount({ edges: [] })).toBe(0);
    expect(parentCount({ edges: [edge("in"), edge("through"), edge("out")] })).toBe(1);
    expect(parentCount({ edges: [edge("through"), edge("out"), edge("out")] })).toBe(2);
  });
});
