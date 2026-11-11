# Spec : Organiser l'espace de History

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/organiser-l-espace.md`. Validé par l'humain le 11/11/2026.
> Révisions : 11/11/2026, création : critères sortis de l'amendement de `specs/explorer-l-historique.md` (révision du 11/11/2026 de `ux.md`, décisions de l'humain du 11/11/2026).

## Objectif
Dans `History`, je retrouve une branche d'un coup d'œil dans `BranchSidebar`, rangée par dossiers, et je règle la place que prennent le panneau, le graphe et ses refs. Rien ne bouge seul : mes réglages tiennent d'une session à l'autre, et un nom long reste lisible au survol.
- Jobs servis : J-1, J-16

## Périmètre
- **Inclus :** ordre fixe et tri des sections de `BranchSidebar`, noms groupés par chemin, dossiers repliables mémorisés par dépôt ; sections redimensionnables en hauteur et repliables, mémorisées globalement ; panneau repliable en bande d'icônes avec volet flottant, mémorisé globalement ; largeur du graphe réglable par glisser, mémorisée par dépôt, défaut sur toutes les lanes plafonné à 40 % ; valeurs par défaut figées jusqu'à la prochaine ouverture du dépôt ; colonne des refs à 180 px : troncature en fin, « +n », étiquettes flottantes, saisie en ligne qui s'élargit au-dessus du graphe ; infobulle nom et adresse de l'auteur (de `ux.md` : principe 6, `ux/ecrans/history.md` et lignes « `BranchSidebar` : largeur fixe… » et « `CommitGraph` : largeur du graphe non réglable… » de « Réorganisation proposée »).
- **Exclu :**
  - Masquage ou épinglage de branches dans le graphe (non-objectif) : le repli d'une section ou d'un dossier ne touche que `BranchSidebar`.
  - Contenu du graphe et des refs (refs affichées, variantes de `RefLabel`, colonnes auteur / date / SHA) → `specs/explorer-l-historique.md` (CA-7, CA-8, CA-13)
  - Checkout par double-clic, création et Rename de branche (validation du nom, messages, Entrée, Échap) → `specs/gerer-les-branches.md`
  - Create tag (validation du nom, message, création) → `specs/synchroniser.md`
  - Sélection de la branche qui reçoit et `RefContextMenu` → `specs/integrer-une-branche.md`

## Critères d'acceptation
- **CA-1** : Étant donné un dépôt avec les remotes `origin`, `upstream` et `backup`, des tags et des stashes, alors `BranchSidebar` montre ses sections dans l'ordre Local, `origin`, `backup`, `upstream`, Tags, Stashes ; les branches de chaque section sont triées par ordre alphabétique, la courante à sa place ; tags et stashes vont du plus récent au plus ancien.
- **CA-2** : Étant donné les branches locales `feat/api`, `feat/graph`, `feat/ui/x` et `main`, alors Local montre le dossier « feat · 3 » puis `main` ; « feat · 3 » contient le dossier « ui · 1 » (qui affiche `x`) puis `api` et `graph` : dossiers avant les noms, chacun par ordre alphabétique, compte de toutes les refs sous le dossier, sous-dossiers compris, dossiers dépliés par défaut ; le même groupement s'applique à chaque remote et à Tags ; les stashes ne sont pas groupés.
- **CA-3** : Étant donné un dossier de `BranchSidebar`, quand je clique dessus, alors il se replie ou se déplie ; quand je ferme puis rouvre Octogit sur ce dépôt, alors il garde cet état ; un autre dépôt garde ses propres états.
- **CA-4** : Étant donné une section de 23 lignes et une section de 3 lignes dont la hauteur n'a pas été réglée, quand `History` s'affiche, alors la première montre 8 lignes et défile seule, la seconde montre ses 3 lignes ; la branche courante est visible sans défiler ; une section vide n'affiche que son en-tête.
- **CA-5** : Étant donné une section de 3 lignes à hauteur par défaut, quand un fetch y ajoute une branche, alors sa hauteur ne change pas jusqu'à la prochaine ouverture du dépôt.
- **CA-6** : Étant donné une section de `BranchSidebar`, quand je glisse son bord bas, alors sa hauteur suit le glisser et est gardée à la fermeture d'Octogit et dans tous les dépôts ; quand je double-clique sur ce bord, alors elle revient à sa hauteur par défaut, recalculée (CA-4).
- **CA-7** : Étant donné une section de `BranchSidebar`, quand je clique sur son en-tête, alors elle se replie (en-tête seul) ou se déplie ; l'état est gardé à la fermeture d'Octogit et dans tous les dépôts.
- **CA-8** : Étant donné une section ou un dossier replié dans `BranchSidebar`, alors toutes les refs qu'il contient restent dans le graphe et la colonne des refs.
- **CA-9** : Étant donné `BranchSidebar` déplié, quand je clique sur le bouton en tête du panneau, alors le panneau devient une bande d'une icône par section, avec le nom de la section en infobulle ; un nouveau clic le rétablit ; aucun raccourci clavier ne le replie ; l'état est gardé à la fermeture d'Octogit et dans tous les dépôts.
- **CA-10** : Étant donné le panneau replié, quand je clique sur l'icône d'une section, alors un volet flottant affiche cette section par-dessus le graphe, sans décaler ni redimensionner le graphe ; Échap, un clic hors du volet ou un checkout depuis le volet le ferme.
- **CA-11** : Étant donné un dépôt dont toutes les lanes tiennent dans 40 % de la zone du graphe, alors la largeur du graphe affiche toutes les lanes ; étant donné un dépôt dont les lanes dépassent 40 %, alors la largeur s'arrête à 40 % et un fondu au bord signale les lanes coupées.
- **CA-12** : Étant donné la largeur du graphe par défaut, quand un fetch ajoute des lanes, alors la largeur ne change pas jusqu'à la prochaine ouverture du dépôt et un fondu au bord signale les lanes nouvelles coupées.
- **CA-13** : Étant donné le séparateur entre graphe et message, quand je le glisse, alors la largeur du graphe suit et est gardée à la fermeture d'Octogit pour ce dépôt seulement ; quand je double-clique dessus, alors elle revient au défaut, recalculé sur les lanes présentes (CA-11).
- **CA-14** : Étant donné une ref `feature/very-long-branch-name-for-sso`, alors la colonne des refs garde 180 px de large et la `RefLabel` affiche le nom tronqué en fin, terminé par « … ».
- **CA-15** : Étant donné un commit désigné par plusieurs refs, alors sa ligne montre une seule `RefLabel`, la prioritaire (courante, sinon locale, sinon distante seule, sinon tag), suivie de « +n » pour les n autres ; une branche locale et son `origin/…` sur ce commit forment une seule étiquette à deux icônes.
- **CA-16** : Étant donné une `RefLabel` tronquée ou suivie de « +n », quand je la survole ou lui donne le focus clavier, alors toutes les `RefLabel` de la ligne s'affichent entières, empilées par-dessus le graphe, dans leur variante (`specs/explorer-l-historique.md` CA-8) ; un double-clic ou un clic droit sur l'une d'elles agit sur cette ref comme sur sa `RefLabel`.
- **CA-17** : Étant donné la saisie en ligne d'un nom (création ou Rename de branche, Create tag), quand je tape un nom plus long que la colonne des refs, alors le champ s'élargit par-dessus le graphe et montre le nom entier, et la colonne des refs garde 180 px.
- **CA-18** : Étant donné un commit de « Valérie Olivier » (`v.olivier@pro-company.fr`), quand je survole son nom d'auteur ou lui donne le focus clavier, alors une infobulle affiche « Valérie Olivier <v.olivier@pro-company.fr> ».

## Interface
- Écrans concernés (`ux.md`) : `History` (`ux/ecrans/history.md`, maquette `ux/maquettes/history.html`, sections 1 et « 7 · Sidebar and layout — added on 11/11 ») ; principe d'interaction 6 de `ux.md`.
- Composants utilisés (`ux.md`) : `BranchSidebar` (déplié · replié · volet flottant ouvert · courante · saisie en ligne), `CommitGraph`, `CommitNode`, `RefLabel` (tronquée · « +n » · flottante · saisie en ligne).
- Composants à ajouter : aucun.

## À reporter
- Vers `stack.md` : mémorisation locale des préférences de mise en page, globales (hauteurs de section, repli des sections, repli du panneau) et par dépôt (état des dossiers, largeur du graphe).
- Vers `ux.md` : dans `ux/ecrans/history.md`, `BranchSidebar` : repli d'une section par son en-tête mémorisé globalement, comme les hauteurs ; compte d'un dossier = toutes les refs sous le dossier, sous-dossiers compris. `BranchSidebar` et `CommitGraph` : largeur du graphe et hauteur de section non réglées restent figées jusqu'à la prochaine ouverture du dépôt (un fetch ne les recalcule pas, principe 6) ; des lanes nouvelles coupées sont signalées par le fondu ; un double-clic sur le séparateur ou le bord recalcule le défaut.

## Questions ouvertes
- aucune
