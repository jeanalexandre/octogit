# Revue S-22 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (Rust) | ✅ tous les crates verts, dont `push_commits.rs` (5) |
| `pnpm test` (Vitest) | ⚠️ le premier passage affichait « 18 FAIL » dans la sortie tronquée. Relancé seul avec `pnpm test:js` : 26 fichiers, 265 tests verts. Le premier passage était sans doute l'instabilité de `src/livraison.test.ts` signalée dans `CLAUDE.local.md`. |
| `pnpm e2e` (`push-commits`, `push`, `identity-push`) | ❌ 18 verts, 1 rouge : CA-26 (`e2e/push-commits.spec.ts:143`), rouge aussi à la relance |
| `pnpm tauri build`, `pnpm audit:deps` | non relancés : un bloquant est déjà ouvert |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| proteger-l-identite CA-20 | couvert | `crates/identity/src/commit_check.rs` et `crates/identity/tests/commit_check.rs`. `crates/git/tests/unpushed.rs`. `src-tauri/tests/push_commits.rs` : refus, distant inchangé. `PushButton.test.ts` et `History.test.ts`. e2e `push-commits.spec.ts:34` et `:70`, verts aux deux tailles pour l'auteur, une taille pour le committer. |
| proteger-l-identite CA-22 | couvert | `crates/git/tests/unpushed.rs`, `src-tauri/tests/push_commits.rs`, e2e `push-commits.spec.ts:94` et `:115` verts. |
| proteger-l-identite CA-23 | couvert | `CommitNode.test.ts` : l'assertion porte sur le champ, pas sur la couleur. `History.test.ts` : marque sur le seul nœud fautif, pas sur le collègue ni sur le commit déjà poussé. e2e `push-commits.spec.ts:34` et `:70`. |
| proteger-l-identite CA-26 | partiel | Le test Rust de relecture à chaque appel passe. L'e2e `push-commits.spec.ts:143` échoue (problème 1). |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · `PushButton` bloqué, auteur fautif · 1500×900 | écart : contenu et marques conformes, mais la liste flottante chevauche le panneau de droite | 2 |
| History · `PushButton` bloqué, auteur fautif · 1920×1080 | écart : même chevauchement | 2 |
| History · committer fautif · 1500×900 et 1920×1080 | écart : même chevauchement. Message « committed as Jag Perso <jag@perso.fr>. Profile Work expects Jag Work <jag@work.fr>. » conforme. | 2 |
| History · commit de collègue, committer conforme · 1500×900 et 1920×1080 | conforme : « Push 1 » actif, aucune liste, aucune marque | — |
| History · `origin/develop` fusionnée · 1500×900 et 1920×1080 | conforme par e2e (`push-commits.spec.ts:115`), non capturé | — |
| History · commit fait au terminal · 1500×900 et 1920×1080 | écart : e2e rouge | 1 |
| Nœud fautif du `CommitGraph` | conforme : « ✕ » au coin du nœud, « ✕ author » ou « ✕ committer » devant le résumé, lisible sans la couleur ; les autres nœuds sans marque | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `e2e/push-commits.spec.ts:166` ; `src/App.svelte:181-200` | Après un `git -c user.email=jag@perso.fr commit` au terminal, l'événement `focus` ne relit que l'identité et le classement. Le compteur d'avance reste à 0 : le bouton affiche « Push », jamais « Push 1 », et l'e2e attend `"Push 1"`. Il est rouge de façon reproductible (2 passages). CA-26 n'est donc pas prouvé de bout en bout. | Au retour dans Octogit, rafraîchir aussi `ahead` (le dépôt), de sorte que « Push 1 » désactivé apparaisse avec la raison du CA-20 et que l'e2e passe. Si le pont de test n'émet pas l'événement de la surveillance, faire relire le dépôt sur `focus`. Ne pas affaiblir l'assertion. |
| 2 | bloquant | `src/lib/components/PushButton.svelte:109-124` (`.commits`, `position: absolute`) | La liste des commits (z-index 5) est un popup posé sous le bouton. Elle recouvre le titre « Working changes », le texte « Working tree clean. » du panneau de droite et le bord droit de la ligne WIP, aux deux tailles (captures `author-1500.png` et `committer-1920.png` du scratchpad). La maquette `history.html` (section « Push blocked ») pose la liste à la suite du message, pas par-dessus d'autres blocs. Cela viole « rien ne déborde ni ne se chevauche ». | Placer la liste dans le flux de l'en-tête, ou dans une zone qui ne recouvre ni `WorkingChanges` ni le graphe, comme la maquette. Elle doit rester visible et lisible aux deux tailles. |

## Pour l'humain
- **pour information** : `pnpm tauri build` et `pnpm audit:deps` n'ont pas été relancés dans ce passage, à cause des bloquants ci-dessus. Ils sont à relancer au passage 2.
