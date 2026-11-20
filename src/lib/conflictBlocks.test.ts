import { describe, expect, it } from "vitest";
import {
  blockCounter,
  conflictLines,
  hasMarkers,
  parseBlocks,
  remainingRanks,
  restoreEndings,
  takeAll,
  takeBlock,
} from "./conflictBlocks";

describe("resoudre-les-conflits CA-5 : fins de ligne gardées ligne à ligne", () => {
  it("keeps CRLF and LF lines as they were in a file with mixed line endings", () => {
    const original = "a\r\nb\nc\r\nlast";
    expect(restoreEndings("a\nb\nc\nlast", original)).toBe(original);
  });

  it("follows the lines that moved or were taken from a block", () => {
    const original = "<<<<<<< HEAD\r\nours\r\n=======\nTheirs\n>>>>>>> develop\nend";
    expect(restoreEndings("ours\nend", original)).toBe("ours\r\nend");
    expect(restoreEndings("Theirs\nend", original)).toBe("Theirs\nend");
  });

  it("gives a new line the dominant ending and adds no final newline", () => {
    expect(restoreEndings("a\nnew\nb", "a\r\nb\r\nc\n")).toBe("a\r\nnew\r\nb");
    expect(restoreEndings("a\nnew\n", "a\nb\r\nc\n")).toBe("a\nnew\n");
  });
});

describe("resoudre-les-conflits CA-2 : lignes du bloc en conflit dans Ours et Theirs", () => {
  const result =
    "top\n<<<<<<< HEAD\nx\ny\n=======\nz\n>>>>>>> d\nmid\n<<<<<<< HEAD\nq\n=======\nr\n>>>>>>> d\nend\n";
  const ours = "top\nx\ny\nmid\nq\nend\n";

  it("marks the lines of the blocks still to do", () => {
    expect([...conflictLines(ours, result, "ours", [0, 1])]).toEqual([1, 2, 4]);
    expect([...conflictLines("top\nz\nmid\nr\nend\n", result, "theirs", [0, 1])]).toEqual([1, 3]);
    expect([...conflictLines(ours, result, "ours", [1])]).toEqual([4]);
    expect([...conflictLines(ours, result, "ours", [])]).toEqual([]);
  });
});

const two = [
  "top",
  "<<<<<<< HEAD",
  "first ours",
  "=======",
  "first theirs",
  ">>>>>>> feature/profiles",
  "middle",
  "<<<<<<< HEAD",
  "second ours 1",
  "second ours 2",
  "=======",
  "second theirs",
  ">>>>>>> feature/profiles",
  "bottom",
  "",
].join("\n");

describe("resoudre-les-conflits CA-3 : Take this block", () => {
  it("finds each block with its Ours and Theirs lines", () => {
    const blocks = parseBlocks(two);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].ours).toEqual(["first ours"]);
    expect(blocks[0].theirs).toEqual(["first theirs"]);
    expect(blocks[1].ours).toEqual(["second ours 1", "second ours 2"]);
  });

  it("takes Ours only in place of the markers", () => {
    expect(takeBlock(two, 0, "ours")).toBe(
      [
        "top",
        "first ours",
        "middle",
        "<<<<<<< HEAD",
        "second ours 1",
        "second ours 2",
        "=======",
        "second theirs",
        ">>>>>>> feature/profiles",
        "bottom",
        "",
      ].join("\n"),
    );
  });

  it("takes Theirs only", () => {
    const text = takeBlock(two, 1, "theirs");
    expect(text).toContain("second theirs\nbottom");
    expect(text).not.toContain("second ours");
    expect(parseBlocks(text)).toHaveLength(1);
  });

  it("takes both sides, Ours then Theirs", () => {
    const text = takeBlock(two, 0, "both");
    expect(text.startsWith("top\nfirst ours\nfirst theirs\nmiddle\n")).toBe(true);
    expect(parseBlocks(text)).toHaveLength(1);
  });

  it("Take all ours and Take all theirs resolve every block", () => {
    const ours = takeAll(two, "ours");
    const theirs = takeAll(two, "theirs");
    expect(ours).toBe("top\nfirst ours\nmiddle\nsecond ours 1\nsecond ours 2\nbottom\n");
    expect(theirs).toBe("top\nfirst theirs\nmiddle\nsecond theirs\nbottom\n");
    expect(hasMarkers(ours) || hasMarkers(theirs)).toBe(false);
  });

  it("keeps CRLF line endings and a missing final newline", () => {
    const crlf = "a\r\n<<<<<<< HEAD\r\nours\r\n=======\r\ntheirs\r\n>>>>>>> x\r\nz";
    expect(takeBlock(crlf, 0, "both")).toBe("a\r\nours\r\ntheirs\r\nz");
  });

  it("ignores a block number that does not exist", () => {
    expect(takeBlock(two, 5, "ours")).toBe(two);
  });
});

