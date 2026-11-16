import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CommitNode from "./CommitNode.svelte";

describe("CommitNode", () => {
  it("explorer-l-historique CA-30: a stash node is a square with an archive icon and no initials", () => {
    const { container } = render(CommitNode, {
      author: "Jean-Alexandre Gautreau",
      color: 2,
      stash: true,
    });
    const node = container.querySelector("[data-node]") as HTMLElement;
    expect(node).toHaveAttribute("data-shape", "square");
    expect(node.style.getPropertyValue("--lane")).toBe("var(--lane-3)");
    expect(node.querySelector("[data-icon=stash]")).not.toBeNull();
    expect(node.textContent?.trim()).toBe("");
  });

  it("preparer-un-commit CA-1: the WIP node is a dashed circle without initials, told apart by its data attribute", () => {
    const { container } = render(CommitNode, { author: "Alice Martin", color: 1, wip: true });
    const node = container.querySelector("[data-node]") as HTMLElement;
    expect(node).toHaveAttribute("data-shape", "circle");
    expect(node).toHaveAttribute("data-wip");
    expect(node.style.getPropertyValue("--lane")).toBe("var(--lane-2)");
    expect(node.textContent?.trim()).toBe("");
    expect(node.querySelector("svg")).toBeNull();
  });

  it("preparer-un-commit CA-1: a commit node is not a WIP node", () => {
    const { container } = render(CommitNode, { author: "Alice Martin", color: 1 });
    expect(container.querySelector("[data-node]")).not.toHaveAttribute("data-wip");
  });

  it("explorer-l-historique CA-30: a commit node stays a circle with initials and no icon", () => {
    const { container } = render(CommitNode, { author: "Jean-Alexandre Gautreau", color: 2 });
    const node = container.querySelector("[data-node]") as HTMLElement;
    expect(node).toHaveAttribute("data-shape", "circle");
    expect(node.textContent?.trim()).toBe("JG");
    expect(node.querySelector("svg")).toBeNull();
  });
});
