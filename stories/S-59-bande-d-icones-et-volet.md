# Story S-59 : `BranchSidebar` repliée en bande d'icônes, volet flottant

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-59-bande-d-icones-et-volet.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-59 (tranche valeur 1 bis)
- Critères couverts : `organiser-l-espace` CA-9, CA-10 (sauf checkout)
- Jobs servis : J-1, J-16
- Revue renforcée : non

## Objectif
Le panneau `BranchSidebar` se replie en bande d'une icône par section, mémorisée globalement ; un clic sur une icône ouvre la section dans un volet flottant par-dessus le graphe, fermé par Échap ou un clic ailleurs.

## Critères d'acceptation
- **organiser-l-espace CA-9** : Étant donné `BranchSidebar` déplié, quand je clique sur le bouton en tête du panneau, alors le panneau devient une bande d'une icône par section, avec le nom de la section en infobulle ; un nouveau clic le rétablit ; aucun raccourci clavier ne le replie ; l'état est gardé à la fermeture d'Octogit et dans tous les dépôts.
- **organiser-l-espace CA-10** : Étant donné le panneau replié, quand je clique sur l'icône d'une section, alors un volet flottant affiche cette section par-dessus le graphe, sans décaler ni redimensionner le graphe ; Échap, un clic hors du volet ou un checkout depuis le volet le ferme.

## Décisions de l'humain
### Après la revue 1 (12/11/2026)
1. Verdict « bloqué » (captures impossibles, le reviewer n'a pas d'outil d'écriture) : l'orchestrateur écrit et lance le script de captures dans son scratchpad, hors dépôt, puis relance la revue avec les images pour la partie visuelle (choix a de l'humain). Vaut pour tout le lot (S-60, S-61).

### Après la revue 2 (12/11/2026)
1. Chevauchement des étiquettes de la colonne des refs et en-tête « GRAPH » contre « COMMIT MESSAGE » sur la fixture `layout` (préexistant) : pris en compte (pour information) ; largeur du graphe et colonne des refs sont l'objet de S-60 et S-61.

## Contexte technique
- Le plan scinde CA-10 : la fermeture au checkout est livrée en S-25, car le checkout par double-clic n'existe pas encore. Ici : fermeture par Échap et par un clic hors du volet seulement.
- Dépend de S-58 (sections à hauteur et repli, préférences globales). `src/lib/components/BranchSidebar.svelte`, `src/lib/screens/History.svelte`.
- Le volet affiche la section choisie avec les mêmes gestes que dans le panneau (dossiers, hauteur, repli de section, sélection) ; il est positionné en absolu par-dessus le graphe, donc sans effet sur la mise en page du graphe (largeur et position de ses colonnes inchangées, à vérifier par mesure dans l'e2e). Pas de raccourci clavier pour replier le panneau (geste rare, décision de la spec) ; le bouton et les icônes sont néanmoins focalisables au clavier, Échap ferme le volet et rend le focus à l'icône.
- Une icône Lucide par section (Local, chaque remote, Tags, Stashes), infobulle avec le nom de la section ; le nom est aussi l'étiquette accessible (`aria-label`), la couleur ne porte jamais l'information seule.
- Mémorisation : repli du panneau dans les préférences globales (`preferences.json`, voir S-58), écrit au clic. Si le schéma change, `version` en plus et fichier d'exemple versionné dans `crates/store/tests-data/`.
- Écran : `ux/ecrans/history.md` (ligne `BranchSidebar` : déplié · replié · volet flottant ouvert), maquette `ux/maquettes/history.html` section « 7 · Sidebar and layout » ; icônes Lucide ; tokens seulement.
- Tests : Vitest du composant (bande, ouverture et fermeture du volet), `crates/store`, e2e pour la mesure du graphe et la fermeture par clic extérieur.

## Interface à vérifier
- **Écrans et états** : `History` : `BranchSidebar` replié (bande d'icônes avec infobulle), volet flottant ouvert sur Local et sur un remote
- **Tailles d'écran** : 1500×900, 1920×1080, 1280×720
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] organiser-l-espace CA-9 → test Vitest : bouton, bande d'une icône par section avec infobulle, nouveau clic rétablit ; pas de raccourci clavier ; e2e : état gardé après rechargement et dans un autre dépôt
- [ ] organiser-l-espace CA-10 → e2e : clic sur l'icône, volet affiché, position et largeur du graphe identiques avant et après (mesure) ; Échap ferme ; un clic hors du volet ferme

## Hors périmètre
- Fermeture du volet par un checkout (S-25, partie de CA-10 scindée) ; le double-clic de checkout lui-même (S-25).
- Contenu des sections, dossiers, hauteurs (S-57, S-58).

## Documentation à mettre à jour
- README : section « Graphe de `History` » (bande d'icônes, volet flottant, repli du panneau mémorisé dans `preferences.json`).
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : `c209a3a`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé ; préférences en `version` 3 (`panel_collapsed`), commandes `get_panel_collapsed` / `set_panel_collapsed` ; tests, lint, build relancés ✅ | — |
| 1 | reviewer | `stories/S-59-revue-1.md` ; aucun problème de code, captures d'interface impossibles (outil Write absent chez le reviewer) | bloqué |
| 1 | reviewer | `stories/S-59-revue-2.md` ; revue visuelle sur captures de l'orchestrateur, aucun problème | validé |
