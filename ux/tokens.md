# Tokens : Octogit

> Extrait de `ux.md` (« Direction visuelle ») le 06/11/2026. Seule source des couleurs du code. Maquettes : `ux/direction/neon.html`, `ux/direction/neon-kraken.html`.

| Token | Neon sombre | Neon clair | Kraken sombre | Kraken clair | Rôle |
|---|---|---|---|---|---|
| `surface` | `#141518` | `#ffffff` | `#12151c` | `#fbfcfe` | fond du graphe, champs |
| `surface-raised` | `#1b1c20` | `#f7f8fa` | `#1a1f29` | `#f1f3f8` | barre d'outils, barre latérale, panneau, cartes |
| `border` | `#2a2c31` | `#e3e6eb` | `#2a3140` | `#dde1ea` | séparateurs décoratifs |
| `border-strong` | `#6e727b` | `#848a95` | `#6b7588` | `#7a8494` | champs, cases, étiquettes de tag |
| `ink` | `#e8e9ec` | `#1f2328` | `#e6e9ef` | `#161a22` | texte principal |
| `muted` | `#a2a5ad` | `#5c6370` | `#9aa3b2` | `#566070` | texte secondaire (dates, chemins, compteurs) |
| `brand` | `#2563eb` | `#2563eb` | `#2dd4bf` | `#0f766e` | action principale, segment actif, compteur de Push |
| `on-brand` | `#ffffff` | `#ffffff` | `#062b27` | `#ffffff` | texte sur `brand` |
| `link` | `#6ea0ff` | `#1d5bd8` | `#5eead4` | `#0f6b64` | actions texte (Stage all, Details) |
| `selection` | `#1f2b45` | `#e6eeff` | `#25324a` | `#dbe4f7` | élément sélectionné |
| `focus` | `#5b8def` | `#2563eb` | `#5eead4` | `#0d9488` | focus clavier, volet actif |
| `success` | `#4ade80` | `#126b31` | `#4ade80` | `#11692f` | identité conforme, statut A |
| `warning` | `#f5a524` | `#9a4708` | `#fbbf24` | `#8a5300` | statut M, opération en cours |
| `danger` | `#f87171` | `#c81e1e` | `#f87171` | `#b91c1c` | identité non conforme, perte, erreur |
| `lane-1`…`lane-6` | `#6b9cff #2ec4b0 #f5a524 #f472b6 #b38cff #5fd068` | `#1d4ed8 #0f766e #9a4708 #be185d #6d28d9 #126b31` | `#22d3ee #a78bfa #f472b6 #facc15 #fb923c #4ade80` | `#0e7490 #6d28d9 #be185d #8a5300 #b03a0a #11692f` | lanes, dans l'ordre puis cycliques |
| `on-label` | `#111316` | `#ffffff` | `#0b0e14` | `#ffffff` | texte sur étiquette pleine et pastille de statut |
| `node-ink` | `#111316` | `#111827` | `#0b0e14` | `#111827` | initiales dans un nœud |

- **Dérivés** : teinte de ligne et d'étiquette distante = lane à 10 % (clair) ou 14 % (sombre) sur `surface` ; remplissage de nœud = lane à 40 % sur blanc ; bandeau conforme = `success` à 12 % sur `surface-raised`. Toutes les paires vérifiées en AA, teintes comprises.
- **Couleurs de profil** : les 6 couleurs de lanes (`lane-1`…`lane-6`) de la palette active, au choix ; la pastille du profil (liste de `ProfileSettings`, `ProfileBadge`) suit le thème et la palette.
