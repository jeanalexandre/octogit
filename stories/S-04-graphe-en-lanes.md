# Story S-4 : Afficher le graphe en lanes colorées, virtualisé

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-04-graphe-en-lanes.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-4 (tranche valeur 1)
- Critères couverts : `explorer-l-historique` CA-9, CA-12, CA-13, CA-14, CA-15, CA-16, CA-23
- Jobs servis : J-1
- Revue renforcée : oui (performance chiffrée : CA-23, 10 000 commits en moins de 3 s, défilement à 60 images/s)

## Objectif
`History` affiche le graphe en lanes colorées, en liste virtualisée, avec initiales d'auteur, colonnes auteur / date / SHA masquables et mémorisées, dates relatives et barre d'aide, et tient 10 000 commits.

## Critères d'acceptation
- **explorer-l-historique CA-9** : Étant donné un graphe affiché, alors chaque ligne de commit est teintée de la couleur de sa lane et ouverte par un trait de cette couleur ; deux branches voisines n'ont pas la même couleur de lane.
- **explorer-l-historique CA-12** : Étant donné un commit d'auteur « Jean-Alexandre Gautreau », alors son nœud affiche des initiales cerclées de la couleur de sa branche et aucune image d'avatar n'est chargée.
- **explorer-l-historique CA-13** : Étant donné un graphe affiché, alors les colonnes auteur, date et SHA abrégé sont visibles ; un clic droit sur l'en-tête de colonnes masque ou réaffiche chacune séparément.
- **explorer-l-historique CA-14** : Étant donné une colonne masquée, quand je ferme puis rouvre Octogit, alors elle est toujours masquée.
- **explorer-l-historique CA-15** : Étant donné un commit, alors sa date est toujours relative (« 12 min ago », « yesterday », « 3 weeks ago ») ; au survol, la date et l'heure absolues s'affichent au format « 2026-11-04 14:32 ».
- **explorer-l-historique CA-16** : Étant donné un graphe affiché, alors une barre d'aide en pied du graphe indique en une ligne comment sélectionner une branche puis lancer une action par clic droit.
- **explorer-l-historique CA-23** : Étant donné un dépôt de 10 000 commits, quand je l'ouvre, alors le graphe s'affiche en moins de 3 s ; quand je le fais défiler du premier au dernier commit, alors le défilement tient 60 images/s sans saut visible.

## Décisions de l'humain
### Passage 1, écarts (10/11/2026)
1. Bouton « Columns » (⋯) ajouté dans l'en-tête : retiré. Le menu des colonnes s'ouvre au clavier par la touche menu ou Maj+F10 quand l'en-tête a le focus, comme un menu contextuel ; `ux.md` inchangé (option b).
2. Seuil du test e2e de défilement à 50 images/s en moyenne : accepté par l'humain (60,0 mesuré).
3. Coude de création de branche, à corriger : la maquette (`ux/maquettes/history.html`, ex. `M86 187 V349 Q86 357 78 357 H56`) prolonge la lane de la branche **verticalement jusqu'à la ligne du commit parent**, puis tourne vers le nœud parent (coude sur la ligne du parent : en remontant le temps, « droite puis haut »). Le code actuel (`crates/git/src/graph.rs`, `layout` : premier parent déjà attendu par une autre lane → arête `Out` sur la ligne de l'enfant) tourne sur la ligne du **premier commit de la branche** (« haut puis droite »). Attendu : quand le premier parent est déjà attendu ailleurs, la lane de l'enfant reste ouverte jusqu'au parent et le rejoint par une arête `In` sur la ligne du parent. Le second parent d'un merge garde son coude sur la ligne du merge (conforme à la maquette, ex. `M26 425 H48 Q56 425 56 433 V459`). Test de calcul de lanes à ajouter (rouge d'abord).