describe("resoudre-les-conflits CA-3 : rangs des blocs restants après édition à la main", () => {
  const block = (n: number, ours = `ours ${n}`) =>
    [`<<<<<<< HEAD`, ours, `=======`, `theirs ${n}`, `>>>>>>> d`].join("\n");
  const original = [block(0), "m1", block(1), "m2", block(2), "end"].join("\n");

  it("keeps the rank of a block whose lines were edited", () => {
    const text = [block(0), "m1", block(1, "ours 1 edited"), "m2", block(2), "end"].join("\n");
    expect(remainingRanks(text, original, [0, 1, 2])).toEqual([0, 1, 2]);
  });

  it("drops the last block when it is removed", () => {
    const text = [block(0), "m1", block(1), "m2", "ours 2", "end"].join("\n");
    expect(remainingRanks(text, original, [0, 1, 2])).toEqual([0, 1]);
  });

  it("drops a block that is not the last one", () => {
    const text = [block(0), "m1", "ours 1", "m2", block(2), "end"].join("\n");
    expect(remainingRanks(text, original, [0, 1, 2])).toEqual([0, 2]);
  });

  it("returns nothing when every block is removed", () => {
    expect(remainingRanks("m1\nm2\nend", original, [0, 1, 2])).toEqual([]);
  });

  it("only maps onto the blocks still to do", () => {
    const text = [block(0), "m1", "ours 1", "m2", block(2), "end"].join("\n");
    expect(remainingRanks(text, original, [0, 2])).toEqual([0, 2]);
    const afterFirst = [block(1), "m2", "ours 2", "end"].join("\n");
    expect(remainingRanks(afterFirst, original, [1, 2])).toEqual([1]);
  });
});

describe("resoudre-les-conflits CA-4 : marker lines", () => {
  it("sees each kind of marker line", () => {
    expect(hasMarkers("a\n<<<<<<< HEAD\nb")).toBe(true);
    expect(hasMarkers("a\n=======\nb")).toBe(true);
    expect(hasMarkers("a\n>>>>>>> feature\nb")).toBe(true);
    expect(hasMarkers("a\r\n=======\r\nb")).toBe(true);
  });

  it("sees none in a resolved text or in a line that only contains seven signs", () => {
    expect(hasMarkers("a\nb\n")).toBe(false);
    expect(hasMarkers("x <<<<<<< y\n  =======\n========\n<<<<<<<<")).toBe(false);
  });

  it("counts blocks resolved and to do", () => {
    expect(blockCounter(2, [1])).toBe("Block 1 resolved · Block 2 to do");
    expect(blockCounter(2, [0, 1])).toBe("Blocks 1, 2 to do");
    expect(blockCounter(3, [1])).toBe("Blocks 1, 3 resolved · Block 2 to do");
    expect(blockCounter(2, [])).toBe("Blocks 1, 2 resolved");
  });
});
