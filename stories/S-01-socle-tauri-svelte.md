# Story S-1 : Poser le socle Tauri 2 + Svelte 5 et ouvrir le dernier dépôt

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-01-socle-tauri-svelte.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-1 (tranche socle)
- Critères couverts : `explorer-l-historique` CA-1 (partie lancement ; le contrôle « Git installé » est en S-49)
- Jobs servis : J-1
- Revue renforcée : oui (architecture : nouveau workspace de crates, contrat `tauri-specta` entre Rust et TypeScript, dépendances structurantes)

## Objectif
Poser le socle exécutable (workspace Cargo `git`, `identity`, `store`, `platform`, `app`, Tauri 2, Svelte 5, `tokens.css` du thème par défaut, contrat `tauri-specta`, pont de test Playwright, fixtures de dépôts, commandes de qualité, Dependabot) et, au lancement, ouvrir le dernier dépôt dans `History` (liste de commits simple), sinon `Welcome`.

## Critères d'acceptation
- **explorer-l-historique CA-1** : Étant donné Git installé et un dépôt ouvert lors de la session précédente et toujours présent, quand je lance Octogit, alors ce dépôt s'affiche dans `History` sans autre geste ; si ce dépôt est introuvable, `Welcome` s'ouvre à la place.
  - Périmètre de S-1 : le contrôle de présence de Git (`git --version`, état « Git not found ») n'est pas fait ici (S-49). « Dépôt introuvable » : `Welcome` s'ouvre ; son état « Repository not found: … » est en S-54. Premier lancement sans dépôt : `Welcome` seul (son contenu complet est en S-2 et suivantes).

## Décisions de l'humain
### Fiche (08/11/2026)
1. Variables du shell (`OCTOGIT_DATA_DIR`, `OCTOGIT_PORT`, `E2E_BASE_URL`) : vérifiées par l'humain, aucune définie avec une valeur différente (RAS).

