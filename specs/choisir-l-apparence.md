# Spec : Choisir l'apparence

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/choisir-l-apparence.md`. Validé par l'humain le 06/11/2026.

## Objectif
Je passe la journée dans Octogit. Depuis `ThemeSwitch`, dans la barre d'outils de `History`, je choisis le thème (Dark, Light ou System) en un clic ; sa flèche ouvre la palette (Neon ou Kraken) et le halo. Le réglage vaut pour tous les écrans, tous les dépôts et tous les profils, il s'applique tout de suite, sans redémarrage et sans perdre ma place dans le graphe, et il est retrouvé au lancement suivant. Chaque bouton d'action porte une icône devant son libellé.
- Jobs servis : J-15

## Périmètre
- **Inclus :** `ThemeSwitch` dans la barre d'outils de `History`, avec palette et halo dans son menu (de `ux.md`, « Réorganisation proposée », référence du 05/11 ; repris de `specs/explorer-l-historique.md`, renvoi « apparence (`ThemeSwitch`) ») ; thèmes Dark, Light, System ; palettes Neon et Kraken, chacune en sombre et en clair (valeurs de `ux/tokens.md`) ; option Halo, effective en thème sombre seulement ; valeurs du premier lancement (System, Neon, Halo activé) ; réglage global appliqué à tous les écrans et dialogues, mémorisé, appliqué sans redémarrage ; contraste WCAG AA dans les quatre combinaisons thème × palette ; icône devant chaque libellé de bouton (de `ux.md`, « Réorganisation proposée », référence du 05/11).
- **Exclu :**
  - Thèmes personnalisés : couleurs choisies, import de thèmes, réglage de police et de taille (non-objectif du brief).
  - Apparence par profil ou par dépôt (décision de `ux.md`, J-15 : réglage global).
  - Réglage de l'apparence depuis un autre écran que `History` (`Welcome`, `ProfileSettings`, `DiffView`, dialogues) : l'apparence s'y applique sans y être réglable.
  - Couleur d'un profil → `specs/configurer-les-profils.md`
  - Ce que font les boutons de la barre d'outils et des écrans : chaque spec de leur parcours (`specs/synchroniser.md`, `specs/preparer-un-commit.md`, etc.) ; ici, seule leur icône.

## Critères d'acceptation
- **CA-1** : Étant donné `History` affiché, alors `ThemeSwitch` est visible dans sa barre d'outils et indique le thème actif (Dark, Light ou System) ; `Welcome`, `ProfileSettings`, `DiffView` et les dialogues n'affichent pas `ThemeSwitch`.
- **CA-2** : Étant donné `ThemeSwitch`, quand je clique sur Dark, Light ou System, alors toute l'interface prend ce thème immédiatement, sans redémarrage ni rechargement du dépôt, et `ThemeSwitch` indique le nouveau thème actif.
- **CA-3** : Étant donné le thème System, quand l'apparence de macOS passe de clair à sombre ou l'inverse, Octogit ouvert, alors Octogit suit cette apparence sans geste ni redémarrage.
- **CA-4** : Étant donné `ThemeSwitch`, quand je clique sur sa flèche, alors un menu s'ouvre avec Theme (Dark, Light, System), Palette (Neon, Kraken) et une case « Halo (dark theme only) » ; Échap ou un clic hors du menu le ferme sans rien changer.
- **CA-5** : Étant donné aucun réglage d'apparence encore enregistré, quand je lance Octogit, alors le thème actif est System, la palette active est Neon et la case Halo est cochée.
- **CA-6** : Étant donné le menu ouvert, quand je choisis Neon ou Kraken, alors toutes les couleurs de l'interface prennent les valeurs de cette palette pour le thème actif, telles que listées dans `ux/tokens.md`, immédiatement et sans redémarrage.
- **CA-7** : Étant donné un commit sélectionné et le graphe défilé loin du haut, quand je change de thème, de palette ou l'état du halo, alors le même commit reste sélectionné et la position de défilement du graphe ne change pas.
- **CA-8** : Étant donné le thème sombre et Halo coché, alors les lanes, les étiquettes de branche pleines et les boutons d'action `brand`, `danger` et le focus portent une lueur ; Halo décoché, aucune lueur n'est affichée.
- **CA-9** : Étant donné le thème effectif clair (Light, ou System avec macOS en clair), alors la case Halo reste active et modifiable, et aucune lueur n'est affichée, qu'elle soit cochée ou non ; quand le thème effectif repasse en sombre, la lueur s'affiche si et seulement si la case est cochée, sans autre geste.
- **CA-10** : Étant donné un thème, une palette et un état de halo choisis, quand je ferme puis rouvre Octogit, alors les trois sont restaurés.
- **CA-11** : Étant donné une apparence choisie dans `History`, quand j'ouvre `Welcome`, `ProfileSettings`, `DiffView` ou un dialogue, alors il s'affiche avec ce thème, cette palette et cet état de halo.
- **CA-12** : Étant donné une apparence choisie, quand je change de dépôt par `RepoPicker` ou ouvre un dépôt rattaché à un autre profil, alors l'apparence ne change pas.
- **CA-13** : Étant donné chacune des quatre combinaisons Neon / Kraken × sombre / clair, Halo coché ou non, alors tout texte atteint un contraste de 4,5:1 sur son fond, et les lanes, nœuds, focus et bordures de contrôle 3:1 sur le fond adjacent, teintes dérivées comprises.
- **CA-14** : Étant donné `ThemeSwitch` et son menu, alors chaque choix est atteignable et activable au clavier seul, avec un focus visible.
- **CA-15** : Étant donné un bouton d'action à libellé, sur tout écran (Fetch, Push, Branch, Stash, Pop, Commit, Resolve, Abort, Hard reset, etc.), alors une icône au trait de 16 px, sans remplissage, précède le libellé, et le libellé reste affiché en texte.
- **CA-16** : Étant donné un changement de thème ou de palette, alors les icônes des boutons prennent la couleur du texte de leur bouton dans la nouvelle apparence.

## Interface
- Écrans concernés (`ux.md`) : `History` (`ux/ecrans/history.md`, maquette `ux/maquettes/history.html`, section 1b « ThemeSwitch ▾ → appearance ») ; pour l'application de l'apparence et les icônes de bouton, tous les écrans et dialogues de `ux.md`.
- Composants utilisés (`ux.md`) : `Toolbar`, `ThemeSwitch` (thème actif, menu ouvert), `RepoPicker` (CA-12 seulement) ; direction et tokens : `ux/direction/neon.html`, `ux/direction/neon-kraken.html`, `ux/tokens.md`.
- Composants à ajouter : aucun.

## À reporter
- Vers `stack.md` : application des tokens de `ux/tokens.md` à toute l'interface, changeable à chaud sans redémarrage ni perte d'état ; lecture de l'apparence macOS et notification de son changement pendant l'exécution ; rendu d'une lueur sur lanes, étiquettes et boutons en thème sombre ; mémorisation locale des préférences d'apparence ; jeu d'icônes au trait de 1,8 px, 16 px, sans remplissage, couvrant toutes les actions des boutons (source à choisir).

## Questions ouvertes
- aucune
