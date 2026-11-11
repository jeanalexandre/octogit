import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FetchStatus from "./FetchStatus.svelte";

beforeEach(() => vi.useFakeTimers({ now: new Date("2026-11-10T12:00:00Z") }));
afterEach(() => vi.useRealTimers());

const at = (secondsAgo: number) => Date.now() / 1000 - secondsAgo;

describe("FetchStatus", () => {
  it("explorer-l-historique CA-4: shows the relative age of the last successful fetch", () => {
    render(FetchStatus, { lastFetched: at(2 * 60) });
    expect(screen.getByRole("status")).toHaveTextContent("fetched 2 min ago");
  });

  it("explorer-l-historique CA-4: the age advances on its own, without any gesture", async () => {
    render(FetchStatus, { lastFetched: at(5) });
    expect(screen.getByRole("status")).toHaveTextContent("fetched just now");
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    expect(screen.getByRole("status")).toHaveTextContent("fetched 3 min ago");
  });

  it("explorer-l-historique CA-4: nothing is shown before the first successful fetch", () => {
    render(FetchStatus, { lastFetched: null });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
