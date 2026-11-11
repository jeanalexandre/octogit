import { describe, expect, it } from "vitest";
import { formatAbsolute, formatRelative, formatRelativeShort } from "./relativeTime";

const now = 1_700_000_000;

describe("formatRelative", () => {
  it("says just now under a minute", () => {
    expect(formatRelative(now - 20, now)).toBe("just now");
  });
  it("uses minutes, hours, days and weeks", () => {
    expect(formatRelative(now - 5 * 60, now)).toBe("5 minutes ago");
    expect(formatRelative(now - 2 * 3600, now)).toBe("2 hours ago");
    expect(formatRelative(now - 86400, now)).toBe("yesterday");
    expect(formatRelative(now - 4 * 86400, now)).toBe("4 days ago");
    expect(formatRelative(now - 14 * 86400, now)).toBe("2 weeks ago");
  });
});

describe("formatRelativeShort (dates of the graph)", () => {
  it("abbreviates minutes and keeps the other units", () => {
    expect(formatRelativeShort(now - 12 * 60, now)).toBe("12 min ago");
    expect(formatRelativeShort(now - 60, now)).toBe("1 min ago");
    expect(formatRelativeShort(now - 59 * 60 - 59, now)).toBe("59 min ago");
    expect(formatRelativeShort(now - 3 * 3600, now)).toBe("3 hours ago");
    expect(formatRelativeShort(now - 86400, now)).toBe("yesterday");
    expect(formatRelativeShort(now - 21 * 86400, now)).toBe("3 weeks ago");
    expect(formatRelativeShort(now - 10, now)).toBe("just now");
  });
});

describe("formatAbsolute (tooltip of a date)", () => {
  it("writes the local date and time as 2026-11-04 14:32", () => {
    const local = new Date(2026, 10, 4, 14, 32, 59).getTime() / 1000;
    expect(formatAbsolute(local)).toBe("2026-11-04 14:32");
    expect(formatAbsolute(new Date(2025, 0, 2, 3, 4).getTime() / 1000)).toBe("2025-01-02 03:04");
  });
});
