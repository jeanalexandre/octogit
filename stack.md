# Stack du projet : Octogit

> Aucun profil de type : hérite du seul `profil-stack.md` (commun). Ce fichier documente tous les choix du projet.
> `/story` refuse de démarrer tant qu'un champ reste à renseigner.
> Version du profil de stack utilisée : `0.22.5`
> Validé par l'humain le 08/11/2026.
> Révisions : 08/11/2026 — reports des specs : J-17 (`specs/demarrer-un-depot.md` : `xcode-select --install`, revérification, reprise en 5 s) ; icônes Lucide ; détection des changements par `notify` ; graphe en liste virtualisée HTML et lanes SVG ; intégrations macOS par plugins Tauri et `keyring` (`platform` dépend désormais de Tauri).
> Révisions : 08/11/2026 — amendement de S-1 (décisions de l'humain) : Node 26.13.0 et pnpm 12.18.0 fixés ; dépendances d'outillage acceptées (voir Commandes de qualité) ; exception d'audit GHSA-gcqx-w48m-w2h4.

## Type
- Type de projet : application de bureau, macOS seulement pour la première version (d'autres systèmes ne sont pas exclus ensuite)

## Architecture
- Plateforme cible : macOS 13 Ventura ou plus récent, puces Apple seulement (choix de l'humain)
- Langages : Rust (cœur), TypeScript (interface)
- Frameworks : Tauri 2 (choix de l'humain : application légère, cœur Rust pour le graphe, les diffs, Git et SSH, interface web pour les tokens à chaud, thèmes, lueur et icônes ; Windows et Linux possibles plus tard) ; interface en Svelte 5 (choix de l'humain : réactivité fine pour le graphe, paquet léger, usage courant avec Tauri)
- Découpage (choix de l'humain) : workspace Cargo de plusieurs crates, sans dépendance à Tauri sauf `app` et `platform` (plugins Tauri, choix de l'humain du 08/11/2026) : `git` (lecture `gix`, écritures et réseau par le binaire `git`, sortie brute) ; `identity` (profils, règles, conformité, réécriture d'identité, SSH : génération, test, clé imposée) ; `store` (persistance locale) ; `platform` (tout ce qui est propre à macOS, à doubler pour Linux et Windows) ; `app` (`src-tauri` : commandes et événements Tauri seulement, sans logique). Interface Svelte dans `src/` (écrans, composants, état, tokens issus de `ux/tokens.md`) ; elle ne parle au cœur que par les commandes et événements de `app`.
- Intégrations macOS (choix de l'humain, 08/11/2026) : plugins officiels de Tauri appelés depuis le crate `platform` : `dialog` (sélecteur de dossier), `clipboard-manager` (presse-papiers), `opener` (ouverture dans l'application par défaut), API de thème de la fenêtre (apparence système et ses changements) ; crate `keyring` pour le trousseau macOS (passphrases). Portables vers Windows et Linux.
- Accès à Git (choix de l'humain) : mixte. Binaire `git` installé, en sous-processus, pour tout ce qui écrit ou touche le réseau (commit, merge, rebase, rebase interactif par fichier todo généré, cherry-pick, revert, reset, stash, fetch, pull, push, tags, clone), pour respecter `.git/config` local (identité, `core.sshCommand`, signature) et garder la sortie brute ; bibliothèque Rust pour la lecture rapide (graphe, refs, diffs, statut) : gitoxide, crate `gix` (choix de l'humain : Rust pur, rapide sur l'historique et les refs)
- Détection des changements hors d'Octogit (choix de l'humain, 08/11/2026) : surveillance du système de fichiers par la crate `notify` (FSEvents), sur l'arbre de travail et `.git/` ; rafales regroupées, écritures d'Octogit ignorées ; sert la détection en moins de 1 s des modifications (`specs/preparer-un-commit.md`), des opérations lancées au terminal (`specs/resoudre-les-conflits.md`) et des changements de `.git/config` (`specs/proteger-l-identite.md`). Dans le crate `git`.
- Contrat entre les couches : types TypeScript des commandes et événements Tauri générés depuis Rust (source de vérité : le code Rust ; outil : `tauri-specta`, choix de l'humain, qui génère types et fonctions d'appel dans `src/lib/bindings.ts` ; commande `pnpm gen:bindings`) ; un écart casse la compilation (choix de l'humain)

## Interface
- Styles (choix de l'humain) : CSS natif, sans framework ; tokens en variables CSS posées sur la racine selon thème, palette et Halo (changement à chaud par attribut), dans un fichier unique de tokens écrit à partir de `ux/tokens.md`, seule source des couleurs ; styles propres à chaque composant Svelte.
- Rendu du graphe (choix de l'humain, 08/11/2026) : liste virtualisée en HTML (seules les lignes visibles existent), tronçon de lanes en SVG par ligne ; focus, rôles, clic droit et clavier natifs, styles par les tokens ; objectif 10 000 lignes en moins de 3 s, défilement à 60 images/s (`specs/explorer-l-historique.md`). Virtualisation écrite à la main ou petite bibliothèque : l'agent demande avant d'en ajouter une (hérité).
- Icônes (choix de l'humain, 08/11/2026) : Lucide (licence ISC), paquet Svelte, trait réglé à 1,8 px, 16 px, sans remplissage (`specs/choisir-l-apparence.md`).
- Responsive, tailles de fenêtre (choix de l'humain) : fenêtre de 1 280 × 720 minimum, les trois colonnes de `History` visibles jusqu'à cette largeur ; usage visé en plein écran (~1 500 px, de `ux.md`).
- Accessibilité : de `ux.md` (« Ton et accessibilité ») : tout au clavier, focus visible, texte ≥ 12 px, jamais d'information portée par la couleur seule, WCAG AA dans les deux thèmes (4,5:1 texte, 3:1 lanes, nœuds, focus, bordures).
- Internationalisation : sans objet, interface en anglais seulement (de `ux.md`).

## Données
- Stockage (choix de l'humain) : fichiers JSON, un par domaine (profils, ordre et règles ; dépôts : rattachements manuels, récents, dernier dossier de clone ; préférences : thème, palette, Halo, colonnes masquées, action par défaut de `SyncButton`), écriture atomique (fichier temporaire puis renommage), gérés par le crate `store`. Passphrases SSH dans le trousseau macOS (souhait de l'humain, `specs/configurer-les-profils.md`), via le crate `platform`. Rien n'est écrit dans `~/.gitconfig`.
- Évolution du schéma : champ `version` dans chaque fichier JSON ; migrations écrites dans le crate `store`, appliquées à la lecture, testées par des fichiers d'exemple versionnés.
- Emplacement des données de l'utilisateur : `~/Library/Application Support/Octogit/` ; aucune donnée dans les dépôts hors du `.git/config` local écrit par J-12.

## Intégrations
- Outils SSH (choix de l'humain) : OpenSSH du système (`/usr/bin/ssh`, `/usr/bin/ssh-keygen`, fournis avec macOS), en sous-processus : génération ed25519 et empreinte par `ssh-keygen` ; clé imposée par `core.sshCommand` = `ssh -i <clé> -o IdentitiesOnly=yes -o IdentityAgent=none` ; test d'authentification par `ssh -T git@github.com` avec les mêmes options, interrompu à 10 s.
- Prérequis sur le poste : binaire `git` (Command Line Tools de Xcode, Xcode ou Homebrew ; absent d'un macOS neuf) ; contrôle à chaque lancement (`git --version`). Accès mixte confirmé par l'humain le 08/11/2026 après comparaison des prérequis (libgit2 seul ou `git` embarqué écartés). Git absent : J-17 (`specs/demarrer-un-depot.md`, CA-20 à CA-25) : installation ouverte par `xcode-select --install` (fenêtre d'Apple), revérification par `git --version` jusqu'à ce que Git réponde, reprise du lancement au plus tard 5 s après, y compris dans l'état « installation impossible » ; aucun autre outil vérifié, Git jamais installé ni modifié autrement.
- Services, outils ou API externes appelés : github.com par SSH seulement (fetch, pull, push, tags, clone, Delete from origin, test d'authentification) ; aucune API GitHub. Simulation en test (choix de l'humain) : `origin` = dépôts `--bare` créés dans un dossier temporaire, par chemin ; faux `ssh` de test placé en tête du `PATH`, qui enregistre les options reçues (clé, `IdentitiesOnly`) et rend la réponse voulue (authentifié, refus, silence au-delà de 10 s). Jamais d'appel réel à GitHub dans les tests.

## Authentification
- Nécessaire pour ce projet : non (aucun compte Octogit ; l'accès à GitHub passe par les clés SSH des profils, voir Intégrations)
- Approche : sans objet

## Environnement local
- Lancement de l'application en développement : `pnpm tauri dev` ; données d'Octogit dans `OCTOGIT_DATA_DIR` (par défaut un dossier `.dev-data/` du repo, ignoré par Git), jamais dans `~/Library/Application Support/Octogit/`.
- Affichage de l'interface pour les captures de revue (choix de l'humain) : `pnpm dev:web`, interface sur `http://localhost:1420` dans le navigateur, avec le pont de test (vraies commandes du crate `app`) et un jeu de dépôts d'exemple versionné (branches, conflit en cours, identité non conforme), données dans un dossier temporaire.
- Isolement d'un worktree : créneau n (1 à 3) → `OCTOGIT_PORT=142n` (1421, 1422, 1423) et `OCTOGIT_DATA_DIR=.dev-data/slot-n` ; installation `pnpm install` dans le worktree ; aucun fichier local à copier ; arrêt : `Ctrl+C` puis `rm -rf .dev-data/slot-n` (pas de volume).

## Commandes de qualité (porte de sortie du dev)
- Installation : gestionnaire JavaScript pnpm (choix de l'humain) ; `pnpm install` (chaîne Rust fixée par `rust-toolchain.toml`). Node 26.13.0 fixé par `.nvmrc` (nvm), pnpm 12.18.0 installé par `npm i -g pnpm@12` et fixé par `packageManager` (corepack ne lance pas pnpm 12) (choix de l'humain, 08/11/2026).
- Dépendances d'outillage acceptées (choix de l'humain, 08/11/2026, S-1) : Rust `serde`, `serde_json`, `specta`, `specta-typescript` ; JavaScript `@sveltejs/vite-plugin-svelte`, `vite`, `typescript`, `svelte-check`, `@tauri-apps/api`, `@tauri-apps/cli`, `jsdom`, `@testing-library/jest-dom`, `@eslint/js`, `globals`, `@types/node` ; surcharge `minimatch >= 11.0.1`.
- Lint (choix de l'humain) : `cargo clippy` avec les avertissements en erreur ; ESLint avec `eslint-plugin-svelte` (dont règles d'accessibilité) et `typescript-eslint`. `pnpm lint` (= `cargo clippy --workspace --all-targets -- -D warnings` puis `eslint .`).
- Formatage (choix de l'humain) : `rustfmt` ; Prettier avec `prettier-plugin-svelte`. `pnpm format` (écrit) ; `pnpm format:check` (= `cargo fmt --all --check` puis `prettier --check .`).
- Tests unitaires (choix de l'humain) : `cargo test` (workspace, crates sans Tauri) ; Vitest avec Testing Library pour Svelte. `pnpm test` (= `cargo test --workspace` puis `vitest run`).
- Tests de bout en bout (choix de l'humain) : Playwright sur l'interface Svelte servie dans Chromium ; en mode test, ses appels Tauri passent par un pont local qui exécute les vraies commandes du crate `app` sur des dépôts temporaires, avec le faux `ssh` (`tauri-driver` ne fonctionne pas sur macOS). Non couverts : fenêtre Tauri, menu natif, trousseau (tests manuels). `pnpm e2e` (= `playwright test --trace off`).
- Audit des dépendances (choix de l'humain) : `cargo audit` (base RustSec) et `pnpm audit`. `pnpm audit:deps`. Exception acceptée (choix de l'humain, 08/11/2026) : GHSA-gcqx-w48m-w2h4 (`deepmerge`, faible, outil de build, sans correctif) dans `auditConfig.ignoreGhsas` de `pnpm-workspace.yaml` (pnpm 12 ne lit plus le champ `pnpm` de `package.json` ; la surcharge `minimatch` y est aussi), à retirer dès qu'un correctif existe.
- Build : `pnpm tauri build` (vérifie aussi `pnpm check`, contrôle de types Svelte et TypeScript).
- Fichiers générés (produits par une commande, exclus du formatage et du lint, jamais édités à la main) : `src/lib/bindings.ts`, par `pnpm gen:bindings` (aussi régénéré par `pnpm tauri dev`).
- Mise à jour des dépendances (choix de l'humain) : Dependabot (Cargo et pnpm, hebdomadaire, groupée), fichier `.github/dependabot.yml` créé par une story.
- Exigences avant de clore une story (choix de l'humain) : pas de seuil de couverture chiffré ; chaque critère d'acceptation traité par la story couvert par au moins un test (unitaire ou e2e) ; parcours e2e touchés par la story obligatoires et verts ; lint, formatage, audit et build verts.
- Variables des tests : fixées dans les commandes ci-dessus ou dans un fichier versionné, jamais héritées du shell (hérité)

## Structure et conventions
- Organisation du repo (choix de l'humain) : `crates/git`, `crates/identity`, `crates/store`, `crates/platform` (crates `octogit-git`, `octogit-identity`, `octogit-store`, `octogit-platform`) ; `src-tauri/` (crate `app` : commandes et événements Tauri) ; `src/lib/components/` (un composant Svelte par nom de `ux.md`) ; `src/lib/screens/` (History, Welcome, DiffView, InteractiveRebase, ConflictResolver, ProfileSettings) ; `src/lib/styles/tokens.css` (écrit à partir de `ux/tokens.md`) ; `src/lib/bindings.ts` (généré) ; `e2e/` (Playwright et pont de test) ; `fixtures/` (scripts qui fabriquent les dépôts d'exemple) ; livrables de méthode à la racine (`brief.md`, `ux.md`, `stack.md`, `specs/`, `ux/`).
- Conventions de nommage : `snake_case` en Rust ; `camelCase` en TypeScript ; composants et écrans Svelte en `PascalCase`, au nom exact de `ux.md` (`ProfileBadge.svelte`) ; noms d'interface en anglais.
- Conventions de branches (choix de l'humain) : travail direct sur `main`, sans branche ni pull request ; aucun push sans validation humaine (hérité).
- Conventions de commits : Conventional Commits, en anglais (hérité de `regles-methode.md`)

## Livraison
- Forme livrée : `Octogit.app` dans un `.dmg`, produit par `pnpm tauri build` (puces Apple).
- Distribution et mise à jour (choix de l'humain) : `.dmg` attaché à une release GitHub du repo ; mise à jour manuelle (téléchargement, autorisation au premier lancement). Mise à jour intégrée (plugin `updater` de Tauri, clés de signature Tauri hors du repo, manifeste publié avec la release) envisageable plus tard : besoin produit à porter par `/ksm:brainstorm` puis `/ksm:ux`.
- Signature, notarisation (choix de l'humain) : signature ad hoc par `pnpm tauri build`, sans compte Apple Developer ni notarisation ; une version téléchargée s'autorise une fois au premier lancement. À revoir si d'autres utilisateurs installent Octogit.
- Repo GitHub : `jeanalexandre/octogit`
- CI : gérée par l'humain (hérité)

## Design system
- Utilisé : non ; direction visuelle propre au projet (`ux.md`, « Direction visuelle »), tokens dans `ux/tokens.md`
- Version épinglée : sans objet

## Écarts et ADR
- (aucun pour l'instant)
