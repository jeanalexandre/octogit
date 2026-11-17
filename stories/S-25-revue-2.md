# Revue S-25 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` | ✅ cargo vert (`checkout.rs` : 8 tests). Vitest : 29 fichiers, 303 tests. |
| `pnpm test:js` (relancé seul) | ⚠️ 1 échec, `src/livraison.test.ts` (hdiutil, 612 s). Test instable connu, préexistant, non touché par la story. 302 autres verts ; le `pnpm test` complet l'a passé. |
| `pnpm e2e` | ✅ 212 passés au dernier lancement. Premier lancement : `badge-menu.spec.ts:178` (CA-11) a échoué, voir « Pour l'humain ». |
| `pnpm audit:deps` | ✅ avis GHSA-fc5q-39xc-vjpf ignoré, décision S-25.1 |
| `pnpm tauri build` | ✅ `svelte-check` : 0 erreur, 2 avertissements a11y sur `CommitGraph.svelte:309`, préexistants (lignes que ce diff ne touche pas) |

## Critères d'acceptation
Non modifiés depuis la revue 1, tous les tests concernés repassent (cargo, Vitest, e2e `checkout.spec.ts` et `panel.spec.ts`). Seul organiser-l-espace CA-10 a été retouché au passage 2.

| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| gerer-les-branches CA-1 | couvert | `crates/git/tests/checkout.rs`, `BranchSidebar.test.ts`, `e2e/checkout.spec.ts:45,66` |
| gerer-les-branches CA-2 | couvert | `Toolbar.test.ts`, `e2e/checkout.spec.ts:80,98` |
| gerer-les-branches CA-3 | couvert | `RefContextMenu.test.ts`, `e2e/checkout.spec.ts:111,135` |
| gerer-les-branches CA-4 | couvert | `checkout.rs` (création, suivi, 0 / 0, locale au même commit), e2e par les trois gestes |
| gerer-les-branches CA-5 | couvert | `checkout.rs` (CA-5) |
| gerer-les-branches CA-21 | couvert | `checkout.rs` (`NeedsChoice`, Reset, AsIs), `RefContextMenu.test.ts`, `e2e/checkout.spec.ts:212-288` |
| gerer-les-branches CA-23 | couvert | `assert_safe` dans les tests Rust, `expectSafe` en e2e, tags et stashes refusés |
| organiser-l-espace CA-10 (checkout) | couvert | `e2e/panel.spec.ts:86,111` (volet fermé, focus rendu à l'icône, panneau déplié inchangé) ; `BranchSidebar.test.ts` : checkout depuis le volet, depuis le panneau déplié, et menu ouvert par Maj+F10 dans le volet puis `checkoutStarts` qui augmente |

## Interface
Aucun changement visuel depuis la revue 1 : le passage 2 ajoute seulement la fermeture du volet quand un checkout est lancé hors de lui (`closeFly` déclenché par `checkoutStarts`). Je n'ai pas repris de captures : celles de la revue 1 (1500×900 et 1920×1080) restent valables. La fermeture elle-même est couverte en e2e (`panel.spec.ts:86`).

| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · double-clic panneau et `RefLabel` · 1500×900 et 1920×1080 | conforme (revue 1, e2e vert) | — |
| History · sélecteur filtré sur `graph` · 1500×900 et 1920×1080 | conforme (revue 1) | — |
| History · `RefContextMenu` local et `origin/…` · 1500×900 et 1920×1080 | conforme (revue 1) | — |
| History · confirmation CA-21 · 1500×900 et 1920×1080 | conforme (revue 1) | — |
| History · volet flottant ouvert puis fermé · 1500×900 et 1920×1080 | conforme (e2e vert, volet fermé et focus à l'icône) | — |

## Suivi de la revue précédente
Aucun bloquant au passage 1. Le mineur 1 est traité.

| # précédent | Statut | Preuve |
|---|---|---|
| 1 (mineur : volet non fermé par un checkout lancé au clavier depuis le menu) | levé | `BranchSidebar.svelte` : `$effect` sur `checkoutStarts` qui appelle `closeFly`. `App.svelte` incrémente `checkoutStarts` à chaque checkout lancé et le passe à `History`, puis à `BranchSidebar`. Test Vitest « a checkout started from the menu opened by Shift+F10 in the floating pane closes it ». |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/App.svelte` (`checkoutStarts`), `src/lib/screens/History.svelte` | Le test Vitest du passage 2 pilote `BranchSidebar` par la prop `checkoutStarts`. Aucun test ne couvre la chaîne `App` → `History` → `BranchSidebar` pour un checkout lancé par le menu au clavier : si `History` ne passait plus la prop, rien n'échouerait. Le câblage est correct à la lecture du diff. | Un e2e : panneau replié, volet ouvert, Maj+F10 sur une branche puis Entrée sur Checkout, volet fermé. |

## Pour l'humain
- **pour information** : `e2e/badge-menu.spec.ts:178` (« proteger-l-identite CA-11 : Reset to rules… ») a échoué deux fois sous charge : au premier `pnpm e2e` complet, et en fichier seul pendant que `pnpm test:js` tournait. Il est repassé seul, en fichier seul (machine au repos) et dans le `pnpm e2e` complet final. Dans le cas d'échec, le badge montrait « identity mismatch » sans que `IdentityMismatch` s'ouvre. Ni le test ni le code d'attachement (`attach.rs`) ne sont touchés par S-25 : instabilité préexistante. Je n'ai pas pu faire la contre-épreuve sur la version `28ec362` : le sandbox bloque Chromium hors du dépôt.
- **à décider** : l'amendement de `stack.md` pour GHSA-fc5q-39xc-vjpf reste à faire par `/ksm:stack`, comme noté en S-25.1. Rien n'a changé depuis la revue 1.
