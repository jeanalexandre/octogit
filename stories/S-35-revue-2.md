**Verdict**

**validé**

Le mineur de la revue 1 est levé. Le test e2e `e2e/cherry-pick.spec.ts:109` passe maintenant par le menu contextuel d'`origin/develop`. Il ne s'appuie plus seulement sur `CommitDetail`. Les 11 tests e2e passent.

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm e2e e2e/cherry-pick.spec.ts` | ✅ 11/11 |
| Reste (tests, lint, build, `branch.spec.ts`) | non relancé : le code est inchangé depuis la revue 1 |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| revenir-en-arriere CA-1 | couvert | Inchangé. Le menu d'`origin/…` est maintenant exercé de bout en bout par le test des lignes 109 à 135. |
| revenir-en-arriere CA-2 | couvert | Inchangé. Le test des lignes 109 à 135 prouve les deux chemins : le menu d'`origin/…` et le bouton de `CommitDetail`. |
| revenir-en-arriere CA-3, CA-4, CA-17 | couvert | Inchangé depuis la revue 1. |

Le test fait un clic droit sur `develop` dans la section Origin (`section(page, 1)`), puis clique sur « Cherry-pick ». Il attend ensuite l'alerte `<sha court d'origin/develop> conflicts or brings no changes. Nothing was changed.`, puis contrôle que `HEAD` est inchangé et que `git status --porcelain` est vide.

Ce test échouerait si le menu ne résolvait pas la bonne ref. Une autre ref donnerait un autre SHA dans l'alerte. L'absence de menu ou d'action donnerait aucune alerte. Un cherry-pick réussi à tort ferait bouger `HEAD`. Le SHA attendu est calculé par `git rev-parse --short=7 origin/develop`, indépendamment de l'application.

Je n'ai pas fait de contre-épreuve sur une copie du code. Le rouge n'est pas constaté, mais les assertions ci-dessus suffisent à le justifier.

## Interface
Non refaite, comme demandé.

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : après un Cherry-pick ou un Revert réussi, la sélection reste sur le commit d'origine, et non sur le commit créé. Point déjà signalé en revue 1 ; la spec ne dit rien sur ce point.
- **pour information** : un `git cherry-pick --abort` après un conflit, sur un dépôt avec modifications non commitées, n'est pas testé. S-51 prévoit le refus en amont. Point déjà signalé en revue 1.
