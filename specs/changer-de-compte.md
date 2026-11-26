# Spec : Changer de compte

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/changer-de-compte.md`. Validé par l'humain le 26/11/2026.
> Révisions : aucune. Décisions de l'humain du 26/11/2026 intégrées avant validation : dernier dépôt introuvable sauté (CA-13), sélecteur sur « All profiles » sans dépôt ouvert (CA-14), « No profile » sans dépôt (CA-15), ordre du sélecteur (CA-2), profil du dépôt ouvert choisi (CA-16), liste désactivée pendant une opération (CA-10).

## Objectif
Je passe d'un compte à l'autre sans chercher dans une liste mêlée. Dans `RepoPicker`, je choisis un profil : la liste des dépôts récents ne garde que les siens et son dernier dépôt ouvert s'affiche aussitôt dans `History`, avec ce profil dans `ProfileBadge`. Un profil sans dépôt me propose d'en ouvrir ou d'en cloner un avec ce profil.
- Jobs servis : J-18

## Périmètre
- **Inclus :** sélecteur de profil en tête de `RepoPicker` (profils dans l'ordre de `ProfileSettings`, puis « No profile » et « All profiles »), ouvert sur le profil du dépôt courant, sinon sur « All profiles », dans `History` et dans `Welcome` (de `ux.md`, parcours J-18) ; filtrage des récents par profil (de `ux/ecrans/communs.md`, ligne `RepoPicker`) ; ouverture sans confirmation du dernier dépôt ouvert du profil choisi, sinon du suivant présent sur le disque ; « All profiles » qui filtre sans rien ouvrir ; sélecteur et liste désactivés pendant une opération en cours (« Operation in progress. ») ; `ProfileBadge` qui reste le profil du dépôt ouvert ; état « No repositories for <profil> » de `Welcome` avec Open folder… et Clone… à profil pré-choisi, et sa variante « No repositories without a profile. » (de `ux/ecrans/welcome.md`, « Profil sans dépôt ») ; maquette du sélecteur et de l'état sans dépôt (de `ux/maquettes/history.html`, section 8).
- **Exclu :**
  - Favoris ou épinglage de dépôts, regroupement des dépôts par dossier ou par espace de travail (non-objectifs).
  - Onglets ou espaces de travail multi-dépôts (non-objectif).
  - Changement du profil rattaché à un dépôt (menu de `ProfileBadge`, « Reset to rules »), rattachement et écriture de `.git/config` à l'ouverture → `specs/proteger-l-identite.md`
  - Création et ordre des profils → `specs/configurer-les-profils.md`
  - Liste Recent de `Welcome` sans filtre, Open folder…, déroulé du clone, état « dépôt introuvable » → `specs/demarrer-un-depot.md`
  - Changement de dépôt par clic dans la liste de `RepoPicker`, fetch à l'ouverture, ligne WIP → `specs/explorer-l-historique.md`
  - Ce que désactive une opération en cours ailleurs que dans `RepoPicker` → `specs/resoudre-les-conflits.md`

## Critères d'acceptation
- **CA-1** : Étant donné `History` ouvert sur un dépôt rattaché à Pro (règle ou choix mémorisé), quand j'ouvre `RepoPicker`, alors le sélecteur de profil affiche Pro et la liste ne montre que les dépôts récents rattachés à Pro, du plus récemment ouvert au plus ancien, chacun avec son nom, son chemin et la date relative de sa dernière ouverture.
- **CA-2** : Étant donné les profils Perso puis Pro dans cet ordre dans `ProfileSettings`, quand j'ouvre le sélecteur de profil, alors il propose dans cet ordre Perso, Pro, « No profile », « All profiles » ; après réordonnancement dans `ProfileSettings`, le sélecteur suit le nouvel ordre.
- **CA-3** : Étant donné `History` sur un dépôt Pro et deux dépôts récents rattachés à Perso, `perso-a` ouvert hier et `perso-b` la semaine dernière, quand je choisis Perso, alors, sans dialogue de confirmation, `perso-a` s'affiche dans `History` dans la même fenêtre, `ProfileBadge` affiche Perso, et `RepoPicker` ne liste que `perso-a` et `perso-b`.
- **CA-4** : Étant donné un dépôt avec deux fichiers modifiés non commités et un fichier indexé, quand je choisis un autre profil puis rouvre ce dépôt, alors `git status` donne exactement le même résultat qu'avant le changement, et la liste des stashes est identique : Octogit n'a ni commité, ni stashé, ni annulé de changement.
- **CA-5** : Étant donné un dépôt ouvert par le choix d'un profil (CA-3), alors il passe en tête des récents avec la date « now », et il s'ouvre au lancement suivant d'Octogit.
- **CA-6** : Étant donné `History` sur un dépôt Pro, quand je choisis « All profiles », alors `RepoPicker` liste tous les dépôts récents, quel que soit leur profil, y compris ceux sans profil, chacun avec son `ProfileBadge` ; `History` reste sur le même dépôt et `ProfileBadge` de la barre affiche toujours Pro.
- **CA-7** : Étant donné deux dépôts récents sans profil rattaché, quand je choisis « No profile », alors `RepoPicker` ne liste que ces deux dépôts et le plus récemment ouvert s'affiche dans `History` avec `ProfileBadge` à « No profile ».
- **CA-8** : Étant donné un profil Perso auquel aucun dépôt récent n'est rattaché, quand je le choisis, alors `Welcome` s'affiche avec « No repositories for Perso », « Open a folder or clone one with this profile. », Open folder… et Clone… ; aucun dépôt ne reste affiché dans `History`.
- **CA-9** : Étant donné l'état « No repositories for Perso », quand je clique sur Clone…, alors `CloneDialog` s'ouvre avec Perso déjà sélectionné (exception à `specs/demarrer-un-depot.md` CA-8, où aucun profil n'est sélectionné) ; le profil reste modifiable avant le clic sur Clone.
- **CA-10** : Étant donné un merge, un rebase, un cherry-pick ou un revert en cours dans le dépôt ouvert, y compris lancé au terminal, quand j'ouvre `RepoPicker`, alors le sélecteur de profil et la liste des dépôts récents sont désactivés avec « Operation in progress. », et ni le choix d'un profil ni un clic sur un dépôt de la liste n'ouvre un autre dépôt ; l'opération terminée ou abandonnée, sélecteur et liste sont de nouveau actifs.
- **CA-11** : Étant donné `ProfileBadge` affichant Pro, quand je change le filtre de `RepoPicker` sans qu'un autre dépôt s'ouvre (« All profiles »), alors `ProfileBadge` affiche toujours Pro ; `ProfileBadge` n'affiche jamais « All profiles » et son menu ne filtre jamais la liste de `RepoPicker`.
- **CA-12** : Étant donné `RepoPicker` ouvert, quand j'utilise seulement le clavier, alors je peux atteindre le sélecteur de profil, choisir un profil et valider, avec un focus visible à chaque étape et le même résultat qu'à la souris (CA-3, CA-6).
- **CA-13** : Étant donné `perso-a` (ouvert hier) déplacé hors de son chemin et `perso-b` (la semaine dernière) présent, quand je choisis Perso, alors `perso-b` s'affiche dans `History` sans message « Repository not found: », et `perso-a` reste listé dans `RepoPicker` ; étant donné tous les dépôts récents de Perso introuvables, alors `Welcome` affiche « No repositories for Perso » comme en CA-8.
- **CA-14** : Étant donné `Welcome` affiché sans dépôt ouvert (premier lancement, dépôt introuvable ou profil sans dépôt), quand j'ouvre `RepoPicker`, alors le sélecteur affiche « All profiles » et la liste montre tous les dépôts récents.
- **CA-15** : Étant donné aucun dépôt récent sans profil, quand je choisis « No profile », alors `Welcome` affiche « No repositories without a profile. » avec Open folder… seulement, sans Clone… (aucun clone sans profil, `specs/demarrer-un-depot.md` CA-17).
- **CA-16** : Étant donné `History` sur un dépôt Pro, avec un commit sélectionné et le graphe défilé, quand je choisis Pro dans le sélecteur, alors aucun dépôt n'est rouvert : la sélection et la position de défilement du graphe ne changent pas, et seule la liste de `RepoPicker` est filtrée sur Pro.

## Interface
- Écrans concernés (`ux.md`, J-18) : `History` (`ux/ecrans/history.md` ; maquette `ux/maquettes/history.html`, section 8, état « RepoPicker ▾ — profile selector ») ; `Welcome` (`ux/ecrans/welcome.md`, état « Profil sans dépôt » ; maquette `ux/maquettes/history.html`, section 8, état « Profile without repository → Welcome » ; variante « No repositories without a profile. » sans maquette) ; `CloneDialog` (`ux/ecrans/dialogues.md`, ouverture à profil pré-choisi).
- Composants utilisés (`ux/ecrans/communs.md`) : `RepoPicker` (récents · filtré par profil · profil sans dépôt · sélecteur désactivé), `ProfileBadge` (conforme, « No profile »), `OperationBanner` (opération en cours, CA-10).
- Composants à ajouter : aucun.

## À reporter
- Vers `ux.md` (décisions de l'humain du 26/11/2026) : dans le parcours J-18 et dans `ux/ecrans/communs.md`, ligne `RepoPicker` : « sinon le premier de la liste » signifie que le dernier dépôt du profil introuvable sur le disque est sauté au profit du suivant présent dans la liste du profil (CA-13) ; sans dépôt ouvert (`Welcome`), le sélecteur s'ouvre sur « All profiles » (CA-14) ; « No profile » sans dépôt affiche dans `Welcome` « No repositories without a profile. » avec Open folder… seulement, sans Clone… (CA-15, à ajouter aussi dans `ux/ecrans/welcome.md`, « Profil sans dépôt ») ; pendant une opération en cours, le sélecteur et la liste de `RepoPicker` sont désactivés (« Operation in progress. »), pas seulement le sélecteur (CA-10).
- Vers `specs/demarrer-un-depot.md` (amendement) : CA-8 à préciser : depuis l'état « No repositories for <profil> », `CloneDialog` s'ouvre avec ce profil sélectionné (CA-9 de cette spec).

## Questions ouvertes
- aucune
