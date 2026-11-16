# Revue S-21 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test:js` (Vitest, 26 fichiers, 256 tests) | ✅ |
| `pnpm test` / `pnpm test:rs --workspace` | Rust ✅ (dont les 7 tests de `identity_block.rs`). Dans ces deux sorties filtrées, rtk signale « 15 FAIL » dans un bloc omis que je n'ai pas ouvert. Le même Vitest, relancé seul, passe à 256/256. Je n'ai pas identifié l'origine de ce « 15 FAIL » ; il n'a pas reparu. |
| `pnpm e2e` (176 tests, dont les 5 de `identity-push.spec.ts`) | ✅ |
| `pnpm check` (build des types) | ✅ 0 erreur (2 avertissements a11y préexistants dans `CommitGraph.svelte`) |
| `pnpm audit:deps`, `pnpm tauri build` | non relancés : aucune dépendance modifiée |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| proteger-l-identite CA-7 | couvert | `e2e/identity-push.spec.ts:41` : `.git/config` identique octet pour octet après Cancel puis Échap, badge non conforme, Commit et Push bloqués, `IdentityMismatch` revient à la réouverture. |
| proteger-l-identite CA-13 | couvert | `src-tauri/tests/identity_block.rs:122,145,158` (refus « No profile. », profil supprimé, `.git/config` non écrit, `git log` inchangé). Composants : `WorkingChanges.test.ts`, `PushButton.test.ts`, `History.test.ts`. e2e : `identity-push.spec.ts:116`. |
| proteger-l-identite CA-19 (Push) | couvert | `identity_block.rs:175,200,224` (un hook `pre-push` témoin prouve qu'aucun `git push` n'est lancé ; branche distante au même SHA ; publication d'une branche « Not published » refusée aussi ; après « Fix », le push passe). e2e `identity-push.spec.ts:41,89`. |
| proteger-l-identite CA-27 | couvert | Le garde `ensure_conform` est appelé par `push_repository` (`fetch.rs:44`) et par `commit_checked` (`working_tree.rs:109`). Je n'ai trouvé aucun autre appel à `octogit_git::push` ou `commit` dans l'app, ni dans le pont de test. Test d'appel direct : `identity_block.rs:244`. e2e : Cmd+Entrée, Amend et clic forcé sans effet. |
| Report de S-11 (phrase de `IdentityMismatch`) | couvert | `IdentityMismatch.test.ts`, `IdentityMismatch.svelte:105`, et e2e. |

Jugement des tests sans rouge constaté :
- **7 tests Rust.** Chacun fait des assertions sur le résultat (`Err("No profile.")`, `Err("Identity does not match…")`), sur le SHA de la branche distante, sur `git log`, et sur l'absence du fichier témoin du hook. Sans le garde, `push_repository` pousserait : le SHA changerait et le témoin existerait. Ils prouvent leur critère. Le rouge « erreur de compilation de signature » ne gêne pas, car les assertions sont probantes.
- **2 tests `History`.** Le test « profil absent » échouerait si `History` ne passait pas `noProfile={!repository.profile}`. Le test « écart » échouerait si `blocked` n'était pas transmis à `PushButton`. Ils vérifient `aria-disabled`, la description accessible et l'absence d'appel à `onpush`. Les tests existants ont reçu un `profile: attached` pour ne pas être bloqués : on rattache un profil, on n'assouplit pas le garde.
- **3 e2e.** Ils vérifient les octets de `.git/config`, `git log` et le HEAD du bare avant et après. Un clic forcé sur le bouton `aria-disabled` reste sans effet. Ils échoueraient si le blocage manquait.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · `PushButton` bloqué par écart (« Identity does not match profile Work. », sans compteur, sans « Force push ») · 1500×900 | conforme | — |
| History · `PushButton` « No profile. » et Commit « No profile » · 1920×1080 | conforme | — |
| History · Commit désactivé, bloc `WorkingChanges` bloqué avec « Fix repository identity » · 1500×900 | conforme | — |
| `IdentityMismatch` avec la phrase « Until a choice is made, Commit and Push stay blocked. » sous le tableau, avant les boutons · 1500×900 | conforme | — |
| Après Cancel : badge « ⚠ Work · identity mismatch », Commit et Push bloqués · 1500×900 | conforme | — |
| Après « Fix repository identity » : Push de nouveau disponible | conforme (preuve : e2e `identity-push.spec.ts:89`) | — |

Je n'ai pas rendu à nouveau l'état « Push de nouveau disponible », ni les tailles 1920×1080 des états « écart » et « dialogue » : seuls 1500×900 pour l'écart et 1920×1080 pour « No profile » ont été ouverts. Les e2e passent aux deux tailles.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun bloquant, aucun mineur. | — |

## Pour l'humain
- **pour information** : sur la capture de `IdentityMismatch` à 1500×900, les lignes du graphe restent lisibles à travers le dialogue, et le texte chevauche « Bob Durand · 2 years ago ». Je n'ai pas vérifié si c'est le fond du dialogue qui est transparent ou un artefact de capture. La story n'a ajouté qu'un paragraphe, donc cela préexiste très probablement. À regarder dans l'application réelle.
- **pour information** : `pnpm dev:web` sans données d'exemple affiche les dépôts récents d'un dossier de données local déjà existant (un dépôt réel, `model-information-manager-…`), pas le jeu d'exemple que la fiche annonce. Pour les captures, j'ai fabriqué mes dépôts avec les fixtures et le dossier de données jetable des e2e. Je n'ai rien modifié dans ce dépôt réel ; seul un clic sur la ligne WIP a été fait.
