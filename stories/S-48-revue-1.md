**validé**

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm e2e e2e/button-icons.spec.ts e2e/appearance.spec.ts` | ✅ 23 passés |
| `pnpm test:js` sur `ButtonIcons.test.ts`, `ThemeSwitch.test.ts`, `tokens.test.ts` | ✅ 13 passés |
| Captures Playwright (script jetable hors dépôt) : `History` à 1 500×900 et 1 920×1 080, menu ouvert, Kraken sombre, Kraken clair | ✅ l'application démarre ; aucun processus ne reste sur le port 1420 |

Pas de contre-épreuve par mutation. Pour les tests sans rouge constaté, chaque assertion a été lue et jugée : elle échouerait sans le critère.

## Critères d'acceptation
Tous couverts : CA-4, CA-5, CA-6, CA-7, CA-8, CA-9, CA-10, CA-11, CA-15, CA-16 de `choisir-l-apparence` (preuves : `appearance.spec.ts`, `button-icons.spec.ts`, `ThemeSwitch.test.ts`, `tokens.test.ts`, `ButtonIcons.test.ts`, tests Rust de `crates/store` et `src-tauri`).

## Interface
`History` conforme à `ux.md` et à la maquette (menu fermé et ouvert, Kraken sombre et clair, 1 500×900 et 1 920×1 080 ; menu ouvert à 1 920×1 080 non ouvert, couvert par les e2e). Autres écrans non capturés, vérifiés par e2e. Lueur Halo, Halo décoché et Neon clair non capturés.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/app.css` (règles `.primary` et `button.danger`) | Ces règles posent `box-shadow: var(--halo-brand)` ou `--halo-danger`. Sur un bouton plein qui a le focus clavier, elles écrasent la lueur de focus de `:focus-visible` (spécificité plus forte). L'anneau de focus reste visible. | Cumuler les deux ombres sur `:focus-visible` des boutons pleins. À reprendre dans S-56 (focus). |
| 2 | mineur | `src/lib/components/ThemeSwitch.svelte` | Le menu marque le choix par une coche, pas par des radios comme la maquette (section 1b). | Détail de style que la maquette en basse fidélité n'impose pas. |

## Pour l'humain
RAS
