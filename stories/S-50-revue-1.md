# Revue S-50 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:rs -p octogit-app ca_16` (2 tests de `operation_guard.rs`) | ✅ |
| `pnpm test:js` sur `OperationBlocked`, `RefContextMenuOperation`, `CommitDetail`, `History`, `InteractiveRebase` : 175 tests | ✅ |
| `pnpm e2e e2e/operation-guard.spec.ts` : 6 tests | ✅ |
| Captures Playwright (script jetable, serveur arrêté ensuite, aucun processus restant) | ✅ |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| resoudre-les-conflits CA-16 | couvert | `operation_guard.rs` : merge, rebase, cherry-pick et revert laissés en conflit par `git` direct. Les 20 gestes répondent exactement « Operation in progress. », l'instantané (HEAD, refs, statut, index, `origin`) est inchangé, Abort passe, Reset repasse. Vitest `OperationBlocked.test.ts`, `RefContextMenuOperation.test.ts`, `History.test.ts`. e2e `operation-guard.spec.ts`. |
| gerer-les-branches CA-20 | couvert | Vitest `Toolbar`, `History` (double-clic, saisie ouverte fermée à la détection), `RefContextMenu`. e2e : opération lancée puis abandonnée au terminal, gestes désactivés puis réactivés. Réserve : le menu de choix de `CommitDetail` n'a pas de test. |
| integrer-une-branche CA-14 | couvert | `RefContextMenuOperation.test.ts` : merge et rebase affichés, désactivés, avec la raison. e2e : menu en conflit de merge. |
| revenir-en-arriere CA-21 | couvert | Soft, Mixed et Hard désactivés avec la raison (Vitest et e2e), HEAD inchangé, actifs après Abort. Cherry-pick, revert et rebase interactif sans raison affichée. |
| synchroniser CA-21 | couvert | Vitest `SyncButton` et `PushButton`. Rust : `fetch_all`, `pull`, `push` et `force_push` refusés, `origin` bare inchangé. |
| proteger-l-identite CA-16 | couvert | Rust : `start_rebase` refusé avec « Identity does not match profile Work. » puis « No profile. », sans `.git/rebase-*` et avec log, refs et statut inchangés. Vitest : `RefContextMenu` et Start rebase désactivés avec la raison. e2e : menu, Checkout, Branch et Reset restent disponibles, `git log` inchangé. Continue désactivé avec la raison d'identité : déjà livré (S-39), non modifié ici. |
| Décision 1 (liste stricte de CA-16) | couvert | Aucun geste hors liste n'est gardé : fetch automatique, Continue et Abort restent libres. |

Preuve des tests sans rouge constaté :
- Le test Rust compare les messages exacts. Un garde manquant donnerait une autre erreur ou un succès.
- Les Vitest ont chacun un témoin « sans opération » actif et un test « clic sans effet ». Ils échoueraient sans la prop `operationBlocked`.
- L'e2e vérifie `aria-disabled` et la raison. Il fait aussi un clic forcé et contrôle `git rev-parse` avant et après.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `History` · merge en conflit, en-tête (sélecteur, Branch, Stash, Pop, Fetch All, Push avec « Operation in progress. ») · 1500×900 et 1920×1080 | conforme | — |
| `RefContextMenu` branche locale · Checkout, merge, rebase, Rename, Delete local avec la raison ; sous-menu Reset Soft, Mixed, Hard avec la raison · 1500×900 | conforme | — |
| `RefContextMenu` commit · « Create branch here » avec la raison, Cherry-pick et Revert grisés sans raison · 1500×900 | conforme | — |
| `CommitDetail` · opération en cours · 1500×900 et 1920×1080 | écart | 1 |
| Non conforme · menu commit : Cherry-pick et Revert avec « Identity does not match profile Work. », « Create branch here » actif · 1500×900 | conforme | — |
| Cherry-pick, rebase, conflit de Pop, `OperationBanner` sous identité non conforme, `InteractiveRebase` : non capturés | non vérifié | — |

Seul le merge en conflit a été capturé. Le conflit de Pop, `InteractiveRebase` et le Continue sous identité non conforme n'ont pas été capturés. Les tests Vitest les couvrent, ou le code est inchangé (Continue).

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/CommitDetail.svelte:377-393` (`.action`), boutons l. 208-265 | Pendant une opération, Checkout, « Create branch here », Cherry-pick et Revert sont bien `disabled`. La capture (`op-detail-1920.png`) les montre pourtant identiques à des boutons actifs : `.action` fixe `color: var(--ink)` et `cursor: pointer`, et aucune règle `:disabled` n'existe. `ux/ecrans/history.md` ligne 23 demande « désactivés ». Même défaut pour Cherry-pick et Revert désactivés par l'identité, dont la raison n'est qu'en infobulle. Sans style, un geste inactif ne se distingue pas d'un actif. | Ajouter `.action:disabled` (par tokens : texte atténué, `cursor: not-allowed`, pas de survol) pour que l'état se voie sans la couleur seule. Garder la raison en `title`. Ajouter un test ou une assertion e2e qui contrôle le style ou la raison visible. |
| 2 | mineur | `src/lib/components/CommitDetail.svelte:238-245` | Le bouton Checkout n'est désactivé que par `operationBlocked`. Le menu de choix de branche déjà ouvert se referme (`$effect`), ce qui est correct, mais aucun test ne couvre ce cas dans `CommitDetail`. | Ajouter le test (menu ouvert, puis `operationBlocked` passe à vrai : aucun `oncheckout`). |

## Pour l'humain
RAS
