# Story S-62 : Créneau d'un worktree lu dans `.env.local`

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-62-creneau-par-env-local.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-62 (tranche valeur 1 bis)
- Critères couverts : `stack.md` Environnement local (révision du 12/11/2026)
- Jobs servis : J-1
- Revue renforcée : non

## Objectif
Les scripts pnpm qui lancent l'interface ou les tests (`dev:web`, `e2e`) lisent `OCTOGIT_PORT` et `OCTOGIT_DATA_DIR` dans `.env.local` par Node natif, sans préfixe de commande ; `pnpm tauri dev` reste sur 1420 ; aucun changement de comportement de l'application.

## Critères d'acceptation
Aucune spec : critères tirés de `stack.md`, section « Environnement local », champ « Isolement d'un worktree » (révision du 12/11/2026).
- **stack.md Environnement local, a** : Étant donné un `.env.local` à la racine du repo avec `OCTOGIT_PORT=1421` et `OCTOGIT_DATA_DIR=.dev-data/slot-1`, quand je lance `pnpm dev:web` sans préfixe, alors l'interface est servie sur `http://localhost:1421` et le pont de test écrit ses données dans `.dev-data/slot-1` (sauf en-tête `x-octogit-data-dir`, inchangé).
- **stack.md Environnement local, b** : Étant donné le même `.env.local`, quand je lance `pnpm e2e` sans préfixe, alors Playwright démarre son serveur et ses tests sur le port 1421 ; les données de test restent dans un dossier temporaire (comportement actuel de `playwright.config.ts`), jamais dans `.dev-data/`.
- **stack.md Environnement local, c** : Étant donné aucun `.env.local`, alors `pnpm dev:web` et `pnpm e2e` gardent leurs défauts actuels (port 1420, `.dev-data/` pour `dev:web`, dossier temporaire pour `e2e`).
- **stack.md Environnement local, d** : `.env.local` est ignoré par Git.
- **stack.md Environnement local, e** : `pnpm tauri dev` n'est pas isolé : il sert toujours sur 1420 (`devUrl` de `src-tauri/tauri.conf.json` inchangé).

## Contexte technique
- `stack.md`, section « Environnement local », champ « Isolement d'un worktree » : lecture par Node natif (`node --env-file-if-exists=.env.local` ou `process.loadEnvFile`), sans dépendance ; les sous-processus (vite, cargo, pont de test) héritent des variables ; toute commande qui a besoin du créneau passe par un script pnpm.
- `package.json` : `dev:web` lit aujourd'hui le port par expansion du shell (`${OCTOGIT_PORT:-1420}`), qui a lieu avant Node : elle ne verrait pas `.env.local`. Le port doit être lu après le chargement du fichier (par exemple `server.port` de `vite.config.ts` pris de `process.env.OCTOGIT_PORT`, défaut 1420). `e2e` (`playwright test --trace off`) doit aussi passer par le chargement de `.env.local`.
- `playwright.config.ts:5` lit déjà `process.env.OCTOGIT_PORT` ; `:17` passe le créneau en préfixe dans `webServer.command` : à remplacer par l'option `env` de `webServer` (port et dossier temporaire), sans préfixe.
- `vite.config.ts:53` : port fixé à 1420 ; `:22` : le pont hérite de `process.env`, donc de `OCTOGIT_DATA_DIR`.
- `pnpm dev` (lancé par `beforeDevCommand` de `tauri dev`) reste sur 1420 : ne pas lui faire lire `OCTOGIT_PORT` si cela déplaçait `tauri dev`.
- `.gitignore` : ajouter `.env.local`.
- Pas de nouvelle dépendance (Node 26.13.0 a `--env-file-if-exists` et `process.loadEnvFile`).
- Tests : un test Vitest ou Node de la lecture du port et du dossier (fonction pure qui rend port et dossier depuis un environnement, défauts compris), si le code en isole une ; sinon preuve par commande, décrite ci-dessous.

## Tests à écrire d'abord
- [ ] a, c → test de la résolution du port (1421 avec la variable, 1420 sans) et du dossier de données, sur la fonction ou la configuration qui les lit
- [ ] b → test de la configuration Playwright : `webServer` sans préfixe, port pris de l'environnement, `OCTOGIT_DATA_DIR` temporaire passé par `env`
- [ ] a, b (preuve de bout en bout, faite par le reviewer, sans test versionné) : `.env.local` jetable avec `OCTOGIT_PORT=1421`, `pnpm dev:web` répond sur 1421 ; `pnpm e2e` vert sur 1421 ; fichier retiré ensuite
- [ ] d → `git check-ignore .env.local`
- [ ] e → `src-tauri/tauri.conf.json` inchangé (diff)

## Hors périmètre
- `pnpm tauri dev`, `devUrl`, `beforeDevCommand` : inchangés (décision de l'humain du 12/11/2026).
- Code de l'application (Rust, Svelte) : rien.
- Création de worktrees ou de fichiers `.env.local` versionnés.

## Documentation à mettre à jour
- README, section des variables (`README.md:109`) : `OCTOGIT_PORT` et `OCTOGIT_DATA_DIR` lus dans `.env.local` (non versionné) par `pnpm dev:web` et `pnpm e2e`, plus de préfixe ; lancer par les scripts pnpm, jamais `npx playwright` ni `cargo run` en direct ; `pnpm tauri dev` reste sur 1420. Aussi `README.md:23` si l'adresse y change.
- `.env.example` : en-tête qui dit « pas par un fichier .env (rien ne le lit) » à remplacer : copier en `.env.local` ; exemple par préfixe retiré.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : (notée au démarrage de la boucle)

| # | Agent | Résultat | Verdict |
|---|---|---|---|
