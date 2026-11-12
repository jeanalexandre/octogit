# Revue S-59 : passage 1

## Verdict
**bloqué**

Je n'ai pas pu prendre les captures d'interface : l'outil Write n'existe pas dans cette session. Le script Playwright jetable hors du dépôt ne peut donc pas être écrit, et la règle m'interdit tout autre moyen (code en ligne, heredoc). Le code, les tests et les vérifications ne montrent aucun défaut. Il manque seulement la comparaison visuelle avec `ux.md` et la maquette (bande, infobulle, volet sur Local et sur un remote, aux 3 tailles). Pour lever le blocage, relancer la revue avec un outil d'écriture de fichier disponible. Je n'ai relevé aucun problème de code à corriger.

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace + vitest : 128 tests, 18 fichiers) | ✅ |
| `pnpm e2e` (62 tests, dont `panel.spec.ts` aux 3 tailles) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (3 avertissements cargo « allowed », 1 exception pnpm déjà actée) |
| `pnpm tauri build` (svelte-check inclus, 0 erreur) | ✅ (2 avertissements a11y de `CommitGraph.svelte:201`, préexistants, hors diff) |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| organiser-l-espace CA-9 | couvert | Vitest `BranchSidebar.test.ts:31` (bouton, bande d'une icône par section avec `title`, rétablissement) ; e2e `panel.spec.ts:51` (repli, infobulle, `preferences.json` `panel_collapsed` + `version` 3, persistance après rechargement, autre dépôt via RepoPicker, `Meta+b` et `Control+b` sans effet sur l'application entière) ; absence de raccourci : `BranchSidebar.test.ts:53` + e2e |
| organiser-l-espace CA-10 (sauf checkout, scindé vers S-25) | couvert | e2e `panel.spec.ts:87`, aux 3 tailles : géométrie du graphe (boîte et x/largeur de chaque cellule) identique avant et après l'ouverture du volet, volet posé sur le graphe, Échap avec focus rendu à l'icône, clic hors du volet. Vitest `BranchSidebar.test.ts:68, 83, 99` |

Jugement des trois tests sans rouge constaté :
- **« no keyboard shortcut folds the panel »** : il prouve l'absence dans le composant, car un handler qui replierait le panneau appellerait `onpaneltoggle`, et le test échouerait. L'e2e `Meta+b` / `Control+b` complète au niveau de l'application. Non bloquant.
- **e2e CA-9** : les assertions sont discriminantes (nombre de `h2` à 0, `title` des icônes, valeur de `panel_collapsed` lue dans le fichier, états `true` puis `false`). Il échouerait sans la fonction.
- **e2e CA-10** : la mesure de la géométrie échouerait si le volet était dans le flux, car `.host` fait 44 px fixes et le volet est en `position: absolute`. Les assertions Échap / focus / clic extérieur sont des contrôles positifs. Non bloquant.

Périmètre : le schéma passe en `version` 3 avec `panel_collapsed` (`#[serde(default)]`), les versions 1 et 2 sont migrées, et l'exemple versionné `crates/store/tests-data/preferences-v3.json` est ajouté. Les deux commandes `get_panel_collapsed` et `set_panel_collapsed` et la régénération de `bindings.ts` sont prévues par la fiche. Aucune dépendance ajoutée (icônes `@lucide/svelte` déjà là). Pas de couleur brute : uniquement des tokens existants. `ux.md`, `ux/` et `stack.md` ne sont pas modifiés. Le README est à jour (bande, volet, `panel_collapsed`, version 3). `e2e/sections.spec.ts` est ajusté de 2 à 3 pour la version, ce qui est légitime. Le checkout reste hors périmètre, comme annoncé.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · bande repliée avec infobulle · 1500×900 | non vérifié visuellement (captures impossibles) ; code conforme : une icône Lucide 16 px / 1,8 par section, `title` et `aria-label` = nom, `focus-visible` à 2 px | — |
| History · volet flottant sur Local et sur un remote · 1500×900 | non vérifié visuellement ; e2e : volet absolu sur le bord de la bande, graphe inchangé | — |
| History · bande et volet · 1920×1080 | non vérifié visuellement ; e2e vert | — |
| History · bande et volet · 1280×720 | non vérifié visuellement ; e2e vert | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| (aucun problème de code relevé) | | | | |

## Pour l'humain
- **pour information** : un serveur `pnpm dev:web` lancé pendant la revue tourne encore (processus node de vite, port 1420). Le sandbox m'interdit de le tuer. Coupe-le toi-même (`pkill -f "vite.js --mode web"`), sinon la prochaine revue ou `pnpm e2e` risque de rencontrer un port occupé.
- **à décider** : relancer la revue (passage 1 bis) dans une session où l'outil d'écriture de fichier est disponible, pour faire les captures visuelles manquantes. Sinon, tu peux accepter la story sur la base du code et de l'e2e, qui sont verts.
