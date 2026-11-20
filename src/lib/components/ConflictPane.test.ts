import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ConflictPane from "./ConflictPane.svelte";

const result = [
  "top",
  "<<<<<<< HEAD",
  "first ours",
  "=======",
  "first theirs",
  ">>>>>>> develop",
  "middle",
  "<<<<<<< HEAD",
  "second ours",
  "=======",
  "second theirs",
  ">>>>>>> develop",
  "bottom",
  "",
].join("\n");

function open(extra: Record<string, unknown> = {}) {
  const onresolve = vi.fn();
  render(ConflictPane, {
    file: "settings.txt",
    content: {
      mergeable: true,
      ours: "top\nfirst ours\nmiddle\nsecond ours\nbottom\n",
      theirs: "top\nfirst theirs\nmiddle\nsecond theirs\nbottom\n",
      result,
    },
    ours: { name: "feature/profiles", sha: "a3f9c21" },
    theirs: { name: "develop", sha: "e92a6b3" },
    oursLane: 0,
    theirsLane: 1,
    onresolve,
    ...extra,
  });
  return { onresolve };
}

const resultBox = () => screen.getByRole("textbox", { name: "Result" }) as HTMLTextAreaElement;

describe("resoudre-les-conflits CA-2 : Ours, Theirs, Result", () => {
  it("labels Ours and Theirs with their branch and short SHA, tinted by their lane", () => {
    open();

    const ours = screen.getByRole("region", { name: "Ours" });
    const theirs = screen.getByRole("region", { name: "Theirs" });
    expect(ours.textContent).toContain("feature/profiles · a3f9c21");
    expect(theirs.textContent).toContain("develop · e92a6b3");
    expect(ours.getAttribute("data-lane")).toBe("1");
    expect(theirs.getAttribute("data-lane")).toBe("2");
    expect(ours.textContent).toContain("first ours");
    expect(theirs.textContent).toContain("first theirs");
    expect(resultBox().value).toBe(result);
  });

  it("walks the conflict blocks with Conflict i / n and the arrows", async () => {
    open();

    expect(screen.getByText("Conflict 1 / 2")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Next conflict" }));
    expect(screen.getByText("Conflict 2 / 2")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Next conflict" }));
    expect(screen.getByText("Conflict 1 / 2")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Previous conflict" }));
    expect(screen.getByText("Conflict 2 / 2")).toBeTruthy();
  });

  it("counts the blocks of the file and numbers the current one by its original rank", async () => {
    open();

    await fireEvent.click(screen.getByRole("button", { name: "Take ours" }));
    expect(screen.getByText("Conflict 2 / 2")).toBeTruthy();
    expect(screen.getByText("Block 1 resolved · Block 2 to do")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Take ours" }));
    expect(screen.getByText("Conflict 2 / 2")).toBeTruthy();
    expect(screen.queryByText("Conflict 0 / 2")).toBeNull();
  });

  it("keeps the last rank, never 0, once every block is taken", async () => {
    open();

    await fireEvent.click(screen.getByRole("button", { name: "Take all theirs" }));
    expect(screen.getByText("Blocks 1, 2 resolved")).toBeTruthy();
    expect(screen.getByText("Conflict 2 / 2")).toBeTruthy();
    expect(screen.queryByText(/Conflict 0/)).toBeNull();
  });

  it("keeps the count right after the markers of a block that is not the last are removed by hand", async () => {
    open();

    await fireEvent.input(resultBox(), {
      target: {
        value: result.replace(
          /<<<<<<< HEAD\nfirst ours\n=======\nfirst theirs\n>>>>>>> develop\n/,
          "typed\n",
        ),
      },
    });
    expect(screen.getByText("Block 1 resolved · Block 2 to do")).toBeTruthy();
    expect(screen.getByText("Conflict 2 / 2")).toBeTruthy();
  });

  it("shows the path of the file, in monospace, at the head of the bar", () => {
    open();

    const path = screen.getByText("settings.txt", { selector: ".path" });
    expect(path.closest(".bar")?.firstElementChild).toBe(path);
  });

  it("puts Conflict i / n between the two arrows", () => {
    open();

    const previous = screen.getByRole("button", { name: "Previous conflict" });
    const position = screen.getByText("Conflict 1 / 2");
    const next = screen.getByRole("button", { name: "Next conflict" });
    expect(previous.nextElementSibling).toBe(position);
    expect(position.nextElementSibling).toBe(next);
  });

  it("shows the count and the editable note in the band of Result", () => {
    open();

    const band = screen.getByText("Blocks 1, 2 to do").closest(".band");
    expect(band?.textContent).toContain(
      "editable · written to the file and staged on “Mark as resolved”",
    );
    expect(band?.closest(".result")).not.toBeNull();
  });

  it("highlights the lines of the blocks to do in Ours and Theirs", async () => {
    open();
    const lit = (name: string) =>
      [...screen.getByRole("region", { name }).querySelectorAll(".hl")].map((e) => e.textContent);

    expect(lit("Ours")).toEqual(["first ours", "second ours"]);
    expect(lit("Theirs")).toEqual(["first theirs", "second theirs"]);
    await fireEvent.click(screen.getByRole("button", { name: "Take ours" }));
    expect(lit("Ours")).toEqual(["second ours"]);
  });
});

describe("resoudre-les-conflits CA-3 : Take this block", () => {
  it("takes the current block on the Ours side, in place of the markers", async () => {
    open();

    await fireEvent.click(screen.getByRole("button", { name: "Take ours" }));

    expect(resultBox().value).toContain("top\nfirst ours\nmiddle\n<<<<<<< HEAD\nsecond ours");
    expect(screen.getByText("Conflict 2 / 2")).toBeTruthy();
  });

  it("takes the block on the Theirs side, or both, Ours then Theirs", async () => {
    open();

    await fireEvent.click(screen.getByRole("button", { name: "Take theirs" }));
    expect(resultBox().value).toContain("top\nfirst theirs\nmiddle\n");
    await fireEvent.click(screen.getByRole("button", { name: "Take both" }));
    expect(resultBox().value).toBe(
      "top\nfirst theirs\nmiddle\nsecond ours\nsecond theirs\nbottom\n",
    );
  });

  it("takes the block shown by the arrows", async () => {
    open();

    await fireEvent.click(screen.getByRole("button", { name: "Next conflict" }));
    await fireEvent.click(screen.getByRole("button", { name: "Take ours" }));

    expect(resultBox().value).toContain("<<<<<<< HEAD\nfirst ours\n=======\nfirst theirs");
    expect(resultBox().value).toContain("middle\nsecond ours\nbottom");
  });

  it("Take all ours and Take all theirs resolve every block", async () => {
    open();
    await fireEvent.click(screen.getByRole("button", { name: "Take all ours" }));
    expect(resultBox().value).toBe("top\nfirst ours\nmiddle\nsecond ours\nbottom\n");
  });

  it("Take all theirs resolves every block", async () => {
    open();
    await fireEvent.click(screen.getByRole("button", { name: "Take all theirs" }));
    expect(resultBox().value).toBe("top\nfirst theirs\nmiddle\nsecond theirs\nbottom\n");
  });

  it("keeps Result editable at the keyboard", async () => {
    open();

    await fireEvent.input(resultBox(), { target: { value: "typed by hand\n" } });

    expect(resultBox().readOnly).toBe(false);
    expect(resultBox().value).toBe("typed by hand\n");
  });
});

describe("resoudre-les-conflits CA-4 : Mark as resolved", () => {
  it("is disabled while a marker line remains, and the counter says which blocks are left", async () => {
    open();

    const mark = screen.getByRole("button", { name: "Mark as resolved" }) as HTMLButtonElement;
    expect(mark.disabled).toBe(true);
    expect(screen.getByText("Blocks 1, 2 to do")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Take ours" }));
    expect(mark.disabled).toBe(true);
    expect(screen.getByText("Block 1 resolved · Block 2 to do")).toBeTruthy();
  });

  it("is enabled once no marker line remains, including after a manual edit", async () => {
    open();

    await fireEvent.click(screen.getByRole("button", { name: "Take all ours" }));
    const mark = screen.getByRole("button", { name: "Mark as resolved" }) as HTMLButtonElement;
    expect(mark.disabled).toBe(false);
    await fireEvent.input(resultBox(), { target: { value: "a\n=======\nb\n" } });
    expect(mark.disabled).toBe(true);
    await fireEvent.input(resultBox(), { target: { value: "a\nb\n" } });
    expect(mark.disabled).toBe(false);
  });
});

describe("resoudre-les-conflits CA-5 : Mark as resolved sends Result", () => {
  it("hands the content of Result to the caller", async () => {
    const { onresolve } = open();
    await fireEvent.click(screen.getByRole("button", { name: "Take all theirs" }));

    await fireEvent.click(screen.getByRole("button", { name: "Mark as resolved" }));

    expect(onresolve).toHaveBeenCalledWith("top\nfirst theirs\nmiddle\nsecond theirs\nbottom\n");
  });

  it("gives the file back with its CRLF line endings", async () => {
    const { onresolve } = open({
      content: {
        mergeable: true,
        ours: "a\r\n",
        theirs: "b\r\n",
        result: "<<<<<<< HEAD\r\na\r\n=======\r\nb\r\n>>>>>>> develop\r\nend",
      },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Take ours" }));

    await fireEvent.click(screen.getByRole("button", { name: "Mark as resolved" }));

    expect(onresolve).toHaveBeenCalledWith("a\r\nend");
  });

  it("keeps the mixed line endings of the file, line by line", async () => {
    const { onresolve } = open({
      content: {
        mergeable: true,
        ours: "a\r\n",
        theirs: "b\n",
        result: "head\n<<<<<<< HEAD\r\na\r\n=======\nb\n>>>>>>> develop\r\ntail\r\nend",
      },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Take ours" }));

    await fireEvent.click(screen.getByRole("button", { name: "Mark as resolved" }));

    expect(onresolve).toHaveBeenCalledWith("head\na\r\ntail\r\nend");
  });
});

describe("decision 2 : a file that is not mergeable", () => {
  it("says so, shows no Result and leaves Mark as resolved unavailable", () => {
    open({ content: { mergeable: false, ours: "", theirs: "", result: "" } });

    expect(screen.getByText("Not mergeable yet.")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Result" })).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Mark as resolved" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
