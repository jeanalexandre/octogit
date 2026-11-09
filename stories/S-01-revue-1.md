# Revue S-1 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` (clippy `-D warnings` puis ESLint) | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo : git 4, store 5, app 5 ; Vitest 4 fichiers, 7 tests) | ✅ (`src/lib/bindings.ts` inchangé après coup) |
| `pnpm e2e` (5 scénarios) | ✅ |
| `pnpm audit:deps` | ✅ (1 avis ignoré, celui de la fiche ; 3 avertissements `cargo audit` permis) |
| `pnpm tauri build` (avec `pnpm check`) | ✅ (`Octogit.app` produit, signature ad hoc) |
| Preuve du rouge des e2e, hors dépôt : copie de l'interface et de `e2e/` dans le scratchpad, pont remplacé par 3 mutants | voir ci-dessous |

Preuve du rouge, pour les tests lents signalés par `/story` :
- Mutant « toujours `Welcome` » : les 3 scénarios « dépôt présent » échouent.
- Mutant « `History` dès qu'un dépôt est mémorisé, même absent » : « dépôt introuvable » échoue.
- Mutant « `History` au lieu de `Welcome` » : « introuvable » et « premier lancement » échouent.

Chaque test e2e de CA-1 échoue donc quand son critère n'est pas tenu. Ils prouvent leur critère.

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-1 (dépôt présent → `History` sans geste) | couvert | `e2e/launch.spec.ts:18` (3 tailles) ; `src-tauri/src/launch.rs:109` ; `crates/git/src/lib.rs:98` ; rouge prouvé par mutant |
| explorer-l-historique CA-1 (dépôt introuvable → `Welcome`) | couvert | `e2e/launch.spec.ts:38` ; `src-tauri/src/launch.rs:146`, `:157` ; rouge prouvé par mutant |
| explorer-l-historique CA-1 (premier lancement → `Welcome`) | couvert | `e2e/launch.spec.ts:50` ; `src-tauri/src/launch.rs:168` ; rouge prouvé par mutant |
| Test demandé : contrat `pnpm gen:bindings` reproductible | partiel | `src/lib/bindings.test.ts:9-12` : voir problème 1 |
| Tests demandés : persistance, lecture des commits, tokens, composants | couverts | `crates/store/src/lib.rs:101-163`, `crates/git/src/lib.rs:97-137`, `src/lib/styles/tokens.test.ts`, `src/lib/screens/*.test.ts` |

## Interface
Captures dans `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/39c411b0-1995-4b72-88b9-ae7c5af71a69/scratchpad/shots/`, en sombre et en clair.

| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · liste de commits · 1500×900 | écart | 3 |
| History · liste de commits · 1920×1080 | écart | 3 |
| History · liste de commits · 1280×720 | écart | 3 |
| History · vide (dépôt sans commit) · 1500×900 | écart | 3, 4 |
| History · vide (dépôt sans commit) · 1920×1080 | écart | 3, 4 |
| History · vide (dépôt sans commit) · 1280×720 | écart | 3, 4 |
| Welcome · aucun dépôt mémorisé · 1500×900 | conforme (titre seul, périmètre S-1) | — |
| Welcome · aucun dépôt mémorisé · 1920×1080 | conforme | — |
| Welcome · aucun dépôt mémorisé · 1280×720 | conforme | — |
| Welcome · dépôt mémorisé introuvable · 1500×900 | conforme (état « Repository not found » en S-54) | — |
| Welcome · dépôt mémorisé introuvable · 1920×1080 | conforme | — |
| Welcome · dépôt mémorisé introuvable · 1280×720 | conforme | — |

