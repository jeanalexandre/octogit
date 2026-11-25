import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ErrorDetails from "./ErrorDetails.svelte";

const text =
  "git@github.com: Permission denied (publickey).\ngit@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository.";

describe("ErrorDetails", () => {
  it("synchroniser CA-20: shows one line and a Details link that reveals the raw output of Git", async () => {
    render(ErrorDetails, { text });

    expect(screen.getByText("git@github.com: Permission denied (publickey).")).toBeTruthy();
    expect(screen.queryByText(/Could not read from remote repository/)).toBeNull();
    const details = screen.getByRole("button", { name: "Details" });
    expect(details.getAttribute("aria-expanded")).toBe("false");

    await fireEvent.click(details);

    expect(details.getAttribute("aria-expanded")).toBe("true");
    const output = screen.getByText(/fatal: Could not read from remote repository\./);
    expect(output.tagName).toBe("PRE");
    expect(output.textContent).toBe(text.slice(text.indexOf("\n") + 1));
    expect(details.getAttribute("aria-controls")).toBe(output.id);
  });

  it("gerer-les-branches CA-22: a message without a raw output has no Details", () => {
    render(ErrorDetails, { text: "Git could not run." });

    expect(screen.getByText("Git could not run.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Details" })).toBeNull();
  });
});
