import { describe, expect, it } from "vitest";
import { formatRelative } from "./relativeTime";

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
