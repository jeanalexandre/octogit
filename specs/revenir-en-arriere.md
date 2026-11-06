# Spec : Revenir en arrière

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/revenir-en-arriere.md`. Validé par l'humain le 06/11/2026.
> Révisions : 07/11/2026, renvoi « gérer les branches (checkout, Branch here) » mis à jour vers `specs/gerer-les-branches.md` ; report « Vers `brief.md` : J-16 à ajouter » retiré (traité : J-16 ajouté au brief le 06/11/2026) ; aucun critère modifié.

## Objectif
Depuis `History`, je fais un clic droit sur un commit, même `origin/…`, ou j'ouvre son `CommitDetail`. Je le reporte sur ma branche courante par un cherry-pick, ou je l'annule par un revert, tout de suite, sans quitter le graphe. Je peux aussi ramener ma branche courante sur ce commit en choisissant ce que je garde (Soft, Mixed, Hard). Un Hard reset me montre d'abord ce qui sera perdu. Je corrige sans terminal.
- Jobs servis : J-8, J-14

## Périmètre
- **Inclus :** entrées Cherry-pick et Revert du menu contextuel d'un commit (nœud, ligne ou `RefLabel` qui le désigne, dont `origin/…`) et boutons Cherry-pick et Revert de `CommitDetail` (repris de `specs/explorer-l-historique.md`, `specs/integrer-une-branche.md`, `specs/synchroniser.md`, `specs/nettoyer-une-branche.md`, `specs/proteger-l-identite.md` et `specs/resoudre-les-conflits.md`, renvoi « actions du `RefContextMenu` et de `CommitDetail` (cherry-pick, revert, reset) ») ; exécution immédiate ; arrêt en opération en cours sur conflit ; sous-menu « Reset <branche courante> to here › Soft / Mixed / Hard », chaque mode décrit en une ligne ; Soft et Mixed immédiats ; `ResetHardDialog` ; refus en HEAD détachée, avec modifications non commitées (cherry-pick, revert), cherry-pick vide, erreurs de Git ; Cherry-pick et Revert désactivés sur un commit de merge ; Reset désactivé pendant une opération en cours.
- **Exclu :**
  - Annulation (Undo) d'un cherry-pick, d'un revert ou d'un reset (non-objectif) : une erreur se rattrape au terminal.
  - Choix du parent pour le cherry-pick ou le revert d'un commit de merge : les deux sont désactivés (CA-20).
  - Refus du cherry-pick et du revert pour identité non conforme ou « No profile », auteur et committer d'un commit repris → `specs/proteger-l-identite.md` (CA-16, CA-20, CA-21)
  - Conflits, Continue, Abort, `OperationBanner`, désactivation du cherry-pick et du revert pendant une opération → `specs/resoudre-les-conflits.md` (CA-1, CA-10, CA-11, CA-16)
  - Force push après reset de commits déjà poussés → `specs/synchroniser.md` (CA-16, CA-17)
  - Merge et rebase depuis le `RefContextMenu` → `specs/integrer-une-branche.md` ; rebase interactif → `specs/nettoyer-une-branche.md` ; tags → `specs/synchroniser.md`
  - Gérer les branches (checkout, Branch here) → `specs/gerer-les-branches.md`

## Critères d'acceptation
- **CA-1** : Étant donné `History` et `feature/profiles` courante, quand je fais un clic droit sur un commit, y compris un commit désigné seulement par `origin/…`, alors le menu propose Cherry-pick, Revert et « Reset feature/profiles to here › » ; étant donné ce commit sélectionné, alors `CommitDetail` propose les boutons Cherry-pick et Revert.
- **CA-2** : Étant donné le commit `a3f9c21` absent de `feature/profiles`, sans conflit, quand je choisis Cherry-pick, alors, sans dialogue ni confirmation, `feature/profiles` pointe sur un nouveau commit enfant de son ancien sommet, de même message et mêmes changements que `a3f9c21` ; le graphe l'affiche aussitôt, sans changer d'écran.
- **CA-3** : Étant donné le commit `a3f9c21` sur `feature/profiles`, sans conflit, quand je choisis Revert, alors, sans dialogue ni confirmation, `feature/profiles` pointe sur un nouveau commit qui inverse exactement les changements de `a3f9c21`, avec le message par défaut de Git (« Revert "<résumé>" », puis « This reverts commit <SHA complet>. ») ; le graphe l'affiche aussitôt.
- **CA-4** : Étant donné le commit créé en CA-2, alors il garde l'auteur d'origine (nom, adresse, date) ; étant donné celui créé en CA-3, alors son auteur est l'identité du profil ; dans les deux cas, le committer est l'identité du profil du dépôt et le commit est signé si ce profil signe ; `git log -1 --format=fuller` le confirme dans le terminal.
- **CA-5** : Étant donné un cherry-pick ou un revert qui produit un conflit, alors l'opération s'arrête en cherry-pick ou revert en cours, aucun commit n'est créé, et `ConflictResolver` prend le relais (`specs/resoudre-les-conflits.md`, CA-1) ; `git status` dans le terminal indique la même opération en cours.
- **CA-6** : Étant donné un commit dont les changements sont déjà tous présents sur la branche courante, quand je choisis Cherry-pick, alors un message d'une ligne dit que le commit n'apporte aucun changement ; aucun commit n'est créé, aucune opération ne reste en cours (`git status`), branches, index et arbre de travail ne changent pas.
- **CA-7** : Étant donné des modifications non commitées, indexées ou non, quand je lance un cherry-pick ou un revert, alors il est refusé avec un message qui demande de committer ou de stasher ; branches, index et arbre de travail ne changent pas.
- **CA-8** : Étant donné un cherry-pick ou un revert refusé par Git pour une autre raison, alors un message d'une ligne s'affiche et « Details » montre la sortie brute de Git ; aucune opération ne reste en cours.
- **CA-9** : Étant donné un dépôt en HEAD détachée, alors Cherry-pick, Revert et le sous-menu Reset sont désactivés avec la raison « No current branch. », dans le menu comme dans `CommitDetail` ; aucun raccourci ne les lance.
- **CA-10** : Étant donné le sous-menu « Reset feature/profiles to here › », alors il propose Soft, Mixed et Hard, chacun suivi d'une ligne qui dit ce qui est gardé (« Soft — keep changes staged », « Mixed — keep changes unstaged », « Hard — discard everything… »).
- **CA-11** : Étant donné `feature/profiles` 2 commits au-dessus de `c41d8e0`, quand je choisis Soft sur `c41d8e0`, alors, sans dialogue, `feature/profiles` pointe sur `c41d8e0`, l'arbre de travail est inchangé, et `git diff --cached` montre les changements des 2 commits retirés en plus de ce qui était déjà indexé.
- **CA-12** : Étant donné la même situation, quand je choisis Mixed, alors, sans dialogue, `feature/profiles` pointe sur `c41d8e0`, l'arbre de travail est inchangé, rien n'est indexé, et `git diff` montre les changements des 2 commits retirés et les modifications d'avant.
- **CA-13** : Étant donné la même situation et 3 fichiers suivis modifiés, quand je choisis Hard, alors `ResetHardDialog` s'ouvre sans rien modifier : titre « Hard reset feature/profiles to c41d8e0? », « 2 commits and 3 modified files will be lost. », la liste des 2 commits (SHA abrégé, résumé) et des 3 fichiers (statut en lettre, chemin), Cancel et Hard reset. Étant donné rien à perdre, alors le dialogue s'ouvre et dit qu'aucun commit ni fichier ne sera perdu.
- **CA-14** : Étant donné `ResetHardDialog`, quand je confirme Hard reset, alors `feature/profiles` pointe sur `c41d8e0`, l'index et les fichiers suivis sont identiques à `c41d8e0` (`git status` ne liste aucun fichier suivi modifié), et les fichiers non suivis sont inchangés. Quand je clique sur Cancel ou fais Échap, alors branches, index et arbre de travail ne changent pas.
- **CA-15** : Étant donné `feature/profiles` en retard sur `origin/feature/profiles` après un fetch, quand je fais un clic droit sur `origin/feature/profiles` puis choisis un mode de reset, alors `feature/profiles` pointe sur le même commit que `origin/feature/profiles` et l'indicateur d'avance / retard affiche 0 / 0, en deux clics pour Soft ou Mixed, plus la confirmation pour Hard.
- **CA-16** : Étant donné un reset qui retire des commits déjà poussés, alors `PushButton` affiche « Force push » (`specs/synchroniser.md`, CA-16) ; rien n'est poussé.
- **CA-17** : Étant donné un cherry-pick, un revert ou un reset terminé, alors aucune branche distante n'a changé, aucune autre branche locale n'a bougé, et rien n'a été poussé.
- **CA-18** : Étant donné un dépôt non conforme ou « No profile », alors Soft, Mixed et Hard restent disponibles, car ils ne créent aucun commit.
- **CA-19** : Étant donné le focus sur un commit, alors le menu contextuel s'ouvre au clavier, et Cherry-pick, Revert et chaque mode de Reset se choisissent et se lancent au clavier ; dans `ResetHardDialog`, Cancel et Hard reset s'atteignent au clavier, avec un focus visible.
- **CA-20** : Étant donné un commit de merge, alors Cherry-pick et Revert sont désactivés avec la raison « Merge commits cannot be cherry-picked or reverted. », dans le menu comme dans `CommitDetail` ; aucun raccourci ne les lance ; le sous-menu Reset reste disponible.
- **CA-21** : Étant donné un merge, un rebase, un cherry-pick ou un revert en cours, y compris lancé depuis le terminal, alors Soft, Mixed et Hard sont désactivés avec la raison « Operation in progress. » ; aucun raccourci ne les lance ; ils redeviennent actifs après Continue ou Abort (`specs/resoudre-les-conflits.md`, CA-8 à CA-11).

## Interface
- Écrans concernés (`ux.md`) : `History` (`ux/ecrans/history.md`, maquette `ux/maquettes/history.html` : section 2 « Commit selected → CommitDetail », section 3 « Right-click on origin/feature/profiles → Reset », « ResetHardDialog ») ; Dialogues (`ux/ecrans/dialogues.md`) : `ResetHardDialog` ; `ConflictResolver` (prise de relais seulement).
- Composants utilisés (`ux.md`) : `RefContextMenu` (cherry-pick, revert, sous-menu Reset Soft / Mixed / Hard), `CommitDetail` (Cherry-pick, Revert), `CommitGraph` / `CommitNode` / `RefLabel` (clic droit), `ResetHardDialog`, `PushButton` (Force push, affiché seulement), `OperationBanner` (affiché, non modifié).
- Composants à ajouter : raisons des entrées désactivées « No current branch. » (CA-9), « Merge commits cannot be cherry-picked or reverted. » (CA-20), « Operation in progress. » (CA-21) ; messages de cherry-pick vide (CA-6), de refus pour modifications non commitées (CA-7), d'erreur avec Details (CA-8) ; état « rien à perdre » de `ResetHardDialog` (CA-13).

## À reporter
- Vers `stack.md` : cherry-pick qui garde l'auteur d'origine ; revert avec le message par défaut de Git ; tous deux avec le committer et la signature du `.git/config` local ; cherry-pick vide détecté sans laisser d'opération en cours ; reset soft, mixed et hard de la branche courante sur n'importe quel commit, distant compris ; calcul, avant un hard reset, des commits retirés de la branche et des fichiers suivis modifiés ; reconnaissance d'un commit de merge ; sortie brute de Git conservée pour Details.
- Vers `ux.md` :
  - Sans maquette : entrées Cherry-pick et Revert du `RefContextMenu`, états désactivés (HEAD détachée, commit de merge, opération en cours), messages de CA-6 à CA-8, état « rien à perdre » de `ResetHardDialog`.
  - `ResetHardDialog` ne compte que les fichiers suivis ; les fichiers non suivis sont gardés et non listés (CA-14).
  - Cherry-pick et revert refusés avec des modifications non commitées, comme le merge et le rebase (CA-7).
  - Cherry-pick et revert désactivés sur un commit de merge, sans choix du parent (CA-20) ; Reset désactivé pendant une opération en cours (CA-21).
  - Checkout et Branch here de `CommitDetail` relèvent de J-16 et de `specs/gerer-les-branches.md`.
- Vers `specs/resoudre-les-conflits.md` (amendement par `/spec`) : CA-16 ne liste pas le reset parmi les actions désactivées pendant une opération en cours ; il doit l'ajouter (Soft, Mixed, Hard), en cohérence avec CA-21 de cette spec.

## Questions ouvertes
- aucune
