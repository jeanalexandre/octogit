# Spec : Nettoyer une branche

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/nettoyer-une-branche.md`. Validé par l'humain le 06/11/2026.
> Révisions : 06/11/2026, renvoi des actions du `RefContextMenu` et de `CommitDetail` (cherry-pick, revert, reset) mis à jour vers `specs/revenir-en-arriere.md` ; aucun critère modifié.
> Révisions : 07/11/2026, section « À reporter → Vers `ux.md` » et ligne « Composants à ajouter » retirées : tout est intégré à `ux.md` (J-7), `ux/ecrans/interactive-rebase.md` et `ux/maquettes/interactive-rebase.html` (révision du 06/11/2026) ; section Interface alignée ; exclusion de la désactivation pendant une opération précisée (entrée sans raison affichée, `specs/resoudre-les-conflits.md` CA-16, décision de l'humain du 07/11/2026) ; aucun critère modifié. Validé par l'humain le 07/11/2026.

## Objectif
Depuis `History`, je fais un clic droit sur un commit de ma branche courante et j'ouvre `InteractiveRebase`. Pour ce commit et tous les suivants, je choisis une action (pick, reword, squash, fixup, drop), j'édite les messages et je réordonne au clavier. Un aperçu avant / après me montre le résultat, et une alerte me prévient si des commits sont déjà poussés. Start rebase réécrit la branche sans que j'édite de fichier todo, et le graphe obtenu est celui de l'aperçu.
- Jobs servis : J-7

## Périmètre
- **Inclus :** entrée « Interactive rebase from here » du menu contextuel d'un commit : le commit cliqué est inclus, la base est son parent ; entrée désactivée en HEAD détachée et sur le commit racine ; refus pour une plage qui contient un commit de merge ; `InteractiveRebase` : `RebaseTodoList` (plus ancien en haut), action par ligne (pick, reword, squash, fixup, drop) au menu ou par raccourci (p r s f d), message éditable pour reword, message combiné éditable pour squash ; réordonner par Alt+↑ ↓ et par les boutons ↑ ↓ de la ligne, sans glisser-déposer (de `ux.md`, « Réorganisation proposée », ligne « Glisser dans le rebase ») ; aperçu avant / après ; alerte « déjà poussé » ; Reset, Cancel, Back to graph (Échap), Start rebase ; états en cours et terminé ; refus du lancement avec des modifications non commitées.
- **Exclu :**
  - Glisser-déposer pour réordonner (non-objectif) ; Undo après le rebase (non-objectif).
  - Aplatissement des commits de merge : une plage qui en contient est refusée (CA-3).
  - Rebase depuis la racine : l'entrée est désactivée sur le commit racine (CA-2).
  - Refus de Start rebase pour identité non conforme ou « No profile » → `specs/proteger-l-identite.md` (CA-16).
  - Conflits, Continue, Abort, `OperationBanner` et désactivation des actions pendant le rebase → `specs/resoudre-les-conflits.md` (CA-9, CA-11, CA-13, CA-16) ; pendant une opération en cours, l'entrée « Interactive rebase from here » y est désactivée sans raison affichée (CA-16, décision de l'humain du 07/11/2026).
  - Force push et `ForcePushDialog` après réécriture de commits déjà poussés → `specs/synchroniser.md` (CA-16).
  - Rebase d'une branche sur une autre depuis le `RefContextMenu` → `specs/integrer-une-branche.md`.
  - Actions du `RefContextMenu` et de `CommitDetail` (cherry-pick, revert, reset) → `specs/revenir-en-arriere.md`.
  - Commandes `edit`, `exec`, `break` et `label` de Git : absentes de J-7.

## Critères d'acceptation
- **CA-1** : Étant donné `History` et un commit C ancêtre de la branche courante ou sommet de celle-ci, quand je fais un clic droit sur C, alors le menu propose « Interactive rebase from here » ; quand je la choisis, alors `InteractiveRebase` s'ouvre, son titre nomme la branche courante et la base, parent de C (SHA abrégé), et `RebaseTodoList` liste C et tous les commits suivants jusqu'au sommet de la branche, du plus ancien (C) en haut au plus récent, chacun en pick, avec son résumé, ses initiales d'auteur et son SHA abrégé.
- **CA-2** : Étant donné un commit qui n'est ni ancêtre ni sommet de la branche courante, alors l'entrée « Interactive rebase from here » est désactivée. Étant donné un dépôt en HEAD détachée, alors l'entrée est désactivée pour tout commit, avec la raison « No current branch. ». Étant donné le commit racine (sans parent), alors l'entrée est désactivée avec la raison « Root commit cannot be rebased. ». Dans ces trois cas, aucun raccourci ne lance le rebase interactif.
- **CA-3** : Étant donné une plage (C et les commits suivants) qui contient un commit de merge, quand je choisis « Interactive rebase from here », alors le rebase interactif est refusé avec un message qui nomme le merge par son SHA abrégé (ex. « Range contains a merge commit (c41d8e0). Choose a later starting commit. ») ; `git log`, les branches, l'index et l'arbre de travail sont inchangés, et aucun rebase n'est en cours.
- **CA-4** : Étant donné une ligne sélectionnée, quand je choisis une action dans son menu ou tape p, r, s, f ou d, alors l'action de la ligne devient pick, reword, squash, fixup ou drop, lisible sans la couleur ; une ligne drop a son résumé barré ; une ligne squash ou fixup est indentée sous le commit qu'elle rejoint.
- **CA-5** : Étant donné une ligne en reword, alors un champ « New message » pré-rempli du message d'origine s'affiche sous la ligne et reste éditable. Étant donné au moins une ligne en squash, alors un champ affiche les messages combinés des commits réunis, dans l'ordre de la liste, et reste éditable.
- **CA-6** : Étant donné une ligne sélectionnée, quand je fais Alt+↑ ou Alt+↓, ou clique sur son bouton ↑ ou ↓, alors elle échange sa place avec la ligne voisine et reste sélectionnée ; ↑ et ↓ seuls changent la ligne sélectionnée. Quand je fais glisser une ligne à la souris, alors l'ordre ne change pas.
- **CA-7** : Étant donné une composition qui place un squash ou un fixup en première ligne, ou un message de reword ou de squash vide, alors Start rebase est désactivé et la raison s'affiche ; dès que la cause disparaît, Start rebase redevient actif.
- **CA-8** : Étant donné toute modification de la liste, alors l'aperçu se met à jour sans autre geste : « Before · n commits » liste les commits d'origine, « After · m commits » liste, dans l'ordre, les résumés des commits qui seront produits, puis la base.
- **CA-9** : Étant donné des commits de la plage déjà présents sur la branche distante suivie, alors l'alerte « <k> commits already pushed to <remote>/<branche>: a force push will be needed. » s'affiche, avec k exact ; sans commit déjà poussé ou sans branche suivie, aucune alerte.
- **CA-10** : Étant donné une liste modifiée, quand je clique sur Reset, alors la liste, les actions et les messages reviennent à leur état d'ouverture. Quand je clique sur Cancel, fais Échap ou clique sur Back to graph, alors `History` s'affiche ; `git log`, les branches, l'index et l'arbre de travail sont inchangés, et aucun rebase n'est en cours.
- **CA-11** : Étant donné des modifications non commitées, quand je clique sur Start rebase, alors le rebase est refusé avec un message qui le dit ; `git log`, les branches, l'index et l'arbre de travail sont inchangés.
- **CA-12** : Étant donné une composition valide, quand je clique sur Start rebase, alors aucun éditeur ni fichier todo ne s'ouvre ; pendant l'exécution, `OperationBanner` affiche « Rebase in progress » et l'étape (« i / n ») ; un conflit ouvre `ConflictResolver` (`specs/resoudre-les-conflits.md`, CA-1).
- **CA-13** : Étant donné un rebase terminé, alors l'écran affiche « ✓ Rebase complete · n → m commits. » et `History` montre la branche réécrite : ses commits depuis la base correspondent un à un, dans l'ordre et par message, à la colonne « After » de l'aperçu ; dans le terminal, `git log` le confirme et `git status` n'indique aucune opération en cours.
- **CA-14** : Étant donné un rebase terminé, alors chaque commit réécrit garde son auteur d'origine (nom, adresse, date), un commit en squash ou fixup garde l'auteur du commit qu'il rejoint, le contenu final de l'arbre est celui qu'impose la composition, et les commits réécrits ont le profil du dépôt comme committer et sont signés selon ce profil.
- **CA-15** : Étant donné un rebase terminé, alors aucune branche distante n'a changé et rien n'a été poussé ; si des commits réécrits étaient déjà poussés, `PushButton` affiche « Force push » (`specs/synchroniser.md`, CA-16).
- **CA-16** : Étant donné `InteractiveRebase`, alors ces actions se font au clavier, avec un focus visible : sélection d'une ligne, choix de l'action, édition d'un message, déplacement, Reset, Cancel, Start rebase.

## Interface
- Écrans concernés (`ux.md`, J-7) : `InteractiveRebase` (`ux/ecrans/interactive-rebase.md` : titre avec branche courante et SHA abrégé de la base ; clavier ↑ ↓ sélection, Alt+↑ ↓ ou boutons ↑ ↓ déplacement, p r s f d ; états composition, Start rebase désactivé avec raison, refusé (modifications non commitées, plage avec merge), entrée désactivée (HEAD détachée, commit racine), non conforme ou « No profile », en cours avec Continue et Abort, conflit, terminé ; maquette `ux/maquettes/interactive-rebase.html` : « Composing the rebase », « Running », « Conflict → ConflictResolver », « Done », où ⌥↑ ⌥↓ est Alt+↑ ↓ sur macOS) ; `History` (menu contextuel d'un commit, graphe après rebase).
- Composants utilisés (`ux.md`) : `RebaseTodoList` (pick · reword (« New message ») · squash · fixup · drop), `RefContextMenu`, `CommitGraph` / `CommitNode`, `OperationBanner` (rebase), `PushButton` (Force push, affiché seulement), `ProfileBadge` (affiché).

## À reporter
- Vers `stack.md` : il faut pouvoir lancer un rebase interactif à partir d'une liste d'actions et de messages composée par Octogit, sans éditeur ni fichier todo à éditer par l'humain, avec le profil du dépôt comme committer et sa signature ; calculer l'aperçu (commits produits, dans l'ordre) avant exécution ; détecter un commit de merge dans une plage ; savoir quels commits d'une plage sont présents sur la branche distante suivie.

## Questions ouvertes
- aucune
