# Revue S-61 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo : 18 + 27 + 4 + 32 + 1 ; vitest : 144 tests, 20 fichiers) | ✅ |
| `pnpm e2e` (80 tests, dont `graph.spec.ts` 10 000 commits) | ✅ |
| `pnpm audit:deps` (3 avertissements Rust « allowed », 1 avis ignoré, déjà dans les notes de production) | ✅ |
| `pnpm tauri build` (`pnpm check` : 0 erreur ; les 2 avertissements a11y sont sur l'en-tête `class="head"`, ligne 278, hors diff) | ✅ |

## Critères d'acceptation
Aucun de ces tests n'a été vu rouge avant le code. Je les juge sur leur contenu et chacun échouerait si son critère n'était pas tenu : l'ancien code donnait 260 px, plusieurs étiquettes par ligne et pas d'infobulle.

| Critère | Statut | Preuve |
|---|---|---|
| explorer-l-historique CA-7 (évolution) | couvert | `e2e/refs.spec.ts:56-70` (une étiquette par ligne, « +1 », 7 `[data-ref]`) ; `History.test.ts` (étiquette unique, fil `[data-wire]`) ; `e2e/sections.spec.ts:199-200` |
| organiser-l-espace CA-14 | couvert | `e2e/refs-column.spec.ts:31-52` : colonne = 180 px exactement, `text-overflow: ellipsis`, `scrollWidth > clientWidth`, aux 3 tailles. Le test Vitest `RefLabel.test.ts` ne vérifie que nom, titre et `data-full` (jsdom ne mesure pas) ; la preuve de la troncature est l'e2e. |
| organiser-l-espace CA-15 | couvert | `src/lib/refLabels.test.ts` (priorité courante, locale, distante seule, tag, stash ; fusion locale + `origin/`) ; `e2e/refs-column.spec.ts:55-77` (au plus 1 étiquette par ligne, « +2 », 2 icônes) ; `History.test.ts` (« +n », pas de « +n » pour une ref seule) |
| organiser-l-espace CA-16 | couvert | `e2e/refs-column.spec.ts:80-133` : survol, puis focus clavier, puis disparition. Étiquettes entières, empilées, variantes, par-dessus le graphe (`elementFromPoint`). `History.test.ts` : double-clic et clic droit rappellent le nom de la ref, sur l'étiquette flottante (`onrefdblclick`, `onrefcontextmenu`) comme sur celle de la colonne. Le checkout et le menu viennent avec S-25 et S-36 ; la fiche ne demande que de ne pas les bloquer. |
| organiser-l-espace CA-18 | couvert | `History.test.ts` (survol et focus, texte « Valérie Olivier <v.olivier@pro-company.fr> », `tabindex=0`) ; `e2e/refs-column.spec.ts:135-154` (infobulle, ≥ 12 px, disparition au `Tab`) |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · colonne des refs (tronqué « … », « +2 », locale + origin/ à deux icônes, tag) · 1500×900 | conforme (maquette « Ref column — truncated, +2, hover ») | — |
| History · colonne des refs · 1920×1080 | conforme | — |
| History · colonne des refs · 1280×720 | conforme | — |
| History · étiquettes flottantes au survol (le focus est couvert par l'e2e) · 1500×900, 1920×1080, 1280×720 | conforme : pile entière, par-dessus le graphe, sans débordement | — |
| History · infobulle d'auteur · 1500×900, 1920×1080, 1280×720 | conforme (1280 vu en capture ; les autres tailles sont prises dans le même script, non ouvertes une à une) | — |

Les captures sont dans `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/ce880ca7-a2d5-402b-97a4-3de5d9a4f5ca/scratchpad/` (`base-*.png`, `float-*.png`, `tip-*.png`). Le serveur lancé par le script est coupé et `pgrep` ne voit plus de vite.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `e2e/helpers.ts:32` et `fixtures/refcolumn.sh` | `fixtures/refcolumn.sh` est en 644, alors que tous les autres scripts de `fixtures/` sont en 755. Pour le contourner, `helpers.ts` lance désormais chaque fixture par `sh <script>` au lieu de l'exécuter directement. | `chmod +x fixtures/refcolumn.sh` et retour à `execFileSync(resolve(...))`, pour ne pas toucher le comportement des autres fixtures. |

## Pour l'humain
RAS