### Après la revue 1 (11/11/2026)
1. Mineur 3 (couleur du coude vers un second parent déjà attendu) : traiter (d'office).
2. Mineur 4 (remplissage du nœud mélangé avec `on-brand` au lieu du blanc de `ux/tokens.md`) : traiter (d'office).
3. Mineur 5 (date absolue au focus, lignes pas encore focalisables) : reporter vers S-56 (clavier sur les écrans complexes) (d'office).
4. Mineur 6 (`role="toolbar"` vide sur l'en-tête) : traiter (d'office).
5. Graphe tronqué sans signe au-delà de 10 000 commits : pris en compte (pour information).
6. Échec d'écriture des préférences ignoré sans message : pris en compte (pour information).

## Contexte technique
- Existant à étendre : `crates/git/src/lib.rs` (`read_commits`, `CommitInfo` : id, summary, author, timestamp ; lecture `gix`) ; `src-tauri/src/launch.rs` et `open.rs` (`RepositoryView` porte la liste des commits) ; `src/lib/screens/History.svelte` (liste simple à remplacer) ; `src/lib/relativeTime.ts` (date relative, à réutiliser ou compléter) ; `src/lib/styles/tokens.css` (tokens `lane-1`…`lane-6`, `node-ink`, `selection`, `border`, `muted`…, seule source des couleurs).
- Il faut les parents de chaque commit pour calculer les lanes : enrichir `CommitInfo` (ou un type dédié) dans le crate `git` ; `src-tauri` n'expose que des commandes ; contrat par `pnpm gen:bindings` (`src/lib/bindings.ts` généré, jamais édité).
- Graphe : `stack.md` « Rendu du graphe » : liste virtualisée en HTML (seules les lignes visibles existent), tronçon de lanes en SVG par ligne ; focus, rôles, clic droit et clavier natifs ; liens à angles droits et coudes arrondis (`ux.md` « Ton et accessibilité »). Virtualisation écrite à la main ; ajouter une bibliothèque exige l'accord de l'humain (statut `bloqué`).
- Ordre des lanes : l'ordre des commits suit `read_commits` (plus récent d'abord) ; l'attribution d'une couleur de lane à un commit et le placement des lanes sont un choix d'implémentation. Contraintes : deux lanes voisines ont des couleurs différentes ; jamais d'information portée par la couleur seule (`ux.md`).
- `ux/ecrans/history.md` (composants `CommitGraph`, `CommitNode`) et maquette `ux/maquettes/history.html` ; `ux.md` « Direction visuelle » : lignes de 34 px (bande teintée 30 px), SF Pro 13 px (message 14 px), SF Mono 12 px pour SHA, initiales cerclées de la couleur de branche.
- Colonnes masquables : clic droit sur l'en-tête (menu natif du composant, accessible au clavier) ; état mémorisé dans le fichier JSON de préférences du crate `store` (`stack.md` « Données » : colonnes masquées, champ `version`, écriture atomique, fichier d'exemple versionné pour la migration) sous `OCTOGIT_DATA_DIR`.
- Date : relative en permanence ; absolue au survol au format « 2026-11-04 14:32 » (fuseau local).
- Barre d'aide en pied : texte d'une ligne, sans interaction ; formulation de `ux/ecrans/history.md` (cliquer la branche qui reçoit, puis clic droit sur la source). Sélectionner une branche et le menu contextuel eux-mêmes arrivent en S-5 et S-36 : ici seulement le texte.
- Fixture : ajouter `fixtures/large.sh` (dépôt de 10 000 commits, déterministe, créé vite, par exemple avec `git fast-import`) ; à ne pas fabriquer à chaque test lent. Mesures de CA-23 : ouverture < 3 s (Playwright sur `pnpm dev:web`), défilement du premier au dernier commit sans trou ni saut ; la mesure d'images/s est un test e2e sur Chromium, à seuil réaliste décrit dans le test.
- Initiales : deux lettres (première lettre du prénom et du dernier mot du nom) ; aucune image chargée (test : aucune requête réseau d'image).
- Limite de lecture : `read_commits` est appelé avec une limite ; elle doit couvrir 10 000 commits.
- Les commandes sont lancées avec le `PATH` du poste ; ne préfixe pas les commandes par un script d'environnement.

## Interface à vérifier
- **Écrans et états** : `History` avec le dépôt `branches` (lanes de plusieurs couleurs, merge), en-tête de colonnes (clic droit, colonne masquée puis relance), dépôt de 10 000 commits (ouverture et défilement), initiales d'un auteur composé, dates relatives et absolue au survol, barre d'aide en pied
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] explorer-l-historique CA-9 → test de composant (Vitest) : chaque ligne porte la couleur de sa lane et un trait d'ouverture ; deux lanes voisines ont deux couleurs différentes ; test Rust du calcul de lanes sur le dépôt `branches`
- [ ] explorer-l-historique CA-12 → test de composant : « Jean-Alexandre Gautreau » donne « JG » dans un nœud cerclé de la couleur de la lane ; aucune balise `img` ni requête d'image
- [ ] explorer-l-historique CA-13 → e2e : colonnes auteur, date, SHA visibles ; clic droit sur l'en-tête masque puis réaffiche chacune séparément
- [ ] explorer-l-historique CA-14 → test du crate `store` (écriture, relecture, fichier d'exemple versionné) et e2e : colonne masquée, page rechargée, toujours masquée
- [ ] explorer-l-historique CA-15 → test unitaire (« 12 min ago », « yesterday », « 3 weeks ago ») et e2e : survol d'une date affiche « 2026-11-04 14:32 »
- [ ] explorer-l-historique CA-16 → test de composant : barre d'aide d'une ligne en pied du graphe
- [ ] explorer-l-historique CA-23 → e2e sur `fixtures/large.sh` : graphe affiché en moins de 3 s, seules les lignes visibles sont dans le DOM, défilement du premier au dernier commit mesuré

## Hors périmètre
- Refs (`RefLabel`, `BranchSidebar`), avance / retard, `CommitDetail`, sélection d'un commit (S-5).
- Fetch et `FetchStatus` (S-6) ; ligne WIP et `notify` (S-14).
- Recherche (S-30), thèmes autres que le défaut (S-47, S-48), icônes Lucide (S-48).
- Modification du contrat d'ouverture au-delà de ce que le graphe exige.

## Documentation à mettre à jour
- README : mentionner `fixtures/large.sh` et la façon de lancer les tests lents s'ils sont séparés. Rattrapage : à vérifier à l'écriture (README et `.env.example` reflètent l'état du projet ; aucune variable nouvelle attendue).
- `.env.example` : aucun changement attendu.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : `6234e98`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (complété après décisions 1 et 3 de « Passage 1, écarts ») : rouge constaté sur les tests rapides, 8 e2e de `graph.spec.ts` sans rouge ; vérifications relancées ✅ | — |
| 1 | reviewer (opus) | 2 bloquants (initiales en 10 px, menu des colonnes sans « Commit message » ni note), 4 mineurs, 2 pour information — `stories/S-04-revue-1.md` | à corriger |
| 2 | dev | terminé : bloquants 1 et 2, mineurs 3, 4 et 6 traités, rouge constaté sur les tests rapides, extension e2e CA-13 clavier sans rouge ; vérifications relancées ✅ | — |
| 2 | reviewer (opus) | 0 bloquant, 0 mineur, RAS — `stories/S-04-revue-2.md` | validé |
