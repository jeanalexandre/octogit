# Story S-2 : Ouvrir un dépôt depuis `Welcome` et en changer par `RepoPicker`

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-02-ouvrir-un-depot.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-2 (tranche socle)
- Critères couverts : `demarrer-un-depot` CA-3, CA-4 ; `explorer-l-historique` CA-2
- Jobs servis : J-1
- Revue renforcée : non

## Objectif
Ouvrir un dépôt depuis `Welcome` (Open folder…, liste Recent) et en changer par `RepoPicker` dans `History`.

## Critères d'acceptation
- **demarrer-un-depot CA-3** : Étant donné la liste Recent, quand je clique sur un dépôt présent, alors il s'ouvre dans `History`.
- **demarrer-un-depot CA-4** : Étant donné Open folder…, quand je choisis un dossier qui est un dépôt Git, alors il s'ouvre dans `History` et apparaît en tête de Recent ; quand je choisis un dossier qui n'est pas un dépôt Git, alors un message nomme ce dossier, `Welcome` reste affiché et aucun fichier n'est créé ni modifié dans ce dossier.
- **explorer-l-historique CA-2** : Étant donné `History` affiché, quand je choisis un autre dépôt dans `RepoPicker`, alors `History` affiche le graphe de ce dépôt dans la même fenêtre.
  - Périmètre de S-2 : « le graphe » est la liste de commits simple posée en S-1.

## Décisions de l'humain
### Écarts du passage 1 (09/11/2026)
1. Format des dépôts récents : accepté (1a). `repositories.json` passe en version 2 (`recent` : liste de `{path, last_opened}`) ; un fichier version 1 est migré à la lecture, `last_opened` prenant la date de modification du fichier.

### Après la revue 1 (10/11/2026)
1. Mineur 1 (`RepoPicker` : nom coupé, chemin non tronqué dans le menu) : traiter (d'office).
2. Mineur 2 (`RepoPicker` : fermeture au clic extérieur, Escape hors focus du menu) : traiter (d'office).

### Après la revue 2 (10/11/2026)
1. Mineur 1 (`RepoPicker` : nom du déclencheur coupé sur deux lignes à faible largeur) : traiter (d'office).

## Contexte technique
- Dépend de S-1 : crates `git` (lecture `gix`) et `store` (JSON `version`, écriture atomique dans `OCTOGIT_DATA_DIR`), `app` (commandes sans logique), `src/lib/screens/Welcome`, `src/lib/screens/History`, pont de test Playwright, fixtures de dépôts, `bindings.ts` (régénéré par `pnpm gen:bindings`, jamais à la main).
- Dépôts récents : fichier JSON du domaine « dépôts » de `store` (chemin, date de dernière ouverture) ; en tête le plus récent ; le dernier dépôt ouvert est celui que S-1 relit au lancement. Évolution de schéma : champ `version`, migrations dans `store` si le format de S-1 change.
- Détection d'un dépôt Git : par le crate `git` (ouverture `gix`), sans rien écrire dans le dossier testé.
- Sélecteur de dossier macOS : plugin Tauri `dialog` appelé depuis le crate `platform` (`stack.md` « Intégrations macOS »). Non couvert par Playwright (fenêtre native) : en mode test, le pont fournit le dossier choisi à la place du sélecteur.
- Interface (`ux/ecrans/welcome.md`, `ux/ecrans/communs.md` pour `RepoPicker`, maquette `ux/maquettes/welcome.html` section 1, `ux/tokens.md` via `src/lib/styles/tokens.css`) : sur `Welcome`, section Recent (nom, chemin du dépôt, date relative de dernière ouverture) et Open folder… (Cmd+O) ; dans `History`, `RepoPicker` liste les récents et propose Open folder… ; message « dossier non Git » nommant le dossier. Le `ProfileBadge` des récents est en S-12, Clone… en S-27, Profiles en S-17 : ne pas les afficher.
- Message du dossier non Git : texte d'une ligne en anglais nommant le dossier (formulation libre, ex. « <dossier> is not a Git repository. »).

## Interface à vérifier
- **Écrans et états** : `Welcome` (Recent avec plusieurs dépôts, dossier non Git refusé) ; `History` avec `RepoPicker` ouvert (récents, changement de dépôt)
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] demarrer-un-depot CA-3 → e2e Playwright : trois dépôts récents (fixtures), clic sur l'un d'eux, `History` affiche ses commits
- [ ] demarrer-un-depot CA-4 (dépôt Git) → e2e : Open folder… (pont de test) sur une fixture, `History` s'affiche, le dépôt est en tête de Recent après retour sur `Welcome` / relance
- [ ] demarrer-un-depot CA-4 (dossier non Git) → e2e : message nommant le dossier, `Welcome` reste affiché, et l'arborescence du dossier (liste et contenu) est identique avant et après
- [ ] demarrer-un-depot CA-4 (ordre des récents) → `cargo test` du crate `store` : ouvrir un dépôt déjà présent le remonte en tête sans doublon ; la liste est relue dans l'ordre du plus récent au plus ancien
- [ ] Détection d'un dépôt → `cargo test` du crate `git` : vrai dépôt, dossier ordinaire, dossier inexistant ; aucun fichier créé
- [ ] explorer-l-historique CA-2 → e2e : depuis `History` du dépôt A, `RepoPicker` → dépôt B ; la liste affiche les commits de B dans la même page (pas de rechargement de la fenêtre)
- [ ] Composants → Vitest + Testing Library : `Welcome` (liste Recent, message), `RepoPicker` (récents, vide)

## Hors périmètre
- `ProfileBadge` et « No profile » dans Recent (S-12), Clone… et `CloneDialog` (S-27), Profiles (S-17), « Create a first profile » (stories de profils, tranche valeur 2).
- État « dépôt introuvable » (« Repository not found: », Locate…, Remove from recent) : S-54 ; ici un récent introuvable n'est pas géré au-delà de S-1.
- Graphe en lanes et refs (S-4, S-5), fetch (S-6), `notify`.
- Contrôle de Git au lancement (S-49).

## Documentation à mettre à jour
- README : section d'usage « Ouvrir un dépôt » (Open folder…, Recent, `RepoPicker`) et raccourci Cmd+O.
- `.env.example` : aucun changement attendu (à vérifier).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : `707608c`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : rouge constaté sur les tests rapides après renvoi, 7 e2e sans rouge transmis au reviewer ; écart `repositories.json` v2 décidé (1a) ; vérifications relancées ✅ | — |
| 1 | reviewer | 0 bloquant, 2 mineurs (`RepoPicker`) — `stories/S-02-revue-1.md` | validé |
| 2 | dev | terminé : mineurs 1 et 2 de la revue 1 traités, rouge constaté ; vérifications relancées ✅ | — |
| 2 | reviewer | 0 bloquant, 1 mineur (déclencheur de `RepoPicker`) — `stories/S-02-revue-2.md` | validé |
| 3 | dev | terminé : mineur 1 de la revue 2 traité (CSS seul, sans test) ; vérifications relancées ✅ | — |
| 3 | reviewer | aucun problème — `stories/S-02-revue-3.md` | validé |
