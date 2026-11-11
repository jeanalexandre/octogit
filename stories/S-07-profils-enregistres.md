# Story S-7 : Créer, enregistrer et réordonner des profils dans `ProfileSettings`

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-07-profils-enregistres.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-7 (tranche valeur 2)
- Critères couverts : `configurer-les-profils` CA-2, CA-3, CA-13, CA-14, CA-17, CA-19
- Jobs servis : J-11
- Revue renforcée : non

## Objectif
Ouvrir `ProfileSettings`, créer un premier profil, modifier et enregistrer des profils (nom, couleur, `user.name`, `user.email`, signature), les réordonner au clavier ; tout survit au relancement et rien n'est jamais écrit dans `~/.gitconfig`.

## Critères d'acceptation
- **configurer-les-profils CA-2** : Étant donné aucun profil, quand `ProfileSettings` s'ouvre, alors seul le formulaire « Create a first profile » s'affiche (Name, `user.name`, `user.email`, SSH key), `user.name` vide par défaut, rien repris de `~/.gitconfig` ; Create profile reste désactivé tant qu'un de ces champs manque.
- **configurer-les-profils CA-3** : Étant donné un profil saisi (nom, couleur, `user.name`, `user.email`, clé, signature cochée), quand je clique sur Save puis relance Octogit, alors le profil réapparaît dans la liste avec exactement ces valeurs ; Save reste désactivé si `user.name` ou `user.email` est vide.
- **configurer-les-profils CA-13** : Étant donné toute suite de créations, modifications, réordonnancements, générations de clé, tests et suppressions de profils, alors `~/.gitconfig` est identique octet pour octet avant et après.
- **configurer-les-profils CA-14** : Étant donné `ProfileSettings`, alors aucune carte « Intégration GitHub », aucun lien « Voir sur GitHub » ni aucune liste de dépôts GitHub n'apparaît ; le seul lien à GitHub est le libellé « to paste in GitHub › Settings › SSH keys » (de `ux.md`).
- **configurer-les-profils CA-17** : Étant donné les profils Pro, Perso, Client X dans cet ordre, quand je sélectionne Client X et fais Alt+↑, alors la liste devient Pro, Client X, Perso et cet ordre est conservé au relancement.
- **configurer-les-profils CA-19** : Étant donné des modifications non enregistrées sur le profil Work, quand je fais Échap, alors « Discard changes to profile Work? » propose Save, Discard et Cancel : Save enregistre puis ferme, Discard ferme sans enregistrer, Cancel reste sur `ProfileSettings` avec les modifications.

## Décisions de l'humain
### Fiche (12/11/2026)
1. Champ « SSH key » de CA-2 (option a) : S-7 l'affiche comme un chemin de clé privée saisi au clavier, obligatoire pour Create profile ; S-8 le remplace par Choose… et Generate ed25519….
2. Accès à `ProfileSettings` (option a) : S-7 livre Cmd+, seul, depuis `History` et `Welcome`, avec retour à l'écran d'origine par Échap. Le bouton Profiles de `Welcome`, l'entrée « Edit profiles… » du menu du badge et l'ouverture sur le profil actif restent à S-17.

## Contexte technique
- Dépend de S-1 (socle, `tokens.css`, `tauri-specta`, pont de test, fixtures). Premier code des profils : le crate `identity` est vide (`crates/identity/src/lib.rs`).
- `stack.md` « Données » : fichier JSON `profiles.json` (profils, ordre ; les règles arrivent en S-10) sous `OCTOGIT_DATA_DIR`, champ `version`, écriture atomique, géré par le crate `store` ; suivre le modèle de `crates/store/src/lib.rs` (migrations à la lecture, fichier d'exemple versionné dans `crates/store/tests-data/`, tests de non-écriture hors du dossier de données). Types de profil (nom, couleur, `user.name`, `user.email`, signature, chemin de clé) dans `identity` ; `app` (`src-tauri/src/commands.rs`) n'expose que des commandes, sans logique ; régénérer `src/lib/bindings.ts` par `pnpm gen:bindings`.
- `~/.gitconfig` : jamais lu ni écrit. Test Rust : un faux `HOME` temporaire dont le `.gitconfig` est comparé octet pour octet avant / après une suite de créations, modifications, réordonnancements et suppressions.
- Couleur de profil : une des 6 couleurs de lanes (`lane-1`…`lane-6`) de la palette active, `ux/tokens.md` « Couleurs de profil » et `src/lib/styles/tokens.css`.
- Interface : `src/lib/screens/ProfileSettings.svelte` (nouveau écran, nom exact de `ux.md`) avec `ProfileForm` dans `src/lib/components/` ; détail dans `ux/ecrans/profile-settings.md`, maquette `ux/maquettes/profile-settings.html` (sections 1 et 2), sections « Direction visuelle » de `ux.md` et icônes Lucide (`stack.md`). Échap : retour à l'écran d'origine, avec la confirmation « Discard changes to profile Work? » en cas de modifications non enregistrées. Réordonnancement : Alt+↑ / Alt+↓ sur le profil sélectionné.
- Routage des écrans : `src/App.svelte` (écran courant `History` / `Welcome`), entrée par Cmd+, (voir « Décisions de l'humain › Fiche »).
- Tests e2e : `e2e/helpers.ts`, pont `src/web-bridge.ts` ; un relancement se simule en rechargeant la page avec le même `OCTOGIT_DATA_DIR`.
- Hors Octogit, aucune écriture : pas de commande Git exécutée dans cette story.

## Interface à vérifier
- **Écrans et états** : `ProfileSettings` : vide « Create a first profile », profil complet enregistré, liste de 3 profils réordonnée, « Discard changes to profile Work? »
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] configurer-les-profils CA-2 → test Vitest du formulaire vide (champs, `user.name` vide, Create profile désactivé tant qu'un champ manque) + e2e
- [ ] configurer-les-profils CA-3 → test Rust du `store` (aller-retour exact, nouveau `Store` sur le même dossier) + e2e : Save, rechargement de la page, mêmes valeurs ; Save désactivé sans `user.name` ou `user.email`
- [ ] configurer-les-profils CA-13 → test Rust : `.gitconfig` d'un faux `HOME` identique octet pour octet après la suite d'opérations
- [ ] configurer-les-profils CA-14 → test Vitest : aucun texte « GitHub » dans `ProfileSettings` hormis « to paste in GitHub › Settings › SSH keys » ; pas de lien externe
- [ ] configurer-les-profils CA-17 → test Rust de l'ordre persisté + e2e Alt+↑ puis rechargement
- [ ] configurer-les-profils CA-19 → e2e : Échap avec modification ouvre le dialogue ; Save, Discard, Cancel font chacun ce que dit le critère

## Hors périmètre
- Choix, génération, empreinte et copie de la clé SSH (S-8), test de connexion (S-9), règles `MatchingRuleList` (S-10).
- Suppression de profil et propagation aux dépôts (S-13) ; menu du `ProfileBadge`, accès par le badge et « profil actif » à l'ouverture (S-17).
- Écriture dans un `.git/config` (S-10).

## Documentation à mettre à jour
- README : section « Profils » (comment ouvrir `ProfileSettings`, `profiles.json` `version` 1 sous `OCTOGIT_DATA_DIR`, aucune écriture dans `~/.gitconfig`) ; ligne `crates/identity` de « Organisation du repo » (n'est plus vide).
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : à noter au lancement de la boucle

| # | Agent | Résultat | Verdict |
|---|---|---|---|
