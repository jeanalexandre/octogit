import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Welcome from "./Welcome.svelte";

describe("Welcome", () => {
  it("shows its title", () => {
    render(Welcome);
    expect(screen.getByRole("heading", { name: "Welcome to Octogit" })).toBeInTheDocument();
  });
});
