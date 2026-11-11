# Story S-6 : Fetch automatique et `FetchStatus`

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-06-fetch-automatique.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-6 (tranche valeur 1)
- Critères couverts : `explorer-l-historique` CA-3, CA-4, CA-6
- Jobs servis : J-1
- Revue renforcée : non

## Objectif
À l'ouverture d'un dépôt puis chaque minute, un fetch part sans geste en tâche de fond ; `FetchStatus` affiche l'âge du dernier fetch réussi ; aucune branche locale ni `.git/config` ne change.

## Critères d'acceptation
- **explorer-l-historique CA-3** : Étant donné une branche poussée sur `origin` par un autre clone après le dernier fetch, quand j'ouvre le dépôt, alors un fetch part sans geste de ma part et la branche apparaît dans le graphe avec une `RefLabel` en pointillés.
- **explorer-l-historique CA-4** : Étant donné un dépôt ouvert, quand 1 min s'est écoulée depuis le dernier fetch, alors un fetch part sans geste et `FetchStatus` affiche l'âge relatif du dernier fetch réussi.
- **explorer-l-historique CA-6** : Étant donné un fetch automatique terminé, alors aucune branche locale n'a bougé (aucun pull implicite) et `.git/config` n'a pas été écrit.

## Décisions de l'humain
### Fiche (10/11/2026)
1. Le fetch automatique fait un prune : une `origin/…` supprimée sur `origin` disparaît du graphe ; la branche locale qui la suivait, ses commits et sa configuration de suivi dans `.git/config` restent intacts (option b).

### Après la revue 1
1. Mineur 1, fetch sauté à la réouverture d'un dépôt : traiter (d'office). Rouvrir un dépôt, y compris celui déjà ouvert, lance son fetch d'ouverture. C'est la règle de la fiche : « un fetch à l'ouverture du dépôt ». Si un fetch du même dépôt est encore en cours, le fetch d'ouverture attend sa fin au lieu d'être sauté. Il n'y a jamais deux fetchs en même temps sur un dépôt.
2. Mineur 2, test e2e de CA-4 qui ne prouve pas que l'âge se rafraîchit : traiter (d'office). L'e2e montre l'âge qui change sans geste, par exemple avec une horloge simulée par Playwright, de « just now » à « 1 min ago ».

## Contexte technique
- Dépend de S-5 : refs et `RefLabel` (pointillés pour une distante seule), `History`, `crates/git`, contrat `pnpm gen:bindings`.
- `stack.md` « Accès à Git » : le fetch est une écriture réseau, donc par le binaire `git` en sous-processus (respecte `.git/config` local, `core.sshCommand`), dans le crate `git`, sortie brute gardée. Tâche de fond : ne bloque jamais l'interface ; un seul fetch à la fois par dépôt ; changer de dépôt (`RepoPicker`) arrête la planification de l'ancien.
- Cadence : un fetch à l'ouverture du dépôt (au lancement comme par `RepoPicker`), puis un par minute tant que le dépôt est ouvert. L'âge affiché est celui du dernier fetch **réussi** ; mise à jour de l'affichage à l'écran sans geste.
- Sans pull implicite : ni merge, ni fast-forward, ni changement de `HEAD`, de branche locale ou d'arbre de travail ; seules les refs `refs/remotes/…` (et tags distants) peuvent changer. `.git/config` n'est pas écrit (test : contenu identique avant / après).
- `FetchStatus` (`ux/ecrans/history.md`) : « il y a n min » ici ; les états hors ligne et erreur sont en S-55 : en cas d'échec ici, `FetchStatus` garde le dernier âge réussi et rien d'autre ne change (rien ne plante, aucun écrit). Le fetch ne doit pas attendre une saisie (pas de demande de mot de passe ni de confirmation d'hôte qui bloque en fond) : délai maximal raisonnable, fetch tué au-delà.
- Interface : `FetchStatus` dans la `Toolbar` de `History` (`ux/ecrans/communs.md`, `ux/maquettes/history.html`) ; l'âge relatif réutilise `src/lib/relativeTime.ts`. La `Toolbar` complète est hors périmètre : n'ajouter que l'emplacement nécessaire à `FetchStatus`.
- Tests : `fixtures/branches.sh` crée `origin` en `--bare` par chemin ; un second clone (nouvelle fixture ou assistant de test) pousse une branche vers l'`origin` après l'ouverture de la fixture ; aucun appel réseau réel ni à GitHub. Pour tester la minute sans attendre, rendre l'intervalle injectable (variable lue par le pont de test, ou paramètre de test), sans changer la valeur de production de 60 s ; la cadence de production est testée à l'unité.
- Données : aucune persistance nouvelle attendue (l'âge du dernier fetch peut rester en mémoire).

## Interface à vérifier
- **Écrans et états** : `History` avec `FetchStatus` (âge après le premier fetch, âge qui avance), nouvelle branche distante apparaissant en pointillés sans geste
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] explorer-l-historique CA-3 → e2e : `origin` reçoit une branche d'un autre clone, ouverture du dépôt, la branche apparaît en `RefLabel` pointillés sans geste ; test Rust du fetch sur un `origin` bare
- [ ] explorer-l-historique CA-4 → test unitaire de la planification (ouverture puis 60 s, un seul fetch à la fois) et e2e avec intervalle injecté : un fetch repart et `FetchStatus` affiche l'âge relatif du dernier succès
- [ ] explorer-l-historique CA-6 → test Rust : après fetch, branches locales, `HEAD`, arbre de travail et `.git/config` inchangés alors que la distante a avancé

## Hors périmètre
- États hors ligne et erreur de `FetchStatus`, réseau coupé (S-55, CA-5).
- `SyncButton`, Fetch All avec prune par geste, Pull, Push (S-18 et suivantes).
- Détection des changements de fichiers (`notify`, S-14).
- Profils et clé SSH imposée (S-10) : le fetch utilise ce que `.git/config` contient déjà.

## Documentation à mettre à jour
- README : indiquer que le fetch automatique tourne à l'ouverture puis chaque minute et ne modifie jamais les branches locales (section d'usage, s'il y en a une).
- `.env.example` : variable d'intervalle de test seulement si elle est lue par l'application ; sinon aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : b7f4e40

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé ; vérifications relancées ✅ | — |
| 1 | reviewer | `stories/S-06-revue-1.md` : 2 mineurs | validé |
| 2 | dev | terminé (mineurs 1 et 2 traités) ; vérifications relancées ✅ | — |
| 2 | reviewer | `stories/S-06-revue-2.md` : aucun problème | validé |
