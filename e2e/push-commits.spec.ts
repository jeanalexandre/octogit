import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
];

const WORK = { name: "Jag Work", email: "jag@work.fr" };
const PERSO = { name: "Jag Perso", email: "jag@perso.fr" };
const ALICE = { name: "Alice Client", email: "alice@client.fr" };

const pushButton = (page: Page) => page.getByRole("button", { name: /^Push/ });
const commitList = (page: Page) => page.getByRole("list", { name: "Commits to push" });
const originDevelop = (repo: string) =>
  ws.git(`${repo}-origin.git`, "rev-parse", "refs/heads/develop");
const open = (page: Page) => page.goto(ws.urlWithFetchInterval(3_600_000));

/** Dépôt `published` (develop == origin/develop, les 3 commits de Bob déjà sur le distant), rattaché à Work parmi Perso et Pro. */
function prepare(): string {
  const repo = ws.pushRepo("published");
  ws.attachWorkAmongProfiles(repo);
  ws.rememberRecent([repo]);
  return repo;
}

for (const size of sizes) {
  test(`proteger-l-identite CA-20, CA-23 : un auteur fautif bloque « Push 2 », raison et liste ✕ author / ✓, marque sur le nœud, le distant est inchangé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = prepare();
    ws.commitAs(repo, "Good work", WORK);
    ws.commitAs(repo, "Perso by mistake", PERSO, WORK);
    const remote = originDevelop(repo);
    const reason = "1 of 2 commits authored as jag@perso.fr. Profile Work expects jag@work.fr.";

    await open(page);

    await expect(pushButton(page)).toHaveText("Push 2");
    await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText(reason, { exact: true })).toBeVisible();
    await expect(pushButton(page)).toHaveAccessibleDescription(reason);
    const items = commitList(page).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Perso by mistake");
    await expect(items.nth(0)).toContainText("✕ author");
    await expect(items.nth(1)).toContainText("Good work");
    await expect(items.nth(1)).toContainText("✓");
    await expect(page.getByText(/force push/i)).toHaveCount(0);
    // La liste est dans le flux de l'en-tête : elle ne recouvre ni le graphe ni le panneau de droite.
    const listBox = await commitList(page).boundingBox();
    const bodyBox = await page.locator(".body").boundingBox();
    expect(listBox).not.toBeNull();
    expect(bodyBox).not.toBeNull();
    expect(listBox!.y + listBox!.height).toBeLessThanOrEqual(bodyBox!.y + 1);
    // CA-23 : un seul nœud porte la marque, qui nomme le champ ; ceux de Bob (déjà poussés) n'en ont pas.
    await expect(page.locator("[data-node] [data-fault]")).toHaveCount(1);
    await expect(page.locator("[data-node] [data-fault=author]")).toHaveAccessibleName("✕ author");
    await expect(
      page.getByRole("button", { name: /Perso by mistake/ }).locator(".fault-mark"),
    ).toHaveText("✕ author");

    await pushButton(page).click({ force: true });
    await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
    expect(originDevelop(repo)).toBe(remote);
  });
}

test("proteger-l-identite CA-20 : un committer fautif bloque Push avec son nom et son adresse, nœud marqué ✕ committer", async ({
  page,
}) => {
  const repo = prepare();
  ws.commitAs(repo, "Good work", WORK);
  ws.commitAs(repo, "Committed as Perso", WORK, PERSO);
  const remote = originDevelop(repo);

  await open(page);

  await expect(pushButton(page)).toHaveText("Push 2");
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByText(
      "1 of 2 commits committed as Jag Perso <jag@perso.fr>. Profile Work expects Jag Work <jag@work.fr>.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(commitList(page).getByRole("listitem").nth(0)).toContainText("✕ committer");
  await expect(page.locator("[data-node] [data-fault=committer]")).toHaveCount(1);
  await pushButton(page).click({ force: true });
  expect(originDevelop(repo)).toBe(remote);
});

test("proteger-l-identite CA-20 : un auteur collègue au committer conforme ne bloque pas, Push envoie le commit", async ({
  page,
}) => {
  const repo = prepare();
  ws.commitAs(repo, "Colleague work", ALICE, WORK);

  await open(page);

  // Le classement est lu : « disponible » n'est pas l'état d'avant sa lecture.
  await expect(page.locator("[data-push-checked]")).toHaveCount(1);
  await expect(pushButton(page)).toHaveText("Push 1");
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "false");
  await expect(commitList(page)).toHaveCount(0);
  await expect(page.locator("[data-fault]")).toHaveCount(0);
  await pushButton(page).click();
  await expect(
    page.getByRole("group", { name: "Ahead and behind" }).getByLabel("0 commits ahead"),
  ).toBeVisible();
  expect(originDevelop(repo)).toBe(ws.git(repo, "rev-parse", "HEAD"));
});

test("proteger-l-identite CA-22 : origin/develop fusionnée (commits d'un collègue au committer non conforme) ne bloque pas Push", async ({
  page,
}) => {
  const repo = prepare();
  // Les commits de Bob (committer non conforme) sont sur origin/develop ; on les fusionne dans une autre branche.
  ws.git(repo, "checkout", "-q", "-b", "merged", "main");
  ws.git(
    repo,
    "-c",
    "user.name=Jag Work",
    "-c",
    "user.email=jag@work.fr",
    "merge",
    "-q",
    "--no-ff",
    "-m",
    "Merge develop",
    "origin/develop",
  );

  await open(page);

  await expect(page.locator("[data-push-checked]")).toHaveCount(1);
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "false");
  await expect(commitList(page)).toHaveCount(0);
  await expect(page.locator("[data-fault]")).toHaveCount(0);
});

test("proteger-l-identite CA-26 : un commit fait au terminal avec une autre adresse bloque Push au retour dans Octogit", async ({
  page,
}) => {
  const repo = prepare();
  await open(page);
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Nothing to push.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Push 1" })).toHaveCount(0);
  const remote = originDevelop(repo);

  // Au terminal : le dépôt est conforme (Octogit y a écrit Work), le commit vient d'une autre adresse.
  ws.git(
    repo,
    "-c",
    "user.email=jag@perso.fr",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "From terminal",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  await expect(pushButton(page)).toHaveText("Push 1");
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByText(
      "1 of 1 commits committed as Jag Work <jag@perso.fr>. Profile Work expects Jag Work <jag@work.fr>.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator("[data-node] [data-fault=committer]")).toHaveCount(1);
  await pushButton(page).click({ force: true });
  expect(originDevelop(repo)).toBe(remote);
});
