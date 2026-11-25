import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_IDENTITY, Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

test.use({ timezoneId: "UTC" });

const sync = (page: Page) => page.getByRole("group", { name: "Synchronize" });
const pushButton = (page: Page) => page.getByRole("button", { name: /^(Push|Pushing)/ });

/** Nombre d'appels du pont à une commande, relevé depuis l'ouverture de la page. */
function countBridge(page: Page, command: string): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/__bridge/${command}`)) count++;
  });
  return () => count;
}

for (const size of [
  { width: 1500, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`synchroniser CA-19 : pendant un Fetch All ralenti, un clic sur Push ne lance rien, chaque bouton garde son état, un seul sous-processus réseau à la fois (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.pushRepo("ahead");
    ws.attachWork(repo, FIXTURE_IDENTITY);
    // `origin` en URL SSH servie par le faux `ssh` (bare copié de l'origin de la fixture), réponse retardée de 2 s.
    const root = join(ws.root, "serve");
    mkdirSync(join(root, "org"), { recursive: true });
    ws.git(ws.root, "clone", "-q", "--bare", ws.originOf(repo), join(root, "org", "app.git"));
    ws.setOrigin(repo, "git@github.com:org/app.git");
    ws.rememberRecent([repo]);
    const pushes = countBridge(page, "push_repository");
    await page.goto(
      ws.urlWith({
        fake_ssh_mode: "serve",
        fake_ssh_serve_root: root,
        fake_ssh_delay: "2",
        fetch_interval_ms: "3600000",
      }),
    );
    // Le fetch d'ouverture (lui aussi retardé) est terminé.
    await expect(page.getByRole("status")).toHaveText(/^fetched /, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Push 2" })).toBeVisible();
    const before = ws.fakeSshLog().length;

    await sync(page).getByRole("button", { name: "Fetch All" }).click();
    await expect(sync(page).getByRole("button", { name: "Fetching…" })).toBeVisible();
    await expect.poll(() => ws.fakeSshLog().length).toBe(before + 1);
    // Le second bouton ne lance rien et n'affiche pas l'état en cours du premier.
    await pushButton(page).click();
    await expect(pushButton(page)).toHaveText("Push 2");
    await expect(pushButton(page)).not.toHaveText(/Pushing/);
    expect(pushes()).toBe(0);
    expect(ws.fakeSshLog().length).toBe(before + 1);

    await expect(sync(page).getByRole("button", { name: "Fetch All" })).toBeVisible({
      timeout: 10_000,
    });
    // Rien n'est resté en attente : seul le clic fait après la fin du Fetch All lance un push.
    await pushButton(page).click();
    await expect(pushButton(page)).toHaveText(/Pushing…/);
    await expect(pushButton(page)).not.toHaveText(/Pushing/, { timeout: 15_000 });
    expect(pushes()).toBe(1);
  });
}
