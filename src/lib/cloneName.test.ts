import { describe, expect, it } from "vitest";
import { githubSshUrl, isHttpUrl, proposedFolder, repositoryNameFromUrl } from "./cloneName";

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

  it("demarrer-un-depot CA-18 : an https github.com URL gets its SSH form, with or without .git", () => {
    expect(githubSshUrl("https://github.com/org/app.git")).toBe("git@github.com:org/app.git");
    expect(githubSshUrl("https://github.com/org/app")).toBe("git@github.com:org/app.git");
    expect(githubSshUrl("  http://GitHub.com/org/app/  ")).toBe("git@github.com:org/app.git");
  });

  it("demarrer-un-depot CA-18 : another host or another shape has no SSH form", () => {
    expect(githubSshUrl("https://gitlab.com/org/app.git")).toBeNull();
    expect(githubSshUrl("https://github.com.evil.example/org/app.git")).toBeNull();
    expect(githubSshUrl("https://github.com/org")).toBeNull();
    expect(githubSshUrl("https://github.com/org/app/tree/main")).toBeNull();
    expect(githubSshUrl("git@github.com:org/app.git")).toBeNull();
    expect(githubSshUrl("")).toBeNull();
  });

  it("detects http and https URLs only", () => {
    expect(isHttpUrl("https://github.com/o/a.git")).toBe(true);
    expect(isHttpUrl(" HTTP://github.com/o/a.git")).toBe(true);
    expect(isHttpUrl("git@github.com:o/a.git")).toBe(false);
    expect(isHttpUrl("/tmp/origin.git")).toBe(false);
  });
});
