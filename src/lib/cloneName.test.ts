import { describe, expect, it } from "vitest";
import { isHttpUrl, proposedFolder, repositoryNameFromUrl } from "./cloneName";

describe("cloneName", () => {
  it("demarrer-un-depot CA-9 : the name is the last segment after / or :, without the final .git", () => {
    expect(repositoryNameFromUrl("git@github.com:pro-company/client-git.git")).toBe("client-git");
    expect(repositoryNameFromUrl("ssh://git@github.com/org/app")).toBe("app");
    expect(repositoryNameFromUrl("/tmp/origin.git")).toBe("origin");
    expect(repositoryNameFromUrl("git@github.com:app.git")).toBe("app");
    expect(repositoryNameFromUrl("  git@github.com:org/app.git/  ")).toBe("app");
    expect(repositoryNameFromUrl("")).toBe("");
  });

  it("demarrer-un-depot CA-9 : the proposed folder is the last parent plus the name", () => {
    expect(proposedFolder("/Users/me/Dev/Pro", "git@github.com:pro-company/client-git.git")).toBe(
      "/Users/me/Dev/Pro/client-git",
    );
    expect(proposedFolder("/Users/me/Dev/Pro/", "git@github.com:o/a.git")).toBe(
      "/Users/me/Dev/Pro/a",
    );
    expect(proposedFolder(null, "git@github.com:o/a.git")).toBe("");
    expect(proposedFolder("/x", "")).toBe("");
  });

  it("detects http and https URLs only", () => {
    expect(isHttpUrl("https://github.com/o/a.git")).toBe(true);
    expect(isHttpUrl(" HTTP://github.com/o/a.git")).toBe(true);
    expect(isHttpUrl("git@github.com:o/a.git")).toBe(false);
    expect(isHttpUrl("/tmp/origin.git")).toBe(false);
  });
});
