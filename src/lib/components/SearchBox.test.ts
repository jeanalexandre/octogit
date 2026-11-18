import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SearchBox from "./SearchBox.svelte";

const count = () => document.querySelector("[data-search-count]") as HTMLElement;
const field = () => screen.getByRole("searchbox", { name: "Search history" });

describe("SearchBox", () => {
  it("explorer-l-historique CA-17: exposes focus() that puts the focus on the field", () => {
    const { component } = render(SearchBox, { value: "", total: null, position: 0 });
    expect(field()).not.toHaveFocus();
    component.focus();
    expect(field()).toHaveFocus();
  });

  it("empty state: placeholder naming the searched fields, no counter, no result message", () => {
    render(SearchBox, { value: "", total: null, position: 0 });
    expect(field()).toHaveAttribute("placeholder", "Message, author, SHA");
    expect(screen.queryByText(/\//)).toBeNull();
    expect(screen.queryByText("No results")).toBeNull();
  });

  it("explorer-l-historique CA-18: shows the counter as « position / total »", () => {
    render(SearchBox, { value: "notify", total: 12, position: 3 });
    expect(count()).toHaveTextContent("3 / 12");
    expect(count()).toHaveAttribute("aria-live", "polite");
  });

  it("explorer-l-historique CA-21: a search without result says so and offers no way to move", () => {
    render(SearchBox, { value: "zzz", total: 0, position: 0 });
    expect(count()).toHaveTextContent("No results");
    expect(screen.getByRole("button", { name: "Next match" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous match" })).toBeDisabled();
  });

  it("typing reports the new text", async () => {
    const oninput = vi.fn();
    render(SearchBox, { value: "", total: null, position: 0, oninput });
    await fireEvent.input(field(), { target: { value: "not" } });
    expect(oninput).toHaveBeenCalledWith("not");
  });

  it("explorer-l-historique CA-19: Enter goes to the next result, Shift+Enter to the previous", async () => {
    const onnext = vi.fn();
    const onprevious = vi.fn();
    render(SearchBox, { value: "notify", total: 5, position: 2, onnext, onprevious });
    await fireEvent.keyDown(field(), { key: "Enter" });
    expect(onnext).toHaveBeenCalledTimes(1);
    expect(onprevious).not.toHaveBeenCalled();
    await fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    expect(onprevious).toHaveBeenCalledTimes(1);
    expect(onnext).toHaveBeenCalledTimes(1);
  });

  it("explorer-l-historique CA-19: the ↑ and ↓ buttons move the same way", async () => {
    const onnext = vi.fn();
    const onprevious = vi.fn();
    render(SearchBox, { value: "notify", total: 5, position: 2, onnext, onprevious });
    await fireEvent.click(screen.getByRole("button", { name: "Next match" }));
    await fireEvent.click(screen.getByRole("button", { name: "Previous match" }));
    expect(onnext).toHaveBeenCalledTimes(1);
    expect(onprevious).toHaveBeenCalledTimes(1);
  });

  it("explorer-l-historique CA-22: « Show matches only » reports its state", async () => {
    const onmatchesonly = vi.fn();
    render(SearchBox, {
      value: "notify",
      total: 5,
      position: 1,
      matchesOnly: false,
      onmatchesonly,
    });
    const box = screen.getByRole("checkbox", { name: "Show matches only" });
    expect(box).not.toBeChecked();
    await fireEvent.click(box);
    expect(onmatchesonly).toHaveBeenCalledWith(true);
  });
});
