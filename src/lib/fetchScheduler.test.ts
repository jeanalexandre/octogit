import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FETCH_INTERVAL_MS, scheduleFetch } from "./fetchScheduler";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("scheduleFetch", () => {
  it("explorer-l-historique CA-4: the production cadence is 60 s", () => {
    expect(FETCH_INTERVAL_MS).toBe(60_000);
  });

  it("explorer-l-historique CA-3: a fetch starts at once when the repository opens, then every 60 s", async () => {
    const run = vi.fn(async () => {});
    const stop = scheduleFetch({ path: "/a", run });
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).toHaveBeenCalledTimes(4);
    stop();
  });

  it("explorer-l-historique CA-4: never two fetches at once for a repository", async () => {
    let finish = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const stop = scheduleFetch({ path: "/b", run, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
    finish();
  });

  it("explorer-l-historique CA-4: a failing fetch does not stop the schedule", async () => {
    const run = vi.fn(async () => {
      throw new Error("offline");
    });
    const stop = scheduleFetch({ path: "/c", run, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(3);
    stop();
  });

  it("explorer-l-historique CA-3: reopening a repository whose fetch is still running waits for it, then fetches", async () => {
    let finish = () => {};
    let running = 0;
    let maxRunning = 0;
    const run = vi.fn(() => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      return new Promise<void>((resolve) => {
        finish = () => {
          running--;
          resolve();
        };
      });
    });
    const stopOld = scheduleFetch({ path: "/e", run, intervalMs: 60_000 });
    expect(run).toHaveBeenCalledTimes(1);
    stopOld();
    const stopNew = scheduleFetch({ path: "/e", run, intervalMs: 60_000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    expect(maxRunning).toBe(1);
    stopNew();
    finish();
  });

  it("explorer-l-historique CA-3: reopening an idle repository fetches at once", async () => {
    const run = vi.fn(async () => {});
    scheduleFetch({ path: "/f", run, intervalMs: 60_000 })();
    await vi.advanceTimersByTimeAsync(0);
    const stop = scheduleFetch({ path: "/f", run, intervalMs: 60_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });

  it("explorer-l-historique CA-4: stopping while waiting cancels the pending opening fetch", async () => {
    let finish = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    scheduleFetch({ path: "/g", run, intervalMs: 60_000 })();
    scheduleFetch({ path: "/g", run, intervalMs: 60_000 })();
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("explorer-l-historique CA-4: stopping (switching repository) ends the old schedule", async () => {
    const run = vi.fn(async () => {});
    const stop = scheduleFetch({ path: "/d", run, intervalMs: 1000 });
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
