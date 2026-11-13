# octogit

Octogit est un client Git de bureau pour macOS : il explore l'historique d'un dépôt et protège l'identité de commit selon le profil choisi.
Application Tauri 2 (cœur Rust) avec une interface Svelte 5.

## Prérequis

- macOS 13 ou plus récent, puce Apple
- Rust, version fixée par `rust-toolchain.toml` (installée par `rustup`)
- Node 26.13.0 (fixé par `.nvmrc` : `nvm install`) et pnpm 12.18.0 (`npm i -g pnpm@12` ; corepack ne lance pas pnpm 12)
- le binaire `git` (Command Line Tools de Xcode, Xcode ou Homebrew)
- `cargo-audit` pour `pnpm audit:deps` (`cargo install cargo-audit`)

## Installation

```sh
pnpm install
```

## Lancement

- `pnpm tauri dev` : l'application dans sa fenêtre ; régénère `src/lib/bindings.ts`.
- `pnpm dev:web` : l'interface seule sur `http://localhost:1420` (ou `OCTOGIT_PORT` de `.env.local`) dans le navigateur, avec un pont local qui exécute les vraies commandes Rust (utilisé par Playwright et les captures de revue).

## Ouvrir un dépôt

- Depuis `Welcome` : **Open folder…** (Cmd+O) ouvre le sélecteur de dossier ; la liste **Recent** (nom, chemin, date relative de dernière ouverture, et `ProfileBadge` du profil rattaché ou « No profile »), du plus récent au plus ancien, ouvre un dépôt d'un clic. L'état du badge de chaque récent est lu sans ouvrir le dépôt et sans rien écrire (profil manuel mémorisé, sinon règles ; lecture du `.git/config` local).
- Un dossier qui n'est pas un dépôt Git est refusé par un message qui le nomme ; rien n'est écrit dans ce dossier.
- Dans `History`, le sélecteur de dépôt (`RepoPicker`, le nom du dépôt en haut à gauche) liste les récents et propose aussi **Open folder…** pour changer de dépôt dans la même fenêtre.
- Le dépôt ouvert passe en tête de Recent ; au lancement, Octogit rouvre le dernier dépôt ouvert (`repositories.json`, version 4 ; les versions 1 à 3 sont migrées à la lecture).
- En test (`pnpm dev:web`, Playwright), le sélecteur natif est remplacé par le dossier posé dans `window.__octogitChosenFolder`.

## Graphe de `History`

