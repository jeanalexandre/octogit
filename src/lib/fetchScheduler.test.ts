import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FETCH_INTERVAL_MS, runFetchNow, scheduleFetch } from "./fetchScheduler";

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

  it("synchroniser CA-3: a manual Fetch All waits for the automatic fetch of the repository, then runs alone", async () => {
    let finishAuto = () => {};
    const auto = vi.fn(() => new Promise<void>((resolve) => (finishAuto = resolve)));
    const manual = vi.fn(async () => {});
    const stop = scheduleFetch({ path: "/m", run: auto, intervalMs: 1000 });
    const done = runFetchNow("/m", manual);
    await vi.advanceTimersByTimeAsync(0);
    expect(manual).not.toHaveBeenCalled();
    finishAuto();
    await vi.advanceTimersByTimeAsync(0);
    expect(manual).toHaveBeenCalledTimes(1);
    await done;
    stop();
  });

  it("synchroniser CA-3: the periodic fetch is skipped while a manual Fetch All runs", async () => {
    let finishManual = () => {};
    const manual = vi.fn(() => new Promise<void>((resolve) => (finishManual = resolve)));
    const auto = vi.fn(async () => {});
    const done = runFetchNow("/n", manual);
    const stop = scheduleFetch({ path: "/n", run: auto, intervalMs: 1000 });
    // Le fetch d'ouverture attend ; le périodique est sauté.
    await vi.advanceTimersByTimeAsync(3000);
    expect(auto).not.toHaveBeenCalled();
    finishManual();
    await done;
    await vi.advanceTimersByTimeAsync(0);
    expect(auto).toHaveBeenCalledTimes(1);
    stop();
  });

  it("synchroniser CA-3: a failing manual Fetch All rejects and frees the repository", async () => {
    await expect(
      runFetchNow("/o", async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    const next = vi.fn(async () => {});
    await runFetchNow("/o", next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("explorer-l-historique CA-4: stopping (switching repository) ends the old schedule", async () => {
    const run = vi.fn(async () => {});
    const stop = scheduleFetch({ path: "/d", run, intervalMs: 1000 });
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
