# octogit

Octogit est un client Git de bureau pour macOS : il explore l'historique d'un dépôt et protège l'identité de commit selon le profil choisi.
Application Tauri 2 (cœur Rust) avec une interface Svelte 5.

## Prérequis

- macOS 13 ou plus récent, puce Apple
- Rust, version fixée par `rust-toolchain.toml` (installée par `rustup`)
- Node 26.13.0 (fixé par `.nvmrc` : `nvm install`) et pnpm 12.18.0 (`npm i -g pnpm@12` ; corepack ne lance pas pnpm 12)
- le binaire `git` (Command Line Tools de Xcode, Xcode ou Homebrew)
- `cargo-audit` pour `pnpm audit:deps` (`cargo install cargo-audit`)

## Installation

```sh
pnpm install
```

## Lancement

- `pnpm tauri dev` : l'application dans sa fenêtre ; régénère `src/lib/bindings.ts`.
- `pnpm dev:web` : l'interface seule sur `http://localhost:1420` dans le navigateur, avec un pont local qui exécute les vraies commandes Rust (utilisé par Playwright et les captures de revue).

## Ouvrir un dépôt

- Depuis `Welcome` : **Open folder…** (Cmd+O) ouvre le sélecteur de dossier ; la liste **Recent** (nom, chemin, date relative de dernière ouverture) ouvre un dépôt d'un clic.
- Un dossier qui n'est pas un dépôt Git est refusé par un message qui le nomme ; rien n'est écrit dans ce dossier.
- Dans `History`, le sélecteur de dépôt (`RepoPicker`, le nom du dépôt en haut à gauche) liste les récents et propose aussi **Open folder…** pour changer de dépôt dans la même fenêtre.
- Le dépôt ouvert passe en tête de Recent ; au lancement, Octogit rouvre le dernier dépôt ouvert (`repositories.json`, version 2 ; la version 1 est migrée à la lecture).
- En test (`pnpm dev:web`, Playwright), le sélecteur natif est remplacé par le dossier posé dans `window.__octogitChosenFolder`.

## Commandes de qualité

| Commande            | Rôle                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `pnpm lint`         | `cargo clippy` (avertissements en erreur) puis ESLint                |
| `pnpm format:check` | `cargo fmt --check` puis Prettier (`pnpm format` écrit)              |
| `pnpm test`         | `cargo test --workspace` puis Vitest                                 |
| `pnpm e2e`          | Playwright sur l'interface servie par `pnpm dev:web`                 |
| `pnpm audit:deps`   | `cargo audit` et `pnpm audit`                                        |
| `pnpm gen:bindings` | génère `src/lib/bindings.ts` depuis le contrat Rust (`tauri-specta`) |
| `pnpm tauri build`  | build de l'application (lance aussi `pnpm check`)                    |

## Livraison

Octogit est livré en `.dmg` pour puces Apple, signé ad hoc (sans compte Apple Developer ni notarisation). Pas de mise à jour intégrée : on met à jour en téléchargeant la nouvelle version.

### Construire

```sh
pnpm tauri build
scripts/check-bundle.sh   # monte le .dmg (lecture seule) et vérifie Octogit.app : signature ad hoc, arm64, macOS 13 minimum
```

Le `.dmg` est dans `target/release/bundle/dmg/` (`Octogit_<version>_aarch64.dmg`), l'application dans `target/release/bundle/macos/Octogit.app`.

### Installer

Ouvrir le `.dmg`, glisser `Octogit.app` dans `Applications`.

### Premier lancement (version téléchargée)

macOS bloque une application non notarisée téléchargée. Une seule fois :

- macOS 15 et plus récent (dont macOS 26) : Réglages Système › Confidentialité et sécurité › **Ouvrir quand même** (après une première tentative de lancement). Le clic droit › Ouvrir ne contourne plus Gatekeeper ;
- macOS 13 et 14 seulement : clic droit sur `Octogit.app` › **Ouvrir**, puis confirmer (la voie des Réglages Système marche aussi).

### Publier une release (manuel, sur `jeanalexandre/octogit`)

1. Monter la version dans `package.json`, `src-tauri/tauri.conf.json` et le `Cargo.toml` racine (`[workspace.package]`, dont `src-tauri/Cargo.toml` hérite), puis lancer `pnpm tauri build` et `scripts/check-bundle.sh`.
2. Créer un tag `v<version>` et le pousser sur `jeanalexandre/octogit`.
3. Sur GitHub : Releases › Draft a new release, choisir le tag, rédiger les notes.
4. Attacher `target/release/bundle/dmg/Octogit_<version>_aarch64.dmg`, puis publier.

Aucune automatisation ni CI de release.

## Données

Octogit écrit ses fichiers JSON dans `OCTOGIT_DATA_DIR`. En développement et en test, le défaut est le dossier `.dev-data/` du repo (ignoré par Git) ; jamais `~/Library/Application Support/Octogit/`, réservé à l'application livrée. Les variables `OCTOGIT_DATA_DIR` et `OCTOGIT_PORT` se passent dans l'environnement du shell (aucun fichier `.env` n'est lu), par exemple `OCTOGIT_PORT=1421 OCTOGIT_DATA_DIR=/chemin/absolu pnpm dev:web`. Une valeur absolue est préférable pour `OCTOGIT_DATA_DIR`. `OCTOGIT_PORT` n'agit que sur `pnpm dev:web` : `pnpm tauri dev` sert toujours sur le port 1420, donc deux `pnpm tauri dev` en parallèle se bloquent. Voir `.env.example`.

## Organisation du repo

- `crates/git` (`octogit-git`) : lecture des dépôts avec `gix`
- `crates/identity` (`octogit-identity`) : profils et règles d'identité (vide pour l'instant)
- `crates/store` (`octogit-store`) : persistance JSON versionnée, écriture atomique
- `crates/platform` (`octogit-platform`) : intégrations propres à macOS
- `src-tauri/` (crate `octogit-app`) : commandes et événements Tauri, sans logique
- `src/lib/screens/`, `src/lib/components/` : écrans et composants Svelte ; `src/lib/styles/tokens.css` : tokens de couleur ; `src/lib/bindings.ts` : généré
- `e2e/` : tests Playwright ; `fixtures/` : scripts qui fabriquent les dépôts d'exemple et le faux `ssh` de test
- `brief.md`, `ux.md`, `stack.md`, `specs/`, `ux/`, `plan.md`, `stories/` : livrables de méthode
