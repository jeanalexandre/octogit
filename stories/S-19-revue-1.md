**Verdict**

**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` | ⚠️ Le Rust passe. Dans la sortie raccourcie de cette exécution, le résumé de vitest affichait « 14 FAIL ». Je n'ai pas relu le détail, et `pnpm test:js` relancé seul donne 24 fichiers et 237 tests verts. |
| `pnpm test:js` (relance) | ✅ |
| `pnpm e2e e2e/pull.spec.ts` | ✅ 6 tests |
| `pnpm tauri build` | ✅ (`svelte-check` : 0 erreur, 2 avertissements dans `CommitGraph.svelte`, hors story) |
| `pnpm audit:deps` | non relancé, aucune dépendance ajoutée |

- **Échecs vitest du premier `pnpm test`.** Je n'ai pas identifié les tests en cause. Le mode d'échec connu (`livraison.test.ts`, hdiutil) est cohérent avec cette exécution, mais je ne l'ai pas vérifié. La relance ciblée est verte et l'échec n'a pas reparu.
- **`pnpm audit:deps`.** Non relancé, mais `Cargo.toml`, `package.json` et les lockfiles ne figurent pas dans le diff.

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| synchroniser CA-4 | couvert | `crates/git/src/pull.rs:205`. Avant : 0 / 3. Après : la branche pointe sur `origin/develop` et l'indicateur est à 0 / 0. `e2e/pull.spec.ts:31` (2 tailles) vérifie « 3 behind » avant et « 0 behind » après, plus l'égalité des refs. |
| synchroniser CA-5 | couvert | `pull.rs:220` : message exact et état inchangé (refs locales, HEAD, index, statut, fichier). Composant : `SyncButton.test.ts` « CA-5: refusal is shown ». `e2e/pull.spec.ts:55` : l'alerte porte le texte exact, branche et arbre inchangés. |
| synchroniser CA-6 | couvert | `pull.rs:240` : 2 / 0, `develop~2` égal à l'amont, ordre des commits, aucun commit à deux parents. `e2e/pull.spec.ts:76`. |
| synchroniser CA-7 | couvert | `pull.rs:270` : Fetch All, Pull rebase et Pull ff-only avec `pull.rebase=false`, `pull.ff=false`, `merge.ff=false`, plus `pull.rebase=true` qui ne change pas le ff-only. Le test échouerait si les options en ligne de commande étaient retirées. |
| synchroniser CA-10 | couvert | `pull.rs:305` (refus sans écriture), `SyncButton.test.ts` (désactivé avec raison en `title` et en description accessible, Fetch All actif, entrées Pull cochables), `e2e/pull.spec.ts:117`. |

### Jugement des tests sans rouge probant
- **Les 5 e2e de `e2e/pull.spec.ts`** (les 6 cas, CA-4 étant lancé à 2 tailles) prouvent leur critère. Chacun asserte un état d'avant (« 3 commits behind », « 2 ahead ») qui doit changer, ou un message exact qui n'existe que si le code agit. Aucun ne dépend d'un état préexistant de l'environnement. Le rouge n'a pas été constaté, mais l'échec sans l'implémentation découle des assertions. Seule faiblesse, dans le test CA-10 : le texte final « fetched just now » est peut-être déjà affiché par le fetch d'ouverture, donc ce clic sur Fetch All ne prouve pas à lui seul son effet. Le critère « Fetch All reste actif » tient par `aria-disabled="false"` (problème 3).
- **« CA-5 no message is shown without a refusal »** est un garde-fou négatif. Il passait avant le composant et ne prouve pas CA-5. CA-5 est porté par le test positif voisin et par l'e2e, donc non bloquant.
- **« CA-10 Fetch All stays active… »** passait avant le composant, mais il échouerait si le composant désactivait aussi Fetch All sur une branche non publiée. Cela vérifie bien la partie « Fetch All reste actif » du critère. Il est valide comme garde de non-régression.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · Pull ff-only par défaut, retard de 3, avant puis après · 1500×900 et 1920×1080 | conforme (0 / 0 après le Pull) | — |
| History · refus de divergence · 1920×1080 | conforme | — |
| History · refus de divergence · 1500×900 | texte exact et icône d'alerte à côté du bouton, mais le libellé « Pull (fast-forward only) » passe sur 2 lignes et le chemin du dépôt aussi | 2 |
| History · Pull rebase, 2 / 3 → 2 / 0, historique linéaire · 1500×900 et 1920×1080 | conforme (0 / 0 non applicable, indicateur « 2↑ 0↓ ») | — |
| History · branche « Not published », Pull désactivé · 1500×900 et 1920×1080 | conforme : bouton grisé, raison en infobulle et en description accessible, menu avec Fetch All et les Pull cochables | — |
| History · en cours pendant un Pull · les 2 tailles | vérifié par le test de composant (« Pulling… », `aria-busy`). Pas de capture : le Pull sur dépôt local est trop rapide pour être figé. | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `README.md` (ligne ajoutée sur Pull rebase) | Le message cité est « Pull stopped on conflict, rebase aborted. », alors que le code (`crates/git/src/pull.rs:51`) et l'e2e produisent « Pull stopped on a conflict, rebase aborted. ». | Aligner la doc sur le message réel. |
| 2 | mineur | `src/lib/components/SyncButton.svelte` (`.notice`, `white-space: nowrap`) | À 1500×900, avec le refus affiché, le bouton se replie sur 2 lignes. Rien ne déborde, mais le rendu est tassé. | Que le bouton garde une ligne (par exemple `white-space: nowrap` sur le bouton, ou un message qui peut raccourcir). La maquette met le message sur sa propre ligne, ni `ux.md` ni la maquette n'imposent ici la mise en page, d'où mineur. |
| 3 | mineur | `e2e/pull.spec.ts:146-147` | Le clic sur Fetch All est suivi de l'assertion `fetched just now`, déjà vraie après le fetch d'ouverture. Le test ne prouve pas que le clic agit. | Optionnel : assertion qui change au clic. |

## Pour l'humain
- **pour information** : sur une branche en HEAD détaché ou pendant un rebase en cours, le Pull répond « Branch not published. » (il n'y a pas de branche courante), et il n'abandonne pas le rebase de l'utilisateur. J'ai vérifié par une preuve jetable : rebase en conflit lancé à la main, puis `pull_repository` lancé sur le pont de test. Le rebase est resté en place. Le message est trompeur dans ce cas, mais S-50 désactive les boutons pendant un rebase.
- **pour information** : sur une branche sans suivi (« Not published »), l'en-tête ne montre aucun indicateur d'avance / retard. La capture à 1500×900 le montre. L'écart préexiste à la story et relève de l'indicateur d'avance / retard.
