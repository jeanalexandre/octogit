import { describe, expect, it } from "vitest";
import { effectiveTheme } from "./theme";

describe("effectiveTheme", () => {
  it("choisir-l-apparence CA-3: Dark and Light are the chosen value, System follows macOS", () => {
    expect(effectiveTheme("dark", false)).toBe("dark");
    expect(effectiveTheme("light", true)).toBe("light");
    expect(effectiveTheme("system", true)).toBe("dark");
    expect(effectiveTheme("system", false)).toBe("light");
  });
});
