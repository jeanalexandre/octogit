# Story S-12 : `ProfileBadge` dans `History` et dans Recent

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-12-profile-badge.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-12 (tranche valeur 2)
- Critères couverts : `configurer-les-profils` CA-4 ; `proteger-l-identite` CA-14 ; `demarrer-un-depot` CA-2
- Jobs servis : J-11, J-12
- Revue renforcée : non

## Objectif
Afficher `ProfileBadge` (nom et couleur du profil, ou « ⚠ Work · identity mismatch ») dans `History` et sur chaque dépôt de Recent, avec la couleur du profil dans la liste de `ProfileSettings`.

## Critères d'acceptation
- **configurer-les-profils CA-4** : Étant donné un profil Pro de couleur choisie, alors la liste affiche sa pastille de cette couleur, son nom et son compte, et `ProfileBadge` affiche le même nom et la même couleur pour un dépôt rattaché à Pro.
- **proteger-l-identite CA-14** (modifié le 07/11/2026) : Étant donné un dépôt conforme au profil Work, alors `ProfileBadge` affiche le nom et la couleur de Work ; non conforme, il affiche « ⚠ Work · identity mismatch », distinct de l'état conforme par le signe et le texte, sans recours à la couleur.
- **demarrer-un-depot CA-2** : Étant donné 3 dépôts déjà ouverts, quand `Welcome` s'affiche, alors la section Recent les liste du plus récemment ouvert au plus ancien, chacun avec son nom, son chemin, la date relative de sa dernière ouverture et un `ProfileBadge` au nom du profil auquel il est rattaché, ou « No profile » s'il n'en a aucun.

## Décisions de l'humain
### Écarts du passage 1 de dev (13/11/2026)
1. Contrat : `ProfileBadgeView.conform`, `RecentView.profile`, lecture `attach::badge_of` et `open::recent_repositories_in` ; `bindings.ts` régénéré : accepté (d'office).
2. Règle de conformité : non conforme si une valeur locale diffère, ou si les valeurs du profil ne se calculent pas (`.pub` manquant d'un profil à signature) ; un dépôt auquel il ne manque que des valeurs est conforme, puisque son ouverture les écrit sans dialogue (S-10) ; Recent lit seulement la config, sans rien écrire : accepté (d'office).
3. `History` affiche « No profile » pour un dépôt sans profil (avant : aucun badge) ; assertion de `e2e/rules.spec.ts` adaptée : accepté, cohérent avec Recent (d'office).
4. « No profile » sans le signe ⚠ de la maquette, en style pointillé : accepté, la fiche ne demande que le texte ; le « No profile — choose one » complet arrive avec S-17 (d'office).
5. Ligne de Recent : bouton réduit au nom et au chemin, badge et date à côté, clic sur toute la ligne par un pseudo-élément (un `role=group` dans un `button` n'est pas exposé en accessibilité) : accepté (d'office).

### Après la revue 1
6. Problème 1 (récent introuvable rattaché par une règle de chemin affiché « ⚠ … identity mismatch ») : reporter vers S-54, qui traite le dépôt introuvable dans Recent ; ajouté à sa ligne du plan (d'office).
7. Instabilité de `src/livraison.test.ts` sous charge : pris en compte (pour information), déjà dans les notes de production.

## Contexte technique
- Dépend de S-11 : rattachement par règles et manuel (S-10, S-11), comparaison des quatre valeurs (`crates/identity`), `ProfileSettings` (S-7).
- `ProfileBadge` : `src/lib/components/ProfileBadge.svelte`, nom exact de `ux.md` ; détail `ux/ecrans/communs.md` : conforme (nom et couleur du profil), non conforme (« ⚠ Work · identity mismatch », distinct sans la couleur), « No profile ». Cette story livre le **badge affiché** : le menu du badge (profils, « Edit profiles… », « Reset to rules », « Fix repository identity ») est S-17. Le « No profile — choose one » complet (avec son action) vient avec S-17 ; ici le texte « No profile » suffit pour Recent et pour un dépôt sans profil.
- Où : en-tête de `History` (`src/lib/screens/History.svelte`, `ux/maquettes/history.html`) et chaque ligne de Recent dans `src/lib/screens/Welcome.svelte` (`ux/maquettes/welcome.html`), par le même composant. L'état d'un dépôt de Recent est calculé sans l'ouvrir dans la fenêtre : profil rattaché (manuel mémorisé, sinon règles) et conformité du `.git/config` local ; commande dans `src-tauri/src/open.rs` ou voisine, logique dans `identity`. Un dépôt introuvable n'est pas géré ici (S-54).
- `ProfileSettings` : la liste affiche pastille (couleur de lane du profil), nom et compte (`user.email`), sans compteur de dépôts (`ux/ecrans/profile-settings.md`).
- Couleurs : `src/lib/styles/tokens.css` / `ux/tokens.md` « Couleurs de profil » ; texte ≥ 12 px, jamais d'information par la couleur seule (`stack.md`). La conformité d'un dépôt de Recent peut être lue à l'affichage de `Welcome` sans geste ; ne pas ralentir l'ouverture (lecture de config seulement).
- Report de S-10 (décision 6 de sa fiche) : un profil à signature cochée dont le `.pub` manque n'écrit rien dans le dépôt, sans message ; le dépôt doit alors apparaître non conforme par ce badge (et non comme conforme ni « No profile »), avec un test.
- Fixtures : `fixtures/identity.sh` (non conforme), dépôts conformes écrits par S-10, trois dépôts pour Recent.

## Interface à vérifier
- **Écrans et états** : `History` : badge conforme et badge non conforme (« ⚠ Work · identity mismatch ») ; `Welcome` : Recent de 3 dépôts (profil, autre profil, « No profile ») ; `ProfileSettings` : liste avec pastille, nom et compte
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] configurer-les-profils CA-4 → test Vitest : la pastille de la liste et `ProfileBadge` ont le même nom et le même jeton de couleur pour Pro ; e2e : dépôt rattaché à Pro
- [ ] proteger-l-identite CA-14 → test Vitest de `ProfileBadge` (conforme : nom et couleur ; non conforme : texte « ⚠ Work · identity mismatch », signe présent, distinct sans la couleur) + test Rust de la conformité d'un dépôt + e2e sur `fixtures/identity.sh`
- [ ] demarrer-un-depot CA-2 → test Rust : 3 dépôts ouverts, Recent du plus récent au plus ancien avec profil ou « No profile » ; e2e : `Welcome` montre nom, chemin, date relative et badge de chacun

## Hors périmètre
- Menu du badge, « Reset to rules », « Fix repository identity », « No profile — choose one » actionnable (S-17).
- Blocage de Commit et de Push (S-16, S-21) ; marquage des commits fautifs (S-22).
- Dépôt introuvable dans Recent (S-54).

## Documentation à mettre à jour
- README : section « Profils » : badge de profil (états conforme, non conforme, « No profile ») dans `History` et dans Recent ; mise à jour de la description de Recent dans « Ouvrir un dépôt ».
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : 98f57bf

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (écarts 1 à 5 tranchés d'office), vérifications relancées ✅ (clippy à part) | — |
| 1 | reviewer | `stories/S-12-revue-1.md` : 1 mineur, reporté vers S-54 | validé |
