# UX : Octogit

> Produit par `/ux` à partir de `brief.md`. Deux pages maximum. Validé par l'humain le 23/10/2026.
> Révisions : 23/10/2026 — J-2 : comportement de Stash et Pop précisé, composant `StashButtons` ajouté (oubli relevé à la relecture).
>   23/10/2026 — suite à la révision du brief : J-3 et J-6 à J-8 sans Undo (non-objectif), J-14 ajouté (reset Soft / Mixed / Hard sur n'importe quel commit, Hard confirmé), `ResetHardDialog` ajouté.

## Contexte d'usage
- **Développeur multi-comptes, à la maison** : macOS, seul, second écran dédié ; Octogit ouvert en permanence, en plein écran, à côté de l'éditeur.
- **Développeur multi-comptes, au bureau** : macOS, seul, portable ; Octogit ouvert ponctuellement en plein écran (~1 500 px), en alternance avec l'éditeur par Cmd+Tab. Les trois colonnes de `History` tiennent à cette largeur.

## Principes d'interaction
1. Rien ne modifie le dépôt sans geste explicite : seul le fetch est automatique ; pas de pull implicite, pas d'écriture de `.git/config` sans choix.
2. Toute opération qui réécrit l'historique ou écrase nomme ce qu'elle touche (branches, commits perdus, commits distants écrasés) dans son libellé ou sa confirmation.
3. L'identité active est toujours visible (`ProfileBadge`) ; une identité non conforme bloque Commit et Push, sans échappatoire.
4. Une opération en cours reste visible sur tous les écrans (`OperationBanner`) jusqu'à sa fin ou son abandon, y compris lancée depuis le terminal.
5. Toute action fréquente a un raccourci clavier (Cmd+F, Cmd+Entrée, Échap, Alt+↑ / Alt+↓).

## Parcours
**J-1 · Voir l'historique.** Lancement → dernier dépôt ouvert dans `History` (`Welcome` au premier lancement ou si le dépôt a disparu) ; `RepoPicker` pour changer de dépôt. Fetch automatique à l'ouverture puis périodique, `FetchStatus` « fetched 2 min ago ». Graphe : lanes, branches locales et `origin/…` (même jamais récupérées), tags, stashes.
*Moment de vérité* : sans rien faire, le graphe montre les branches distantes à jour et l'avance / le retard de la branche courante.

**J-2 · Préparer un commit (modifié le 23/10/2026).** Ligne WIP (sélectionnée par défaut) → `WorkingChanges` à droite. Clic sur un fichier → `DiffView` au centre : indexer fichier, bloc ou lignes. Résumé, description, Amend, Commit (Cmd+Entrée). Stash (désactivé si l'arbre est propre, message optionnel) et Pop dans la barre d'outils : Pop applique et retire le stash sélectionné, sinon le dernier ; désactivé sans stash ; conflit → J-9. Clic droit sur un stash (barre latérale ou graphe) : Apply, Pop, Drop (confirmation).
*Moment de vérité* : « Identity matches profile Work » sous le bouton, le commit part avec le bon compte.

**J-3 · Synchroniser (modifié le 23/10/2026).** `SyncButton` : clic = action par défaut, flèche = choix entre Fetch All (défaut), Pull (fast-forward only), Pull (rebase). Pull ff refusé si divergé (« Branch has diverged: 2 local, 3 on origin. »). Geste habituel après fetch : reset sur `origin/…` (J-14), cherry-pick, ou rebase puis conflits. `PushButton` devient Force push si l'historique a été réécrit → `ForcePushDialog` (commits distants écrasés, toujours `--force-with-lease`). Tag : clic droit sur un commit.
*Moment de vérité* : après un fetch, la divergence se lit dans le graphe et rien n'a bougé sans décision.

**J-4 · Consulter un commit.** Clic sur un commit → `CommitDetail` à droite ; clic sur un fichier → `DiffView` (côte à côte ou unifié) ; Échap ramène au même endroit du graphe.
*Moment de vérité* : du graphe au diff d'un fichier en deux clics, et retour.

**J-5 · Rechercher.** `SearchBox` (Cmd+F) : message, auteur ou SHA ; résultats surlignés dans le graphe complet, Entrée / Maj+Entrée (« 3 / 12 ») ; bascule « Show matches only ».
*Moment de vérité* : un SHA collé amène directement au commit.

**J-6 · Merge ou rebase (modifié le 23/10/2026).** Clic sur une branche, clic droit sur la cible → `RefContextMenu` dont chaque libellé nomme les deux branches (« Merge develop into feature/profiles », « Rebase feature/profiles onto develop ») ; la branche qui reçoit est checkoutée si besoin ; exécution immédiate (pas d'Undo : une erreur se rattrape au terminal), conflit → J-9.
*Moment de vérité* : le libellé dit exactement ce qui va bouger.

**J-7 · Rebase interactif (modifié le 23/10/2026).** Clic droit sur un commit → `InteractiveRebase` : action par ligne, message éditable (reword, squash), réordonner par ↑ ↓ / Alt+↑ ↓ (glisser plus tard), aperçu avant / après, alerte « déjà poussé » ; Start rebase ; conflit → J-9.
*Moment de vérité* : le graphe obtenu est celui de l'aperçu.

**J-8 · Cherry-pick ou revert (modifié le 23/10/2026).** Clic droit sur un commit (même `origin/…`) ou depuis `CommitDetail` ; exécution immédiate, conflit → J-9.
*Moment de vérité* : le commit apparaît sur la branche courante sans quitter le graphe.

**J-9 · Résoudre les conflits.** `ConflictResolver` s'ouvre : fichiers en conflit / résolus / auto-fusionnés, nous · eux · résultat éditable, Mark as resolved, Continue (actif quand tout est résolu), Abort. Retour au graphe possible : `OperationBanner` reste affiché, checkout, merge, rebase et pull désactivés.
*Moment de vérité* : Continue termine l'opération et `git status` est propre.

**J-10 · Cloner.** `CloneDialog` depuis `Welcome` ou `RepoPicker` : profil d'abord (aucun par défaut), URL, dossier pré-rempli par la règle de chemin du profil ; progression ; ouverture dans `History`, `.git/config` déjà écrit.
*Moment de vérité* : le dépôt cloné committe et pousse avec le bon compte sans autre réglage.

**J-11 · Configurer les profils.** `ProfileSettings` (Cmd+, ou clic sur `ProfileBadge`) : nom, couleur, identité, clé SSH (choisir dans `~/.ssh` ou générer en ed25519), Copy public key, signature SSH, Test connection, règles par chemin ou propriétaire du remote.
*Moment de vérité* : Test connection répond « authenticated as @jag-work ».

**J-12 · Rattachement automatique.** À l'ouverture ou au clone, les règles désignent le profil, écrit dans `.git/config` local (identité, `core.sshCommand`, signature). Réglage local différent → `IdentityMismatch`, rien n'est écrit avant un choix : Overwrite, Import local config (nouveau profil ou mise à jour), Cancel (non conforme). Aucune règle → « No profile », blocage J-13 jusqu'au choix.
*Moment de vérité* : `git config user.email` dans le terminal renvoie l'adresse du profil.

**J-13 · Alerte d'identité.** Avant commit ou push, comparaison identité effective / profil ; écart → Commit et Push désactivés, attendu / trouvé affichés, action « Fix repository identity ».
*Moment de vérité* : un `user.email` modifié à la main est bloqué, puis réparé en un clic.

**J-14 · Reset (ajouté le 23/10/2026).** Clic droit sur n'importe quel commit (dont `origin/…`) → « Reset feature/profiles to here › Soft / Mixed / Hard » dans `RefContextMenu`, chaque mode décrit en une ligne (Soft : contenu gardé indexé ; Mixed : gardé non indexé ; Hard : tout perdu). Soft et Mixed s'exécutent aussitôt ; Hard ouvre `ResetHardDialog` listant ce qui sera perdu (« 2 commits and 3 modified files will be lost. »).
*Moment de vérité* : après un fetch, la branche locale rejoint `origin/…` en deux clics, en sachant ce qui disparaît.

## Écrans
| Écran | Contenu et actions | États | Maquette |
|---|---|---|---|
| `Welcome` | Dépôts récents avec profil ; Open folder, Clone, Profiles | vide (aucun profil : créer le premier) | — |
| `History` | `Toolbar`, `BranchSidebar`, `CommitGraph`, panneau `WorkingChanges` ou `CommitDetail` ; clic droit `RefContextMenu` | vide (seule la ligne WIP) · attente (progression dans le bouton) · erreur (message, détail brut) · hors ligne (fetch suspendu) · opération en cours · non conforme · sans profil | `ux/maquettes/history.html` |
| `DiffView` | Diff de travail (stage fichier / bloc / lignes) ou de commit ; fichier précédent / suivant ; Échap | binaire ou trop gros · ajout / suppression (un seul côté) | — |
| `InteractiveRebase` | `RebaseTodoList`, aperçu avant / après, alerte déjà poussé ; Reset, Cancel, Start | rien à rebaser · en cours · conflit · terminé (Force push proposé) | `ux/maquettes/interactive-rebase.html` |
| `ConflictResolver` | Fichiers par statut, `ConflictPane` ; Take ours / theirs, éditer, Mark as resolved, Continue, Abort, éditeur externe | à résoudre · tout résolu · refus de Git (message brut) | `ux/maquettes/conflict-resolver.html` |
| `ProfileSettings` | Liste des profils ; `ProfileForm`, `MatchingRuleList` | vide (premier profil) · test refusé · test OK ; dialogue `IdentityMismatch` | `ux/maquettes/profile-settings.html` |
| Dialogues | `CloneDialog`, `ForcePushDialog`, `ResetHardDialog`, `IdentityMismatch` | saisie · en cours · erreur | — |

## Composants
| Composant | Rôle | Écrans | Variantes et états |
|---|---|---|---|
| `Toolbar` | Actions globales du dépôt | History, DiffView | normal · opération en cours (actions risquées désactivées) |
| `RepoPicker` | Changer, ouvrir, cloner un dépôt | History, Welcome | récents · vide |
| `SyncButton` | Fetch / Pull, action par défaut | History | Fetch All · Pull ff-only · Pull rebase · en cours · refusé |
| `PushButton` | Push, compteur d'avance | History | normal · Force push · bloqué · en cours |
| `ProfileBadge` | Profil actif | Tous | conforme · non conforme · sans profil |
| `FetchStatus` | Fraîcheur du fetch auto | History | il y a n min · hors ligne · erreur |
| `StashButtons` | Stash, Pop (stash sélectionné, sinon le dernier) | History | actif · désactivé (arbre propre / aucun stash) |
| `SearchBox` | Recherche | History | vide · n résultats · aucun · filtre seul |
| `BranchSidebar` | Branches locales, origin, tags, stashes | History | courante · sélectionnée |
| `CommitGraph` / `CommitNode` / `RefLabel` | Graphe en lanes, nœud aux initiales cerclé couleur de branche, étiquette local / origin / tag | History | WIP · sélection · résultat · merge |
| `RefContextMenu` | Merge, rebase, cherry-pick, revert, reset, tag | History | libellés nommant les deux branches · sous-menu Reset Soft / Mixed / Hard |
| `WorkingChanges` | Stage et commit | History | fichiers · propre · bloqué · amend |
| `CommitDetail` | Détail d'un commit | History | signé · non signé · merge |
| `DiffView` | Diff côte à côte ou unifié | DiffView | travail · commit · binaire |
| `RebaseTodoList` | Actions du rebase | InteractiveRebase | pick · reword · squash · fixup · drop |
| `ConflictPane` | Nous / eux / résultat | ConflictResolver | à résoudre · résolu |
| `OperationBanner` | Opération en cours | Tous | merge · rebase · cherry-pick · revert · conflit |
| `ProfileForm` / `MatchingRuleList` | Profil et règles | ProfileSettings | vide · complet · test OK · test refusé |
| `CloneDialog` / `ForcePushDialog` / `ResetHardDialog` / `IdentityMismatch` | Dialogues | History, Welcome | voir Écrans |

## Ton et accessibilité
- **Références** : GitKraken pour le graphe (liens à angles droits et coudes arrondis, lignes teintées par branche, icônes local / origin) ; thèmes sombre, clair et système.
- **Ton** : interface en anglais ; messages courts, factuels, impersonnels, sans « you » (« Identity does not match profile Work. ») ; message brut de Git accessible en cas d'erreur.
- **Accessibilité** : tout au clavier, focus visible, texte ≥ 12 px, jamais d'information portée par la couleur seule (étiquettes sur les lanes, statut M / A / D en lettre).

## Réorganisation proposée
| Écart (maquettes du 22/10) | Proposition | Décision |
|---|---|---|
| Carte « Intégration GitHub », « Voir sur GitHub », dépôts GitHub | Retirer (non-objectif) | retenu |
| Onglets Blame et Historique du fichier | Retirer (non-objectif) | retenu |
| Avatars d'auteur | Initiales | retenu |
| Écriture `.git/config` optionnelle | Toujours, après choix en cas d'écart | retenu |
| Glisser dans le rebase | ↑ ↓ et raccourcis, glisser plus tard | retenu |
| Fetch et Pull séparés | `SyncButton` | retenu |
| Pas de Welcome, clone, recherche, bandeau d'opération | Ajouter | retenu |
