import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CloneDialog from "./CloneDialog.svelte";
import type { ProfileView } from "../bindings";

function profile(id: string, name: string): ProfileView {
  return {
    id,
    name,
    color: 0,
    userName: name,
    userEmail: `${id}@example.org`,
    signCommits: false,
    sshKeyPath: "~/.ssh/id",
    rules: [],
  };
}

const profiles = [profile("p2", "Pro"), profile("p1", "Perso")];

function props(overrides = {}) {
  return {
    profiles,
    lastParent: null,
    busy: false,
    error: null,
    onclone: vi.fn(),
    oncancel: vi.fn(),
    oncancelclone: vi.fn(),
    oncreateprofile: vi.fn(),
    onchoosefolder: vi.fn(async () => null),
    ...overrides,
  };
}

const cloneButton = () => screen.getByRole("button", { name: /Clone/ });
const url = () => screen.getByLabelText("URL");
const folder = () => screen.getByLabelText("Folder");

describe("CloneDialog", () => {
  it("demarrer-un-depot CA-8 : lists the profiles in the given order, none selected, Clone disabled", () => {
    render(CloneDialog, props());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(["p2", "p1"]);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(cloneButton()).toBeDisabled();
  });

  it("demarrer-un-depot CA-8 : Clone stays disabled until a profile, a URL and a folder are all set", async () => {
    render(CloneDialog, props());
    await fireEvent.input(url(), { target: { value: "git@github.com:o/app.git" } });
    expect(cloneButton()).toBeDisabled();
    await fireEvent.input(folder(), { target: { value: "/work/app" } });
    expect(cloneButton()).toBeDisabled();
    await fireEvent.click(screen.getByRole("radio", { name: /Pro/ }));
    expect(cloneButton()).toBeEnabled();
    await fireEvent.input(url(), { target: { value: "" } });
    expect(cloneButton()).toBeDisabled();
  });

  it("demarrer-un-depot CA-8 : Clone sends the url, the folder and the profile", async () => {
    const p = props();
    render(CloneDialog, p);
    await fireEvent.click(screen.getByRole("radio", { name: /Perso/ }));
    await fireEvent.input(url(), { target: { value: "git@github.com:o/app.git" } });
    await fireEvent.input(folder(), { target: { value: "/work/app" } });
    await fireEvent.click(cloneButton());
    expect(p.onclone).toHaveBeenCalledWith("git@github.com:o/app.git", "/work/app", "p1");
  });

  it("demarrer-un-depot CA-9 : the folder is the last parent plus the name, empty at the very first clone", async () => {
    const { unmount } = render(CloneDialog, props({ lastParent: "/Users/me/Dev/Pro" }));
    expect(folder()).toHaveValue("");
    await fireEvent.input(url(), {
      target: { value: "git@github.com:pro-company/client-git.git" },
    });
    expect(folder()).toHaveValue("/Users/me/Dev/Pro/client-git");
    unmount();

    render(CloneDialog, props({ lastParent: null }));
    await fireEvent.input(url(), {
      target: { value: "git@github.com:pro-company/client-git.git" },
    });
    expect(folder()).toHaveValue("");
  });

  it("demarrer-un-depot CA-9 : Choose… changes the parent folder", async () => {
    const p = props({
      lastParent: "/Users/me/Dev/Pro",
      onchoosefolder: vi.fn(async () => "/other"),
    });
    render(CloneDialog, p);
    await fireEvent.input(url(), { target: { value: "git@github.com:o/client-git.git" } });
    await fireEvent.click(screen.getByRole("button", { name: /Choose/ }));
    await vi.waitFor(() => expect(folder()).toHaveValue("/other/client-git"));
  });

  it("demarrer-un-depot CA-9 : a cancelled Choose… keeps the folder", async () => {
    render(CloneDialog, props({ lastParent: "/a", onchoosefolder: vi.fn(async () => null) }));
    await fireEvent.input(url(), { target: { value: "git@github.com:o/x.git" } });
    await fireEvent.click(screen.getByRole("button", { name: /Choose/ }));
    expect(folder()).toHaveValue("/a/x");
  });

  it("demarrer-un-depot CA-10 : the sentence names the chosen profile, Pro then Perso", async () => {
    render(CloneDialog, props());
    expect(screen.queryByText(/will get the/)).toBeNull();
    await fireEvent.click(screen.getByRole("radio", { name: /Pro/ }));
    expect(
      screen.getByText(".git/config will get the Pro identity, SSH key and signing."),
    ).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("radio", { name: /Perso/ }));
    expect(
      screen.getByText(".git/config will get the Perso identity, SSH key and signing."),
    ).toBeInTheDocument();
  });

  it("demarrer-un-depot CA-10 : the sentence comes after Folder and before the buttons (maquette welcome.html, section 3)", async () => {
    render(CloneDialog, props());
    await fireEvent.click(screen.getByRole("radio", { name: /Pro/ }));
    const sentence = screen.getByText(/will get the Pro identity/);
    const folder = screen.getByLabelText("Folder");
    const cancel = screen.getByRole("button", { name: /Cancel/ });
    expect(
      folder.compareDocumentPosition(sentence) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      sentence.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  async function fillHttps(
    p: ReturnType<typeof props>,
    address = "https://github.com/org/app.git",
  ) {
    render(CloneDialog, p);
    await fireEvent.click(screen.getByRole("radio", { name: /Pro/ }));
    await fireEvent.input(url(), { target: { value: address } });
    await fireEvent.input(folder(), { target: { value: "/work/app" } });
  }

  it("demarrer-un-depot CA-18 : an https github.com URL offers « Use git@github.com:org/app.git? », checked by default, and clones the SSH URL", async () => {
    const p = props();
    await fillHttps(p);
    const box = screen.getByRole("checkbox", { name: "Use git@github.com:org/app.git?" });
    expect(box).toBeChecked();
    // L'URL saisie reste affichée telle quelle.
    expect(url()).toHaveValue("https://github.com/org/app.git");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(cloneButton()).toBeEnabled();
    await fireEvent.click(cloneButton());
    expect(p.onclone).toHaveBeenCalledWith("git@github.com:org/app.git", "/work/app", "p2");
  });

  it("demarrer-un-depot CA-18 : unchecked, the click on Clone is refused with a message and nothing is cloned", async () => {
    const p = props();
    await fillHttps(p);
    await fireEvent.click(
      screen.getByRole("checkbox", { name: /Use git@github.com:org\/app.git/ }),
    );
    await fireEvent.click(cloneButton());
    expect(p.onclone).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cloning over HTTPS is not supported: tick “Use git@github.com:org/app.git?” to clone over SSH.",
    );
    // Recocher efface le refus et rend le clone possible.
    await fireEvent.click(
      screen.getByRole("checkbox", { name: /Use git@github.com:org\/app.git/ }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    await fireEvent.click(cloneButton());
    expect(p.onclone).toHaveBeenCalledOnce();
  });

  it("demarrer-un-depot CA-18 : an https URL of another host than github.com is refused with a message, Clone disabled", async () => {
    const p = props();
    await fillHttps(p, "https://gitlab.com/org/app.git");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only github.com URLs can be cloned over HTTPS (converted to SSH).",
    );
    expect(cloneButton()).toBeDisabled();
    await fireEvent.click(cloneButton());
    expect(p.onclone).not.toHaveBeenCalled();
  });

  it("demarrer-un-depot CA-17 : without a profile, « No profile yet » and « Create profile… » show and Clone stays disabled", async () => {
    const p = props({ profiles: [] });
    render(CloneDialog, p);
    expect(screen.getByText("No profile yet")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    await fireEvent.input(url(), { target: { value: "git@github.com:o/app.git" } });
    await fireEvent.input(folder(), { target: { value: "/work/app" } });
    expect(cloneButton()).toBeDisabled();
    await fireEvent.click(cloneButton());
    expect(p.onclone).not.toHaveBeenCalled();
  });

  it("demarrer-un-depot CA-17 : « Create profile… » hands over the URL and the folder typed so far", async () => {
    const p = props({ profiles: [], oncreateprofile: vi.fn() });
    render(CloneDialog, p);
    await fireEvent.input(url(), { target: { value: "git@github.com:o/app.git" } });
    await fireEvent.input(folder(), { target: { value: "/work/app" } });
    await fireEvent.click(screen.getByRole("button", { name: /Create profile…/ }));
    expect(p.oncreateprofile).toHaveBeenCalledWith({
      url: "git@github.com:o/app.git",
      folder: "/work/app",
    });
  });

  it("demarrer-un-depot CA-17 : with profiles, no « Create profile… »", () => {
    render(CloneDialog, props());
    expect(screen.queryByText("No profile yet")).toBeNull();
    expect(screen.queryByRole("button", { name: /Create profile…/ })).toBeNull();
  });

  it("demarrer-un-depot CA-16 : Escape and Cancel close the dialog without cloning", async () => {
    const p = props();
    render(CloneDialog, p);
    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(p.oncancel).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(p.oncancel).toHaveBeenCalledTimes(2);
    expect(p.onclone).not.toHaveBeenCalled();
  });

  it("shows the busy state with every field and Clone disabled", () => {
    render(
      CloneDialog,
      props({
        busy: true,
        initial: {
          profileId: "p2",
          url: "git@github.com:pro-company/client-git.git",
          folder: "/w/client-git",
        },
      }),
    );
    expect(screen.getByText("Cloning client-git with profile Pro…")).toBeInTheDocument();
    expect(url()).toBeDisabled();
    expect(folder()).toBeDisabled();
    expect(cloneButton()).toBeDisabled();
  });

  const running = {
    busy: true,
    initial: {
      profileId: "p2",
      url: "git@github.com:pro-company/client-git.git",
      folder: "/w/client-git",
    },
  };

  it("demarrer-un-depot CA-12 : the clone in progress shows its sentence, a progress bar, the received objects over the total and Cancel", () => {
    render(CloneDialog, props({ ...running, progress: { received: 9, total: 20 } }));
    expect(screen.getByText("Cloning client-git with profile Pro…")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("value", "9");
    expect(bar).toHaveAttribute("max", "20");
    expect(screen.getByText("9 / 20 objects")).toBeInTheDocument();
    const cancel = screen.getByRole("button", { name: /Cancel/ });
    expect(cancel).toBeEnabled();
    expect(cancel.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  it("demarrer-un-depot CA-12 : before the first report the bar is indeterminate and no counter shows", () => {
    render(CloneDialog, props(running));
    const bar = screen.getByRole("progressbar");
    expect(bar).not.toHaveAttribute("value");
    expect(screen.queryByText(/objects/)).toBeNull();
  });

  it("demarrer-un-depot CA-12 : Cancel during the clone stops the clone, it does not close the dialog by itself", async () => {
    const p = props({ ...running, oncancelclone: vi.fn() });
    render(CloneDialog, p);
    await fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(p.oncancelclone).toHaveBeenCalledOnce();
    expect(p.oncancel).not.toHaveBeenCalled();
  });

  it("shows « Clone failed: » with the raw output and keeps the fields", async () => {
    render(
      CloneDialog,
      props({
        error: "fatal: repository not found",
        initial: { profileId: "p2", url: "git@x:o/a.git", folder: "/w/a" },
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Clone failed:");
    expect(screen.getByRole("alert")).toHaveTextContent("fatal: repository not found");
    expect(url()).toHaveValue("git@x:o/a.git");
    expect(folder()).toHaveValue("/w/a");
  });
});
