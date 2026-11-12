# Verdict de revue : S-62

**Verdict : validé**

Référence du diff : `0793870`. Passage 1.

## Vérifications relancées
- `pnpm lint` : vert. `pnpm format:check` : vert. `pnpm check` : 0 erreur ; 2 avertissements a11y préexistants dans `CommitGraph.svelte`, hors story.
- `pnpm test` : cargo 18 + 27 + 4 + 25 + 1 verts ; vitest 123 verts sur 17 fichiers.
- `pnpm e2e` sans `.env.local` : 58 verts. Les messages « .env.local not found. Continuing without it. » montrent que le chargement Node est branché sur Playwright et sur son webServer.
- `pnpm audit:deps` et `pnpm tauri build` non relancés : aucune dépendance ajoutée, aucun code Rust touché.

## Critères
- **a** : couvert. `resolveDevPort` est testé avec 1421, sans variable, et avec valeur vide ou invalide. `vite.config.ts` lit le port seulement en mode `web`. Preuve en environnement : avec `OCTOGIT_PORT=1421`, le webServer de `pnpm e2e` a bien démarré, puisque Playwright a attendu l'URL 1421 sans expirer. Les tests ont ensuite échoué au lancement du navigateur, à cause du sandbox (`mach_port_rendezvous ... Permission denied`). Voir « Pour l'humain » pour ce qui reste non prouvé.
- **b** : couvert. `src/dev-playwright.test.ts` vérifie `command` sans préfixe, `url` sur le port, `env.OCTOGIT_PORT` et `env.OCTOGIT_DATA_DIR` dans un dossier temporaire. Le deuxième test vérifie que `OCTOGIT_DATA_DIR` de l'environnement est ignoré et qu'il n'y a jamais de `.dev-data/`.
- **c** : couvert par le test « garde 1420 sans variable » et par l'e2e complet vert sans `.env.local`.
- **d** : `git check-ignore .env.local` renvoie `.env.local`.
- **e** : `src-tauri/tauri.conf.json` n'apparaît pas dans le diff. `pnpm dev` (vite, mode non `web`) reste sur 1420.

## Tests sans rouge constaté
`src/dev-slot.test.ts` et `src/dev-playwright.test.ts` : non bloquants. Ils portent sur des fonctions pures avec des assertions de valeurs exactes. Le premier échouerait si le port était figé à 1420. Le second échouerait avec un préfixe dans la commande ou un `OCTOGIT_DATA_DIR` venu de l'environnement. Aucune dépendance à l'état de la machine.

## Problèmes
Aucun bloquant.

Mineur :
- `tsconfig.json:12` : `allowImportingTsExtensions` ajouté sans être prévu par la fiche. Il est nécessaire pour `import ... from "./src/dev-slot.ts"` (Node natif exige l'extension), donc acceptable. À noter, rien à corriger.

## Périmètre et documentation
- Aucune dépendance ajoutée. `stack.md`, `ux.md` et `tauri.conf.json` sont inchangés. Le code Svelte et Rust est inchangé.
- Le README (section Lancement, section Données) et l'en-tête de `.env.example` sont à jour. Ils couvrent le chargement par `.env.local`, l'interdiction de `npx playwright` et `cargo run`, `tauri dev` qui reste sur 1420, et les données de test qui restent temporaires.

## Pour l'humain
- Pour information : je n'ai pas pu créer un `.env.local` jetable (écriture refusée, et le sandbox bloque aussi la lecture de ces fichiers). La preuve de bout en bout « fichier lu → port 1421 » n'est donc pas faite. Le chaînon fichier vers environnement repose sur `node --env-file-if-exists`, dont le branchement est confirmé par les messages ci-dessus. Le chaînon environnement vers port est prouvé. Un essai à la main reste utile : `.env.local` avec `OCTOGIT_PORT=1421`, puis `pnpm dev:web`.
