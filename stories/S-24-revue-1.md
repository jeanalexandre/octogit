## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (premier passage : « 20 FAIL » dans la partie vitest) | ✅ au second passage (Rust et vitest). `pnpm test:js` isolé : 281/281 |
| `pnpm e2e` | ✅ 195/195 |
| `pnpm audit:deps` | ✅ aucune vulnérabilité (3 avertissements autorisés, préexistants) |
| `pnpm tauri build` | non lancé (long, aucun changement de config de build) |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| synchroniser CA-16 | couvert | `crates/git/src/force_push.rs` : 4 tests (amend, squash/rebase/reset, aucune réécriture, commit distant jamais vu) ; `PushButton.test.ts` ; `ForcePushDialog.test.ts` ; `e2e/force-push.spec.ts` (squash aux 2 tailles, amend, rebase, reset, distant avancé sans réécriture) |
| synchroniser CA-17 | couvert | `force_push.rs:406` (bare = commit local, 0 / 0, HEAD et arbre inchangés) ; tests Cancel et Échap du dialogue ; e2e Force push et Cancel/Échap |
| synchroniser CA-18 | couvert | `force_push.rs:424` et `:450` (refus du bail, fetch intermédiaire sans effet sur le bail) ; test d'état refusé du dialogue ; e2e refusé avec Details et Close seul |

Les 8 tests Rust, les 10 e2e et les 2 tests `PushButton` sans rouge probant : chacun prouve son critère.
- Les tests Rust comparent le SHA du bare avant et après.
- Les e2e vérifient le bare et les boutons du dialogue.
- Le test `PushButton` « identité prioritaire » échouerait si `force` n'était pas conditionné par l'identité.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · `PushButton` « Force push » après squash, amend, rebase, reset · 1500×900 et 1920×1080 | conforme (bordure pointillée 2 px, libellé) | — |
| History · distant avancé sans réécriture, « Push 2 » · 1500×900 et 1920×1080 | conforme | — |
| History · `ForcePushDialog` ouvert (titre, « 2 commits … », liste SHA + résumé, ligne « Protected », Cancel / Force push) · 1500×900 | contenu conforme ; rendu du dialogue en écart | 1 |
| History · `ForcePushDialog` ouvert · 1920×1080 | contenu conforme | 1 |
| History · après Force push, 0 / 0, `PushButton` désactivé « Nothing to push. » · 1500×900 et 1920×1080 | conforme | — |
| History · `ForcePushDialog` refusé (message, « Fetch, then decide again. », Details déplié, Close seul) · 1500×900 et 1920×1080 | contenu conforme ; rendu en écart | 1 |
| History · Cancel et Échap, bare inchangé | conforme (e2e) | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/ForcePushDialog.svelte:121` (`.backdrop`) | Capture 1500×900 de l'état ouvert, `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/ea080d9a-f7e9-49a8-b4b7-da7c5e1de87f/scratchpad/1500-2-dialog.png` : les colonnes Author et Date du graphe sont peintes par-dessus le dialogue. « Bob Durand » et « 2 years ago » recouvrent la ligne « Protected… » et le bouton Cancel. Même chose dans l'état refusé (`1500-5-details.png`). Cause : `CommitGraph.svelte` utilise des `z-index` de 1 à 4 (lignes 575, 608, 797, 828, 844) et `.backdrop` n'en a pas. Le fond du dialogue ne masque donc rien. | Un `z-index` sur `.backdrop` supérieur à ceux du graphe, pour que le dialogue soit lisible et que ses boutons ne soient pas recouverts. Ajouter un test ou une vérification e2e qui prouve que le dialogue est au premier plan (par exemple `elementFromPoint` sur Cancel). |
| 2 | bloquant | `src-tauri/src/fetch.rs` (`force_push_repository`) et `src-tauri/src/commands.rs` (`force_push_repository`) | La commande ne reçoit pas `Store`. Elle n'appelle ni `ensure_pushable` ni `ensure_conform`, contrairement à `push_repository` (`fetch.rs:45`). Un dépôt non conforme ou « No profile », ou un commit fautif, peut donc être force-pushé tant que le dialogue est ouvert, ou par appel direct de la commande. `specs/proteger-l-identite.md` CA-19 : « aucun push ni Force push n'est possible », et le garde est refait côté Rust sans se fier à l'interface. La fiche S-21 demandait : « Le Force push de S-24 devra utiliser ce même garde ». Le « hors périmètre » de S-24 ne concerne que l'état bloqué de l'interface. | Appeler `ensure_pushable(store, path, home)` en tête de `force_push_repository`, avant tout `git push`, avec le même refus qu'à S-21. Ajouter un test Rust : écart d'identité ou « No profile » donne un refus, aucun sous-processus `git push`, bare inchangé. Mettre à jour la ligne du README sur le garde Rust. |

## Pour l'humain
- **à décider** : `IdentityMismatch` utilise le même `.backdrop` sans `z-index` (`IdentityMismatch.svelte:123`) et a probablement le même défaut de superposition au-dessus du graphe. Je ne l'ai pas capturé. Une correction commune (un `z-index` sur les dialogues) serait plus propre qu'un correctif propre à `ForcePushDialog`.
- **pour information** : au premier `pnpm test` complet, vitest a signalé « 20 FAIL », puis tout est passé aux deux relances. Je n'ai pas isolé la cause (le fichier `livraison.test.ts` est un instable connu).
