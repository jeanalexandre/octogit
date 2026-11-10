# Verdict de revue : S-2, passage 1

**Verdict : validé**

## Vérifications relancées
- `pnpm lint` : OK (clippy `-D warnings` + eslint).
- `pnpm format:check` : OK.
- `pnpm check` (svelte-check) : 0 erreur.
- `pnpm test` : OK (cargo : tous verts, dont store 8, git 8 ; vitest 22/22).
- `pnpm e2e` : 13/13 OK (5 de launch, 8 de open-repository, dont CA-3 aux deux tailles).
- `pnpm audit:deps` : OK (seul l'avis GHSA déjà accepté est ignoré ; 3 warnings cargo-audit « allowed », préexistants).
- `pnpm tauri build` : OK, `Octogit.app` produit. L'arbre Git est inchangé après le build.

## Critères
- **demarrer-un-depot CA-3** : couvert. Le test e2e (1500×900 et 1920×1080) clique le 3e récent parmi 4 fixtures et vérifie les commits de `History` (« Main side ») et la disparition de `Welcome`. Il vérifie aussi nom, chemin et date relative. Il échouerait sans la fonctionnalité.
- **demarrer-un-depot CA-4, dépôt Git** : couvert. L'e2e vérifie `History` et l'ordre des récents dans `RepoPicker` : le dépôt est en tête, sans doublon. Il vérifie aussi la relance, qui relit le dernier ouvert. Le test Cmd+O est couvert séparément. Les tests `cargo` de `store` (remontée en tête sans doublon, relecture dans l'ordre, migration v1→v2) et de `git` (vrai dépôt, dossier ordinaire, dossier inexistant, aucun fichier créé) passent.
- **demarrer-un-depot CA-4, dossier non Git** : couvert. L'alerte vaut exactement « notes is not a Git repository. », `Welcome` reste affiché et aucun récent n'est ajouté. L'arborescence (liste et contenus, fonction `snapshot`) est comparée avant et après : elle détecterait une écriture. Côté Rust, le test `opening_a_plain_folder_names_it_and_records_nothing` vérifie qu'aucun fichier n'est créé, ni dans le dossier ni dans le dossier de données.
- **explorer-l-historique CA-2** : couvert. L'e2e passe du dépôt A au dépôt B via `RepoPicker`. Il vérifie les commits de B et, par une marque posée sur `window`, que la page n'a pas été rechargée.
- Les 7 tests lents écrits sans rouge constaté : chacun prouve vraiment son critère, aucune assertion à vide, aucune dépendance à l'état de l'environnement. Le test « sélecteur annulé » ne couvre aucun CA ; il vérifie un comportement annexe, sans alerte et sans changement d'écran, et c'est suffisant.

## Périmètre
- Rien hors story : pas de `ProfileBadge`, Clone, Profiles ni état « dépôt introuvable ».
- Dépendances : `tauri` et `tauri-plugin-dialog` dans le crate `platform`, conformes à `stack.md` (« Intégrations macOS ») et à la fiche.
- Contrats : `repositories.json` v2 et la migration v1 sont couverts par la décision 1a de la fiche. Nouvelles commandes Tauri `list_recent_repositories`, `open_repository`, `choose_fol­der` et `bindings.ts` cohérents.
- `e2e/launch.spec.ts` : une assertion a été modifiée (`listitem` à 0 devient « aucun commit affiché »). C'est justifié, car le dépôt introuvable reste maintenant dans Recent. Ce n'est pas un affaiblissement : le critère de S-1 reste vérifié.
- Aucune modification de `ux.md`, `ux/` ni `stack.md`.

## Interface (captures prises à 1500×900 et 1920×1080)
- `Welcome` : Recent (nom, chemin tronqué, date relative), bouton Open folder… avec ⌘O, message d'erreur en ligne nommant le dossier. Rien ne déborde. Texte en anglais, ton neutre conforme.
- `History` : `RepoPicker` en haut à gauche, menu des récents et Open folder…, changement de dépôt dans la même fenêtre. Libellés présents, éléments focalisables au clavier (boutons natifs, Escape ferme le menu).

## Problèmes
**Bloquants** : aucun.

**Mineurs**
1. `/Users/jaja/Dev/Perso/octogit/src/lib/components/RepoPicker.svelte` : dans le menu (`min-width: 320px`), les longs chemins retournent à la ligne et le nom court est coupé verticalement (« repo- / a »). Attendu : nom sur une ligne (`white-space: nowrap`, `flex-shrink: 0`) et chemin tronqué avec ellipsis, comme dans `Welcome`.
2. `/Users/jaja/Dev/Perso/octogit/src/lib/components/RepoPicker.svelte` : le menu ne se ferme pas au clic extérieur, et Escape ne ferme que si le focus est dans le menu. Ni `ux.md` ni la maquette ne l'imposent : détail de rendu.

## Documentation
README : section « Ouvrir un dépôt » présente (Open folder…, Recent, `RepoPicker`, Cmd+O, `repositories.json` v2, pont de test `window.__octogitChosenFolder`). `.env.example` : aucun changement nécessaire, aucune variable ajoutée.

## Pour l'humain
RAS
