# Revue S-57 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo : 17 + 27 + 4 + 22 + 1 ; vitest : 114) | ✅ |
| `pnpm e2e` | ❌ 49 sur 50. Échec : `e2e/graph.spec.ts:210` CA-23 (10 000 commits), ouverture 4122 ms puis 5491 ms au second essai, seuil 3000 ms |
| `pnpm e2e -g CA-23` sur le code de base (9165773, extrait par `git archive` dans le scratchpad) | ✅ passe, donc régression de la story |
| `pnpm audit:deps` | ✅ (3 avertissements de crates non maintenues, 1 avis déjà ignoré) |
| `pnpm tauri build` | ✅ (2 avertissements a11y préexistants dans `CommitGraph.svelte`) |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| organiser-l-espace CA-1 | couvert | `src/lib/sidebarTree.test.ts` (ordre des sections, branches, tags et stashes du plus récent au plus ancien, à date égale par nom ou par rang) ; `e2e/sidebar.spec.ts:38` aux 3 tailles |
| organiser-l-espace CA-2 | couvert | `src/lib/sidebarTree.test.ts:93-211` ; `e2e/sidebar.spec.ts:81` (« feat · 3 », « ui · 1 », `main`, remotes groupés, stashes non groupés) |
| organiser-l-espace CA-3 | couvert | `crates/store/src/lib.rs` : `collapsed_folders_are_kept_per_repository_across_a_new_store`, tests v2 et v3 ; `e2e/sidebar.spec.ts:107` (clic, rechargement, autre dépôt indépendant, lecture de `repositories.json`) |

Jugement des tests sans rouge constaté.
- **CA-1 et CA-2 (e2e) : ils prouvent le critère.**
  - Ils comparent des listes ordonnées exactes.
  - La fixture sépare les dates : v0.9.0 est le tag le plus récent, ce qui exclut les ordres alphabétique et inversé ; `feat/graph` est plus récent que `feat/api`.
  - Un tri alphabétique ou aucun tri ferait échouer ces assertions.
- **CA-3 (e2e) : il prouve le critère.**
  - Il vérifie `aria-expanded`, la disparition des noms, le fichier écrit et l'indépendance des dépôts.
  - Un état non mémorisé échouerait au rechargement.
- **Vitest « trie les dossiers de Local sans casse, pas par date… » : il prouve le critère.**
  - Les dossiers `alpha` et `Zed` sont placés par nom, avant `beta` et `Main`, alors que leurs dates iraient en sens contraire.
  - Un tri par date ou sensible à la casse ferait échouer les assertions.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · BranchSidebar (dossiers dépliés et repliés, courante, remotes, Tags, Stashes) · 1500×900, 1920×1080, 1280×720 | non vérifié par capture | 2 |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/BranchSidebar.svelte:23`, `src/lib/sidebarTree.ts:102`, `src/lib/screens/History.svelte` (`commits={repository.commits}`) | Régression du test existant `e2e/graph.spec.ts:210` (CA-23, 10 000 commits). L'ouverture prend 4,1 s puis 5,5 s pour un seuil de 3 s. Le même test passe sur le code de base. La story passe les 10 000 commits (objets d'un `$state` profond, lus via proxy) à `BranchSidebar`, qui en fait une `Map` à chaque dérivation. | Retrouver une ouverture sous 3 s sans affaiblir le test. Par exemple, ne transmettre que les timestamps nécessaires, ou une map `id → timestamp` calculée une seule fois en dehors de la réactivité profonde (`$state.raw` / `$derived`), et ne relire que les cibles des refs. Relancer `pnpm e2e` en entier. |
| 2 | mineur | Interface | Les captures aux 3 tailles n'ont pas été prises : l'agent n'a pas pu écrire le script Playwright jetable ni les fichiers de données hors du dépôt, faute d'outil d'écriture. La conformité à `ux.md` et à la maquette n'est donc pas constatée à l'écran. Lu dans le code : chevron Lucide, bouton avec `aria-expanded`, focus visible (`--focus`), couleurs par tokens, aucune couleur brute ajoutée, textes sans ton problématique. Les tests e2e aux 3 tailles passent. | Refaire le contrôle visuel (dossiers repliés et dépliés, débordement à 1280×720, indentation à 3 niveaux) au passage 2, par un agent qui peut écrire hors du dépôt. |

Périmètre vérifié : `.gitignore` et `.prettierignore` (`.vitest/`, décision 1), `repositories.json` version 3 avec migrations v1 et v2 et exemples versionnés, README mis à jour (ordre, dossiers, état mémorisé, version 3, fixture). Rien hors story, aucune dépendance ajoutée, aucun `ux.md`, `ux/` ou `stack.md` modifié, `bindings.ts` cohérent avec les commandes ajoutées.

## Pour l'humain
- **pour information** : la lecture et l'écriture de l'état des dossiers sont faites par lecture-modification-écriture du fichier entier, comme les autres préférences. Deux clics très rapprochés pourraient en théorie se perdre l'un l'autre ; le risque est faible, un échec d'écriture étant déjà accepté.
- **pour information** : les captures aux 3 tailles manquent (voir problème 2) : le verdict interface est à compléter au passage 2.
- **pour information** : processus `vite` lancé pour tenter les captures, coupé après usage. Un répertoire jetable existe dans le scratchpad (`/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/6780874c-f23a-4997-9ee3-a7c3c73f4b08/scratchpad/`, copie du code de base), hors dépôt.