Points vérifiés sans écart :
- Ordre des colonnes : résumé, auteur, date, comme la maquette.
- Rien ne déborde ni ne se chevauche (`scrollWidth` = `clientWidth`).
- Texte ≥ 12 px.
- Contraste AA de `muted` et `ink` dans les deux thèmes.
- Ton impersonnel.
- Aucune couleur brute hors `tokens.css`.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/bindings.test.ts:9-12` | Le test lance `pnpm gen:bindings` avant de lire le fichier, puis compare la 1re et la 2e génération. Si le `bindings.ts` versionné est périmé (contrat Rust changé sans régénérer), le test le réécrit en silence et passe. Il passerait donc sans que le critère « relancé, il ne change pas `src/lib/bindings.ts` » soit tenu. | Lire `bindings.ts` **avant** toute génération. Ensuite, vérifier que le contenu est identique après chaque lancement de `pnpm gen:bindings`. |
| 2 | bloquant | `.env.example:1`, `README.md:39` | `.env.example` dit « Copier en .env pour changer une valeur », et le README y renvoie. Or rien ne lit `.env` : ni le crate `app` (`src-tauri/src/lib.rs:13-24`), ni `vite.config.ts`, ni le script `dev:web` (`package.json:13`). Qui suit la doc pour régler `OCTOGIT_DATA_DIR` ou `OCTOGIT_PORT` échoue en silence : les données vont dans `.dev-data/`, le port reste 1420. | Soit documenter que ces variables se passent dans l'environnement du shell (`OCTOGIT_PORT=1421 OCTOGIT_DATA_DIR=… pnpm dev:web`) et retirer la consigne de copie en `.env`. Soit charger réellement `.env`, mais cela ajoute une dépendance non prévue, à soumettre. |
| 3 | bloquant | `src/app.css:8`, `src/lib/screens/History.svelte:16`, `:63-66`, `:80` | La typographie ne suit pas `ux.md` « Direction visuelle ». Le chemin du dépôt est en police proportionnelle, au lieu de SF Mono 12 px. Les résumés de commit sont à 13 px, au lieu de 14 px pour les messages de commit. La base n'est pas fixée à 13 px : « No commits yet. » sort à 16 px. | Poser SF Pro 13 px sur la racine (`app.css`). Mettre `.summary` à 14 px. Mettre `.path` en SF Mono 12 px (pile `ui-monospace, "SF Mono", monospace`). |
| 4 | mineur | `src/lib/screens/History.svelte:20` | `ux/ecrans/history.md` décrit l'état vide comme « seule la ligne WIP », sans message. Le texte « No commits yet. » n'y figure pas. La ligne WIP est hors périmètre (S-4 et suivantes). | Garder une trace : la ligne WIP remplacera ce texte en S-4. Ou retirer le texte si S-4 ne doit pas l'hériter. |
| 5 | mineur | `src-tauri/tauri.conf.json:7-8`, `package.json:12` | `pnpm tauri dev` sert toujours sur 1420 (`devUrl` et `pnpm dev` fixés). `OCTOGIT_PORT` n'agit que sur `pnpm dev:web`, alors que `stack.md` en fait l'isolement des worktrees. Deux `pnpm tauri dev` en parallèle se bloquent. | Faire suivre `OCTOGIT_PORT` à `pnpm dev`, ou documenter que l'isolement par port ne vaut que pour `pnpm dev:web`. |
| 6 | mineur | `.env.example:5` | `.env.example` donne `OCTOGIT_DATA_DIR=.dev-data` comme défaut. Ce chemin relatif se résout selon le dossier courant du processus. Le vrai défaut est `<repo>/.dev-data` (`src-tauri/src/lib.rs:18`). | Indiquer le défaut réel (`.dev-data/` à la racine du repo). Préciser qu'une valeur explicite gagne à être absolue. |
| 7 | mineur | `fixtures/conflict.sh:9`, `:12` | Les commits « Other side » et « Main side » fixent `--date` (auteur) mais pas la date du committer. Leurs SHA changent donc à chaque exécution, alors que `fixtures/lib.sh:2` promet des dépôts déterministes. | Passer par `commit` de `lib.sh`, ou poser `GIT_COMMITTER_DATE` (et le nom et l'adresse du committer). |

## Pour l'humain
- **à décider** : la fenêtre Tauri tourne sans politique de sécurité de contenu (`csp` à `null`). Ce n'est pas exploitable aujourd'hui : Svelte échappe les textes affichés. Mais Octogit affichera bientôt des contenus venus des dépôts (messages, diffs, noms de branches). Une CSP stricte serait à fixer avant ces stories.
- **à décider** : le pont de `pnpm dev:web` exécute toute commande du crate `app` sur un simple POST vers `localhost`. Il accepte aussi un dossier de données arbitraire par en-tête. Il ne sert aujourd'hui qu'une lecture. Quand des commandes d'écriture (commit, push, suppression) y passeront, une page web ouverte dans le même navigateur pendant le développement pourrait les déclencher. Une protection (jeton par session, contrôle de l'origine) serait à prévoir avant.
- **pour information** : la fiche dit l'exception d'audit GHSA-gcqx-w48m-w2h4 consignée dans `notes-production.md`. Ce fichier n'existe pas dans le dépôt.