## Contexte technique
- Lire `stack.md` en entier : Architecture, Interface, Données, Environnement local, Commandes de qualité, Structure et conventions.
- Organisation du repo (stack.md « Structure et conventions ») : `crates/git`, `crates/identity`, `crates/store`, `crates/platform` (crates `octogit-git`, `octogit-identity`, `octogit-store`, `octogit-platform`) ; `src-tauri/` (crate `app` : commandes et événements seulement, sans logique) ; `src/lib/components/`, `src/lib/screens/` (`History`, `Welcome`), `src/lib/styles/tokens.css`, `src/lib/bindings.ts` (généré), `e2e/` (Playwright et pont de test), `fixtures/` (scripts qui fabriquent les dépôts d'exemple).
- Crates : `git` lit avec `gix` (graphe, refs) et ne dépend pas de Tauri ; `store` écrit des fichiers JSON avec champ `version`, écriture atomique (temporaire puis renommage), dans `OCTOGIT_DATA_DIR` (défaut `.dev-data/` du repo, ignoré par Git), jamais dans `~/Library/Application Support/Octogit/` en dev ni en test ; `platform` et `app` dépendent de Tauri. `identity` : crate vide prêt à recevoir ses modules (rien à implémenter ici).
- Contrat : `tauri-specta`, types et appels dans `src/lib/bindings.ts`, `pnpm gen:bindings` (aussi lancé par `pnpm tauri dev`) ; fichier généré, exclu du formatage et du lint, jamais édité à la main.
- Tokens : `src/lib/styles/tokens.css` écrit à partir de `ux/tokens.md`, seule source des couleurs ; ici seulement le thème par défaut (Neon, sombre et clair selon le système) ; le choix de thème, palette et Halo reste en S-47 / S-48. Styles CSS natifs, sans framework, propres à chaque composant Svelte.
- Écrans (`ux.md`, `ux/ecrans/history.md`, `ux/ecrans/welcome.md`, maquettes `ux/maquettes/history.html`, `ux/maquettes/welcome.html`, section « Direction visuelle » de `ux.md`) : S-1 ne livre qu'une `History` minimale (en-tête de dépôt et liste simple de commits : résumé, auteur, date) et un `Welcome` minimal (titre « Welcome to Octogit »). Composants Svelte au nom exact de `ux.md`.
- Pont de test : `pnpm dev:web` sert l'interface sur `http://localhost:1420` (port `OCTOGIT_PORT`) avec un pont local qui exécute les vraies commandes du crate `app` sur des dépôts temporaires ; aucun appel Tauri réel dans Playwright (`tauri-driver` ne marche pas sur macOS).
- Fixtures : scripts dans `fixtures/` qui fabriquent, dans un dossier temporaire, les dépôts d'exemple de `stack.md` (simple, avec branches et `origin` en `--bare` par chemin, conflit en cours, identité non conforme) ; faux `ssh` de test à placer en tête du `PATH` (enregistre ses options, réponse configurable) prévu dès maintenant pour les stories de réseau. Le dépôt de 10 000 commits est en S-4.
- Qualité : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build` (lance aussi `pnpm check`), chaîne Rust fixée par `rust-toolchain.toml`, ESLint (`eslint-plugin-svelte`, `typescript-eslint`), Prettier (`prettier-plugin-svelte`), Vitest et Testing Library, scripts exacts de `stack.md`.
- `.github/dependabot.yml` : Cargo et pnpm, hebdomadaire, groupée. La CI est gérée par l'humain : ne pas créer de workflow.
- `.gitignore` : `target/`, `node_modules/`, `.dev-data/`, `.DS_Store`, sorties de build ; `.env.example` à créer avec les variables lues par le projet (`OCTOGIT_DATA_DIR`, `OCTOGIT_PORT`).
- Dépendances : exclusivement celles que `stack.md` nomme (Tauri 2, Svelte 5, `gix`, `notify` seulement quand une story en a besoin, `tauri-specta`, `keyring` et plugins Tauri quand une story en a besoin, Lucide, Playwright, Vitest, ESLint, Prettier). Toute autre dépendance est un écart à soumettre.

## Interface à vérifier
- **Écrans et états** : `History` (liste de commits du dernier dépôt, états vide : dépôt sans commit) ; `Welcome` (aucun dépôt mémorisé, dépôt mémorisé introuvable)
- **Tailles d'écran** : 1500×900 (portable en plein écran, `ux.md` « Contexte d'usage »), 1920×1080 (second écran) ; plancher 1280×720 (`stack.md`)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] explorer-l-historique CA-1 (dépôt présent) → e2e Playwright : `OCTOGIT_DATA_DIR` contient un fichier de dépôts avec le dernier dépôt = fixture ; le lancement affiche `History` avec les commits de la fixture, sans geste
- [ ] explorer-l-historique CA-1 (dépôt introuvable) → e2e : le dernier dépôt mémorisé pointe un dossier supprimé ; `Welcome` s'affiche à la place de `History`
- [ ] explorer-l-historique CA-1 (premier lancement) → e2e : dossier de données vide, `Welcome` s'affiche
- [ ] Lecture des commits → `cargo test` du crate `git` : la liste lue par `gix` sur la fixture donne les résumés, auteurs et dates attendus, dans l'ordre
- [ ] Persistance → `cargo test` du crate `store` : écriture atomique (pas de fichier temporaire restant), champ `version`, relecture du dernier dépôt, fichier absent ou illisible = aucun dépôt, jamais d'écriture hors `OCTOGIT_DATA_DIR`
- [ ] Décision de lancement → `cargo test` (crate `app` ou module testable sans Tauri) : dépôt mémorisé présent → `History`, absent ou introuvable → `Welcome`
- [ ] Tokens → Vitest : chaque valeur du thème par défaut de `ux/tokens.md` figure dans `tokens.css` sous le nom de token correspondant ; aucune couleur en dur dans les composants de S-1
- [ ] Contrat → `pnpm gen:bindings` est reproductible : relancé, il ne change pas `src/lib/bindings.ts` (vérifié par un script de la commande de qualité ou un test)
- [ ] Composants → Vitest + Testing Library : `History` rend la liste fournie, `Welcome` rend son titre

## Hors périmètre
- Contrôle de Git au lancement et état « Git not found » (S-49).
- Contenu complet de `Welcome` (Recent, Open folder…, Clone…, Profiles, états vide, introuvable, dossier non Git) : S-2, S-27, S-54 et suivantes.
- Graphe en lanes, virtualisation, colonnes, refs, `CommitDetail`, `Toolbar`, `BranchSidebar` : S-4 et suivantes.
- Fetch automatique, `FetchStatus` (S-6) ; `notify` (S-14).
- Dépôt de fixture de 10 000 commits (S-4).
- Thèmes Light/System/palettes/Halo (S-47, S-48), icônes Lucide devant les libellés (S-48).
- Profils, SSH, identité (S-7 et suivantes) ; le crate `identity` reste vide.
- `.dmg`, signature, release (S-3). Workflow CI : géré par l'humain.

## Documentation à mettre à jour
- README : présentation d'Octogit en deux lignes, prérequis (macOS 13+, puces Apple, Rust via `rust-toolchain.toml`, Node et pnpm, binaire `git`), installation (`pnpm install`), lancement (`pnpm tauri dev`, `pnpm dev:web`), commandes de qualité (`pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm gen:bindings`), emplacement des données (`OCTOGIT_DATA_DIR`, `.dev-data/`), organisation du repo (rattrapage : le README actuel ne contient que son titre).
- `.env.example` : `OCTOGIT_DATA_DIR`, `OCTOGIT_PORT`, avec leurs valeurs par défaut commentées (rattrapage : le fichier n'existe pas).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
| # | Agent | Résultat | Verdict |
|---|---|---|---|
