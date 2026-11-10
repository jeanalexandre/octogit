# Story S-3 : Livrer un `.dmg` signé ad hoc

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-03-livrer-dmg.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-3 (tranche socle)
- Critères couverts : `stack.md` « Livraison » (aucun critère de spec)
- Jobs servis : J-1
- Revue renforcée : oui (déploiement : forme livrée, signature et distribution)

## Objectif
`pnpm tauri build` produit `Octogit.app` dans un `.dmg` pour puces Apple, signé ad hoc, et la release GitHub manuelle sur `jeanalexandre/octogit` est documentée.

## Critères d'acceptation
- **stack.md Livraison** : Forme livrée : `Octogit.app` dans un `.dmg`, produit par `pnpm tauri build` (puces Apple).
- **stack.md Livraison** : Distribution et mise à jour : `.dmg` attaché à une release GitHub du repo ; mise à jour manuelle (téléchargement, autorisation au premier lancement).
- **stack.md Livraison** : Signature, notarisation : signature ad hoc par `pnpm tauri build`, sans compte Apple Developer ni notarisation ; une version téléchargée s'autorise une fois au premier lancement.

## Décisions de l'humain
### Après la revue 2 (10/11/2026)
1. Mineur 1 (tests automatiques des échecs signature et architecture) : traiter (d'office).
2. Mineur 2 (`LSMinimumSystemVersion` à `13` refusée à tort) : traiter (d'office).
3. Mineur 3 (binaire contrôlé = premier fichier de `Contents/MacOS`, pas `CFBundleExecutable`) : traiter (d'office).
4. `pnpm test` plus long (~35 s) et volume de test possiblement resté monté si vitest coupe un test : pris en compte (pour information).

### Passage 3, environnement (10/11/2026)
1. `cargo` introuvable dans le `PATH` des agents (`~/.cargo/bin` absent) : l'humain ajoute `. "$HOME/.cargo/env"` à `~/.zshenv` (option a).

### Après la revue 3 (10/11/2026)
1. `pnpm test` porté à ~80 s par les cinq nouveaux cas qui montent de vrais `.dmg` : pris en compte (pour information).

## Contexte technique
- Dépend de S-2 (application ouvrable) et de S-1 (`src-tauri/`, `pnpm tauri build`). `stack.md` : Livraison, Plateforme cible (macOS 13 minimum, puces Apple seulement), Commandes de qualité (Build).
- Configuration Tauri 2 (`src-tauri/tauri.conf.json`) : cible de bundle `dmg` (et `app`), identité de signature ad hoc (`signingIdentity` « - »), version minimale du système 13.0, architecture `aarch64-apple-darwin`, nom de produit « Octogit ». Aucun plugin `updater`, aucune clé de signature Tauri : envisagés plus tard seulement.
- Pas de compte Apple Developer, pas de notarisation, aucun secret dans le repo.
- La publication de la release GitHub est manuelle et reste à l'humain : l'agent ne pousse rien et ne crée aucune release ; il documente les étapes. Aucun workflow CI (géré par l'humain).
- Vérifications locales possibles : présence du `.dmg` et de `Octogit.app` dans `src-tauri/target/release/bundle/` (ou le dossier de cible du workspace), `codesign -dv` (signature ad hoc), `lipo -archs` (arm64 seulement), clé `LSMinimumSystemVersion` de l'`Info.plist`.

## Tests à écrire d'abord
- [ ] stack.md Livraison (forme) → script de vérification versionné (ex. `scripts/check-bundle.sh`, lancé après `pnpm tauri build`) : échoue tant que le `.dmg` et `Octogit.app` sont absents
- [ ] stack.md Livraison (signature) → même script : `codesign -dv` sur `Octogit.app` indique une signature ad hoc (`Signature=adhoc`), pas d'identité Apple Developer
- [ ] stack.md Livraison (cible) → même script : `lipo -archs` rend `arm64` seulement ; `LSMinimumSystemVersion` ≥ 13.0
- [ ] Configuration → Vitest ou test de script : `tauri.conf.json` ne déclare aucun `updater` ni clé de signature

## Hors périmètre
- Mise à jour intégrée (plugin `updater`), notarisation, compte Apple Developer, CI de release.
- Création effective de la release GitHub et de l'attachement du `.dmg` : action de l'humain.
- Icônes finales de l'application au-delà de celles que `tauri build` exige : une icône par défaut suffit.
- Toute modification du code applicatif de S-1 et S-2.

## Documentation à mettre à jour
- README : section « Livraison » : construire (`pnpm tauri build`), où trouver le `.dmg`, installer (glisser dans Applications), premier lancement (autorisation : clic droit › Ouvrir ou Réglages Système › Confidentialité et sécurité), et publier une release manuelle sur `jeanalexandre/octogit` (étapes, sans automatisation).
- `.env.example` : aucun changement attendu.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`, puis le script de vérification du bundle
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : `7d818d5`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : rouge constaté après renvoi sur les tests rapides, `check-bundle.sh` transmis sans rouge ; vérifications relancées ✅ | — |
| 1 | reviewer (opus) | 2 bloquants (`check-bundle.sh` : clé macOS manquante acceptée, contenu du `.dmg` non vérifié), 2 mineurs (README) — `stories/S-03-revue-1.md` | à corriger |
| 2 | dev | terminé : bloquants 1 et 2 et mineurs 3 et 4 de la revue 1 traités ; 5 tests lents du script transmis sans rouge ; vérifications relancées ✅ | — |
| 2 | reviewer (opus) | 0 bloquant, 3 mineurs (`check-bundle.sh` et ses tests), 1 pour information — `stories/S-03-revue-2.md` | validé |
| 3 | dev | terminé : mineurs 1 à 3 de la revue 2 déjà présents au début du passage (passage interrompu plus tôt), 5 tests lents transmis sans rouge ; vérifications relancées ✅ | — |
| 3 | reviewer (opus) | 0 bloquant, 0 mineur, 1 pour information ; rouge des 5 tests lents prouvé — `stories/S-03-revue-3.md` | validé |