- Le graphe est une liste virtualisée (seules les lignes visibles, plus quelques-unes de marge, existent dans le DOM) : lanes colorées tracées en SVG par ligne, nœuds en cercle aux initiales de l'auteur (un stash : carré à icône d'archive, sans initiales), dates relatives (heure absolue au survol), barre d'aide en pied. Jusqu'à 10 000 commits sont lus.
- Un clic droit sur l'en-tête (au clavier : touche menu ou Maj+F10 depuis l'en-tête qui a le focus) masque ou réaffiche les colonnes auteur, date et SHA ; le choix est gardé dans `preferences.json` (champ `hidden_columns`) sous `OCTOGIT_DATA_DIR`.
- Le graphe part de HEAD et de toutes les refs (branches locales, `origin/…`, tags, stashes) ; chaque ref est une étiquette (`RefLabel`) dans la colonne de gauche, reliée par un fil au nœud de son commit, et une entrée de `BranchSidebar`. Le stash est un nœud dont seul le premier parent est gardé. L'avance et le retard de la branche courante sur sa branche distante suivie (`branch.<nom>.remote` et `.merge`) s'affichent en en-tête ; sans suivi, rien.
- La colonne des refs garde 180 px. Chaque commit n'y montre qu'une `RefLabel`, la prioritaire (courante, sinon locale, sinon distante seule, sinon tag), tronquée en fin par « … », suivie de « +n » pour les n autres refs ; une locale et son `origin/…` sur le même commit restent une seule étiquette à deux icônes. Au survol ou au focus clavier de l'étiquette, toutes les étiquettes de la ligne s'affichent entières, empilées par-dessus le graphe, dans leur variante. Le nom d'auteur est focalisable et son infobulle affiche « Nom <adresse> » (au survol et au focus).
- Un clic sur un commit ouvre `CommitDetail` à droite : message, auteur, date, SHA, « Signed » (en-tête `gpgsig` présent, validité non vérifiée) ou « Not signed », fichiers modifiés en M / A / D (merge : par rapport au premier parent ; renommages non détectés).
- `BranchSidebar` montre ses sections dans l'ordre fixe Local, `origin`, les autres remotes par ordre alphabétique, Tags, Stashes. Les noms sont groupés par chemin en dossiers dépliables (`feat/ui/x` : dossier « feat · 3 » contenant le dossier « ui · 1 »), avec le compte de toutes les refs dessous ; à chaque niveau, les dossiers viennent avant les noms. Seuls les dossiers sont triés par ordre alphanumérique sans tenir compte de la casse ; tous les autres éléments (branches locales et distantes, tags, stashes) vont du plus récent au plus ancien (date du commit désigné, à date égale par nom), la branche courante à sa place dans cet ordre ; un dossier ne prend pas la date de son élément le plus récent. Les stashes ne sont pas groupés. Les dossiers sont dépliés par défaut ; un clic les replie ou les déplie.
- L'état des dossiers est mémorisé par dépôt dans `repositories.json` (champ `collapsed_folders` : chemin du dépôt, puis clés `section:chemin` des dossiers repliés), écrit à chaque clic ; un échec d'écriture est ignoré. Le fichier est en `version` 4 (voir la largeur du graphe plus bas) ; les versions 1 à 3 sont migrées à la lecture (exemples versionnés dans `crates/store/tests-data/`).
- Largeur du graphe : la colonne des lanes affiche par défaut toutes les lanes du dépôt, dans la limite de 40 % de la zone du graphe (la liste des commits : colonne des refs, lanes, message, sans `BranchSidebar` ni panneau de droite). Quand des lanes dépassent, elles sont coupées et un fondu (dégradé vers la surface, sans couleur propre) au bord droit les signale. Cette largeur par défaut est calculée à l'ouverture du dépôt puis figée : un fetch qui ajoute des lanes ne la change pas (les nouvelles sont coupées, avec le fondu) ; rouvrir le dépôt la recalcule.
- Le séparateur entre le graphe et le message (rôle `separator`, `aria-label` « Resize graph ») se glisse à la souris (la largeur suit le pointeur, écrite à la fin du glisser) ou se règle au clavier (focus, flèches gauche et droite : une lane par appui). Un double-clic dessus revient au défaut, recalculé sur les lanes présentes. La largeur réglée est mémorisée par dépôt dans `repositories.json` (champ `graph_widths` : chemin du dépôt, puis largeur en pixels ; absent : défaut), un échec d'écriture est ignoré.
- Chaque section de `BranchSidebar` prend la hauteur de ses lignes (une ligne de dossier compte comme une ligne), 8 lignes au plus : au-delà, elle défile seule. Cette hauteur par défaut est calculée à l'ouverture du dépôt puis figée (un fetch qui ajoute une branche ne la change pas ; rouvrir le dépôt la recalcule). La branche courante est amenée en vue à l'ouverture. Une section vide n'affiche que son en-tête.
- Le bord bas d'une section se glisse à la souris (la hauteur suit le pointeur, écrite à la fin du glisser) ou se règle au clavier (rôle `separator`, focusable, flèches haut et bas : une ligne par appui). Un double-clic sur ce bord revient à la hauteur par défaut, recalculée sur les lignes présentes. Un clic sur l'en-tête d'une section la replie (en-tête seul) ou la déplie, écrit tout de suite. Replier une section ou un dossier ne retire aucune ref du graphe.
- Hauteurs et repli des sections sont globaux (communs à tous les dépôts), dans `preferences.json` : `section_heights` (hauteur en pixels par identifiant de section : `local`, `remote:<nom>`, `tags`, `stashes` ; absent : hauteur par défaut) et `collapsed_sections` (identifiants des sections repliées), avec `hidden_columns`. Le fichier passe en `version` 3 ; les versions 1 (colonnes seules) et 2 sont migrées à la lecture (exemples versionnés dans `crates/store/tests-data/`). Un échec d'écriture est ignoré.
- Le bouton en tête de `BranchSidebar` replie le panneau en une bande d'une icône par section (Local, chaque remote, Tags, Stashes ; le nom de la section est l'infobulle et l'étiquette accessible) ; le bouton de la bande le rétablit. Aucun raccourci clavier ne le replie. L'état est global (tous les dépôts), écrit au clic dans `preferences.json` (`panel_collapsed`).
- Panneau replié, un clic sur une icône ouvre la section dans un volet flottant posé par-dessus le graphe (le graphe ne bouge ni ne change de taille), avec les mêmes gestes que le panneau. Échap (le focus revient à l'icône) ou un clic hors du volet le ferme ; la fermeture au checkout viendra avec le double-clic de checkout.
- Dépôt avec toutes les refs : `fixtures/refs.sh <dossier>` (tags, stash, `develop` en avance de 2 et en retard de 3 sur un `origin` bare, branche seulement distante, merge, commit signé). `fixtures/sidebar.sh <dossier>` y ajoute les remotes `upstream` et `backup`, les branches `feat/api`, `feat/ui/x` (sur `main`), `feat/graph` (sur `develop`, plus récent) et le tag `v0.9.0`, pour `BranchSidebar`. `fixtures/layout.sh <dossier>` fabrique 23 branches locales (la courante en dernier), 3 branches sur `origin` et aucun tag ni stash, pour la hauteur des sections. `fixtures/wide.sh <dossier>` fabrique 40 branches d'un commit chacune qui partent du même commit (plus de 40 lanes), pour la largeur du graphe.
- Dépôt de 10 000 commits : `fixtures/large.sh <dossier>` le crée en moins d'une seconde (un seul `git fast-import`, déterministe). Il sert au test de performance de `e2e/graph.spec.ts` (ouverture en moins de 3 s, défilement du premier au dernier commit sans trou, 50 images/s au moins sur Chromium) ; ce test, d'une quinzaine de secondes, tourne avec les autres par `pnpm e2e`. Pour lui seul : `pnpm e2e -g CA-23`.

## Fetch automatique

- À l'ouverture d'un dépôt (au lancement comme par `RepoPicker`), puis chaque minute tant qu'il reste ouvert, Octogit lance `git fetch --prune` en tâche de fond (binaire `git` du poste : `.git/config` est respecté, jamais écrit). Un seul fetch à la fois par dépôt ; changer de dépôt arrête la planification de l'ancien ; un fetch qui dépasse 30 s est tué ; aucune saisie n'est jamais demandée.
- Le fetch ne modifie jamais une branche locale, `HEAD` ni l'arbre de travail (aucun pull implicite) : seules les refs `origin/…` et les tags distants changent. Une `origin/…` supprimée sur `origin` disparaît du graphe (prune) ; la branche locale qui la suivait reste intacte.
- `FetchStatus`, dans l'en-tête de `History`, affiche « fetched n min ago » : l'âge du dernier fetch réussi, mis à jour sans geste. Un échec garde le dernier âge (états hors ligne et erreur : à venir).
- En test, l'intervalle de 60 s se règle par `?fetch_interval_ms=<ms>` dans l'adresse de `pnpm dev:web` (lu par `src/web-bridge.ts`, sans effet dans l'application livrée).

## Profils

- **Cmd+,** ouvre `ProfileSettings` depuis `History` ou `Welcome` ; Échap revient à l'écran d'origine. Sans profil, seul « Create a first profile » s'affiche (Name, `user.name`, `user.email`, SSH key choisie ou générée, voir plus bas ; `user.name` vide par défaut, rien repris de `~/.gitconfig`). Ensuite : liste des profils (pastille de couleur, nom, `user.email`), **New profile**, et pour le profil sélectionné nom, couleur (une des 6 couleurs de lanes), `user.name`, `user.email`, signature des commits et chemin de la clé, enregistrés par **Save** (désactivé si `user.name` ou `user.email` est vide).
- **Clé SSH du profil** : **Choose…** ouvre le sélecteur de fichier dans `~/.ssh` et affiche le chemin et l'empreinte `SHA256:` de la clé (celle de `ssh-keygen -lf`) ; **Generate ed25519…** crée `~/.ssh/id_ed25519_<nom du profil>` (droits 600) et son `.pub`, avec une passphrase facultative, et refuse, en nommant le fichier, d'écraser un fichier existant ; **Copy public key** met la clé publique (une ligne `ssh-ed25519 AAAA…`) dans le presse-papiers, « to paste in GitHub › Settings › SSH keys ». Une clé existante protégée par une passphrase et sans `.pub` demande sa passphrase une fois : le `.pub` est écrit à côté de la clé privée. Le profil enregistre le chemin de la clé, jamais son contenu ; les clés ne sont jamais supprimées par Octogit. Tout passe par `/usr/bin/ssh-keygen`.
- **Passphrases** : gardées dans le trousseau macOS (service « Octogit SSH passphrase », un élément par chemin de clé), jamais dans un fichier JSON, jamais journalisées ni renvoyées à l'interface, et jamais redemandées. Test manuel du vrai trousseau (non couvert par les tests automatiques) : générer une clé avec passphrase dans `pnpm tauri dev`, vérifier l'élément dans Trousseau d'accès, relancer.
- **Test connection** (à côté de Copy public key) lance toujours `/usr/bin/ssh` (jamais cherché dans le `PATH`) : `ssh -T -F none git@github.com -i <clé du profil> -o IdentitiesOnly=yes -o IdentityAgent=none` : seule la clé du profil est présentée, quel que soit le contenu de l'agent SSH et de `~/.ssh/config` (`-F none`). Réponse « Hi <compte>! You've successfully authenticated… » (même si `ssh` sort en code 1) : « ✓ github.com: authenticated as @<compte> ». Refus : « Test failed: » suivi du message brut de SSH (en mono) et de « Public key not added on GitHub yet? », avec Copy public key et **Test again**. Le bouton garde le focus pendant le test (`aria-disabled`). Aucune réponse : interrompu 10 s après le clic, « No response from github.com after 10 s. », mêmes boutons. Rien n'est jamais demandé en fond : entrée fermée, `BatchMode` sans passphrase ; la passphrase du trousseau passe par `SSH_ASKPASS` qui lit un tube nommé (droits 600), jamais l'environnement ni la ligne de commande ; une clé d'hôte inconnue est acceptée au premier contact (`StrictHostKeyChecking=accept-new`).
- Test de connexion en test : le pont de test lance `fixtures/fake-ssh/ssh` par son chemin (jamais d'appel réel à GitHub ; l'application livrée ne lit aucun chemin dans l'environnement) ; il journalise les options reçues dans `<dossier SSH>/fake-ssh.log` (`FAKE_SSH_LOG`) et répond selon `FAKE_SSH_MODE` : `ok` (« Hi $FAKE_SSH_ACCOUNT! », défaut `octogit`), `denied` (refus), `silent` (silence au-delà de 10 s). En `pnpm dev:web`, réglage par l'adresse : `?fake_ssh_mode=`, `?fake_ssh_account=`, `?ssh_test_timeout_ms=` (délai du test, 10 s par défaut ; les tests e2e du silence le ramènent à 1 s). Tests Rust : `test_connection_with` reçoit le faux `ssh`, l'échéance et ses variables.
- Tests et captures : le dossier SSH se règle par `OCTOGIT_SSH_DIR` (voir `.env.example`) ; en `pnpm dev:web`, `?ssh_dir=<chemin>` dans l'adresse. Sans l'un ni l'autre, le pont de test n'écrit jamais dans le vrai `~/.ssh` : il utilise `ssh/` sous le dossier de données (`.dev-data/ssh/`, ignoré par Git). Les chemins sous `/Users/<nom>` s'affichent avec `~` (affichage seulement). Le pont de test garde les passphrases dans un faux trousseau fichier `<dossier de données>.keychain-fake.json` (motif `*.keychain-fake.json` ignoré par Git), qui n'existe que dans le pont : l'application livrée utilise toujours le trousseau macOS.
- **Alt+↑ / Alt+↓** montent ou descendent le profil sélectionné ; l'ordre est mémorisé.
- Échap avec des modifications non enregistrées ouvre « Discard changes to profile … ? » : Save (enregistre puis ferme), Discard (ferme sans enregistrer), Cancel (reste avec les modifications).
- Les profils vivent dans `profiles.json` (`version` 2, champ `profiles` dans l'ordre de la liste, chacun avec ses `rules`) sous `OCTOGIT_DATA_DIR`, écrit atomiquement. Un fichier de version 1 (sans règles) est lu avec des règles vides et passe en version 2 à la prochaine écriture. Octogit ne lit ni n'écrit jamais `~/.gitconfig`.
- **Règles de rattachement** (`Matching rules`, sous le formulaire d'un profil enregistré) : **Path rule** ajoute une règle de chemin (`~/Dev/Pro/**` : `~` est le dossier personnel, `*` une partie de nom, `**` n'importe quelle profondeur ; un chemin sans joker vaut pour le dossier et tout ce qu'il contient) et **Remote owner rule** une règle `github.com/<owner>/*`, lue sur le remote `origin` seulement (URL SSH `git@github.com:owner/repo.git` ou HTTPS `https://github.com/owner/repo.git` ; un autre remote comme `upstream`, ou l'absence d'`origin`, ne correspond pas). Chaque règle montre son type ; le bouton de retrait la supprime. Les règles sont enregistrées par **Save** (qui reste désactivé tant qu'un motif est vide).
- **Rattachement** : à l'ouverture d'un dépôt (au lancement comme par `RepoPicker`), il est rattaché au premier profil de la liste (ordre de `ProfileSettings`) dont une règle correspond ; `ProfileBadge`, dans l'en-tête de `History` et sur chaque ligne de Recent, affiche son état. Sans règle correspondante, rien n'est rattaché ni écrit.
- **`ProfileBadge`** : trois états. _Conforme_ : nom et couleur du profil (la même pastille que dans la liste de `ProfileSettings`). _Non conforme_ : « ⚠ Work · identity mismatch », distinct de l'état conforme par le signe et le texte, sans recours à la couleur ; c'est le cas d'une valeur locale qui diffère du profil (voir `IdentityMismatch`), et aussi d'un profil à signature cochée dont la clé publique (`.pub`) manque : rien n'est alors écrit dans le dépôt, sans message. Un dépôt auquel il ne manque que des valeurs reste conforme (l'ouverture les écrit). _« No profile »_ : aucun profil rattaché (le menu du badge et « No profile — choose one » viennent avec S-17).
- **Ce qui est écrit** dans le `.git/config` local du dépôt, par `git config --local`, clé par clé, sans toucher au reste (remotes, branches) : `user.name`, `user.email`, `core.sshCommand` = `ssh -F none -i <clé> -o IdentitiesOnly=yes -o IdentityAgent=none` (seule la clé du profil est présentée ; `-F none` : `~/.ssh/config` n'est pas lu, ses alias d'hôte ne servent donc pas aux dépôts rattachés), et la signature : cochée, `commit.gpgsign=true`, `gpg.format=ssh`, `user.signingkey=<clé publique du profil>` ; décochée, `commit.gpgsign=false` et aucune des deux autres clés. Jamais dans `~/.gitconfig` : toute écriture utilise `--local`. Un `.git/config` déjà conforme n'est pas réécrit (identique octet pour octet). Si l'une de ces valeurs existe déjà en local et diffère du profil, rien n'est écrit : `IdentityMismatch` s'affiche (voir ci-dessous).
- **`.git/config` local différent du profil** (une des quatre valeurs `user.name`, `user.email`, `core.sshCommand`, signature) : à l'ouverture, `IdentityMismatch` (« Local Git config differs from profile Pro ») affiche le chemin du dépôt, l'origine du rattachement (« matched by rule `<motif>` » ou « manual choice »), « Nothing has been written. » et un tableau profil / local des quatre valeurs (lignes `user.email`, `user.name`, `core.sshCommand`, signature) ; chaque écart porte le signe « ≠ » et le texte « differs » (jamais la couleur seule), une valeur absente s'affiche « not set ». Tant qu'aucun choix n'est fait, le `.git/config` reste identique octet pour octet. **Overwrite with profile Pro** écrit les valeurs du profil (mêmes clés que ci-dessus, clés ciblées par `git config --local` ; `commit.gpgsign=false` si la signature est décochée, `gpg.format` et `user.signingkey` retirés) et ferme le dialogue. **Import local config into Octogit…** ouvre `ProfileSettings` sur un nouveau profil pré-rempli avec `user.name`, `user.email`, la clé de `-i <clé>` dans `core.sshCommand` et la signature (cochée si `commit.gpgsign=true`) ; le nom reste à saisir et le `.git/config` n'est pas touché tant qu'on n'a pas fait Save ; **Save** crée le profil, rattache le dépôt à lui, écrit alors ses valeurs dans le `.git/config` comme Overwrite (clés ciblées, forme d'Octogit pour `core.sshCommand`) et revient à `History`, conforme. **Cancel** ou Échap ferme le dialogue sans rien écrire (le blocage de Commit et Push qui en découle vient avec S-21) ; il réapparaît à la prochaine ouverture. Un `core.sshCommand` importé de forme différente (par exemple `ssh -i <clé>`) est donc remis dans la forme d'Octogit au Save : `IdentityMismatch` ne revient pas.
- **Rattachement manuel mémorisé** : le dépôt rattaché par Import est noté dans `repositories.json` (`version` 5, champ `manual_profiles`, clé : chemin du dépôt, valeur : identifiant du profil). Il est prioritaire sur les règles et gardé aux ouvertures suivantes ; un profil supprimé retombe sur les règles. Un fichier de version 2 à 4 est lu sans rattachement manuel et passe en version 5 à la prochaine écriture. Ce stockage sert aussi au menu du badge (S-17) et au clone (S-27).
- Pas encore livrés : suppression (S-13), accès par `Welcome` et par le badge, choix manuel d'un autre profil et « Reset to rules » (S-17), profil au clone (S-27).

## Commandes de qualité

| Commande            | Rôle                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `pnpm lint`         | `cargo clippy` (avertissements en erreur) puis ESLint                |
| `pnpm format:check` | `cargo fmt --check` puis Prettier (`pnpm format` écrit)              |
| `pnpm test`         | `cargo test --workspace` puis Vitest                                 |
| `pnpm e2e`          | Playwright sur l'interface servie par `pnpm dev:web`                 |
| `pnpm audit:deps`   | `cargo audit` et `pnpm audit`                                        |
| `pnpm gen:bindings` | génère `src/lib/bindings.ts` depuis le contrat Rust (`tauri-specta`) |
| `pnpm tauri build`  | build de l'application (lance aussi `pnpm check`)                    |

## Livraison

Octogit est livré en `.dmg` pour puces Apple, signé ad hoc (sans compte Apple Developer ni notarisation). Pas de mise à jour intégrée : on met à jour en téléchargeant la nouvelle version.

### Construire

```sh
pnpm tauri build
scripts/check-bundle.sh   # monte le .dmg (lecture seule) et vérifie Octogit.app : signature ad hoc, arm64, macOS 13 minimum, icône fournie
```

Le `.dmg` est dans `target/release/bundle/dmg/` (`Octogit_<version>_aarch64.dmg`), l'application dans `target/release/bundle/macos/Octogit.app`.

### Installer

Ouvrir le `.dmg`, glisser `Octogit.app` dans `Applications`.

### Premier lancement (version téléchargée)

macOS bloque une application non notarisée téléchargée. Une seule fois :

- macOS 15 et plus récent (dont macOS 26) : Réglages Système › Confidentialité et sécurité › **Ouvrir quand même** (après une première tentative de lancement). Le clic droit › Ouvrir ne contourne plus Gatekeeper ;
- macOS 13 et 14 seulement : clic droit sur `Octogit.app` › **Ouvrir**, puis confirmer (la voie des Réglages Système marche aussi).

### Publier une release (manuel, sur `jeanalexandre/octogit`)

1. Monter la version dans `package.json`, `src-tauri/tauri.conf.json` et le `Cargo.toml` racine (`[workspace.package]`, dont `src-tauri/Cargo.toml` hérite), puis lancer `pnpm tauri build` et `scripts/check-bundle.sh`.
2. Créer un tag `v<version>` et le pousser sur `jeanalexandre/octogit`.
3. Sur GitHub : Releases › Draft a new release, choisir le tag, rédiger les notes.
4. Attacher `target/release/bundle/dmg/Octogit_<version>_aarch64.dmg`, puis publier.

Aucune automatisation ni CI de release.

## Données

Octogit écrit ses fichiers JSON dans `OCTOGIT_DATA_DIR`. En développement et en test, le défaut est le dossier `.dev-data/` du repo (ignoré par Git) ; jamais `~/Library/Application Support/Octogit/`, réservé à l'application livrée. Les variables `OCTOGIT_DATA_DIR` et `OCTOGIT_PORT` se lisent dans `.env.local` à la racine (non versionné, ignoré par Git ; copier `.env.example`), sans préfixe de commande : `pnpm dev:web` et `pnpm e2e` le chargent par Node (`--env-file-if-exists`). Une variable déjà posée dans le shell l'emporte. Lancer toujours par ces scripts pnpm, jamais `npx playwright` ni `cargo run` en direct (ils ne lisent pas `.env.local`). Sous `pnpm e2e`, le port suit `OCTOGIT_PORT` mais les données de test restent dans un dossier temporaire. Une valeur absolue est préférable pour `OCTOGIT_DATA_DIR`. `OCTOGIT_PORT` n'agit que sur `pnpm dev:web` : `pnpm tauri dev` sert toujours sur le port 1420, donc deux `pnpm tauri dev` en parallèle se bloquent. Voir `.env.example`.

## Organisation du repo

- `crates/git` (`octogit-git`) : lecture des dépôts avec `gix`
- `crates/identity` (`octogit-identity`) : profils d'identité (type `Profile`, ordre) ; clés SSH (module `ssh` : génération, empreinte, `.pub`, par `ssh-keygen`) ; les règles et la conformité viendront ensuite
- `crates/store` (`octogit-store`) : persistance JSON versionnée, écriture atomique
- `crates/platform` (`octogit-platform`) : intégrations propres à macOS
- `src-tauri/` (crate `octogit-app`) : commandes et événements Tauri, sans logique
- `src/lib/screens/`, `src/lib/components/` : écrans et composants Svelte ; `src/lib/styles/tokens.css` : tokens de couleur ; `src/lib/bindings.ts` : généré
- `assets/icons/` : icônes fournies, source de `src-tauri/icons/` (`octogit.icns` copié tel quel en `icon.icns` ; `octogit.ico` n'est pas embarqué, macOS seul). Régénérer les PNG : `pnpm tauri icon assets/icons/octogit-original-1024.png --output <dossier temporaire>`, ne garder que `32x32.png`, `128x128.png`, `128x128@2x.png` et `icon.png` dans `src-tauri/icons/`
- `e2e/` : tests Playwright ; `fixtures/` : scripts qui fabriquent les dépôts d'exemple et le faux `ssh` de test
- `brief.md`, `ux.md`, `stack.md`, `specs/`, `ux/`, `plan.md`, `stories/` : livrables de méthode
