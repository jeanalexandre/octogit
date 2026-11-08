# Welcome

> Détail extrait de `ux.md` (section « Écrans ») le 06/11/2026, amendé le 08/11/2026. Couleurs : `ux/tokens.md`.

- **Contenu et actions** : Dépôts récents (nom, chemin, date relative, `ProfileBadge` du profil rattaché, choix mémorisé compris, ou « No profile ») ; Open folder… (Cmd+O), Clone… (Cmd+Maj+C), Profiles (Cmd+,)
- **États** : vide (aucun profil : « Welcome to Octogit », « Create a first profile » ; pas de clone sans profil) · dépôt introuvable (« Repository not found: » et chemin, Locate…, Remove from recent) · dossier non Git (message nommant le dossier, rien d'écrit) · Git absent (J-17 ; au lancement, prioritaire sur le dernier dépôt ; récents, Open, Clone et Profiles remplacés) : « Git not found » (« Git is required. It is not installed on this Mac. », « Install Command Line Tools » : ouvre l'installation d'Apple) · attente (« Waiting for the Command Line Tools installation… », revérification automatique, reprise au plus tard 5 s après que Git est disponible, « Check again » ; « Install Command Line Tools » reste disponible si la fenêtre d'Apple a été annulée) · installation impossible (message brut et commande `xcode-select --install` à copier, Copy ; revérification automatique et « Check again » toujours actifs : reprise seule après une installation faite au terminal) · Git trouvé : aucun écran, reprise du lancement normal
- **Maquette** : `ux/maquettes/welcome.html` (états Git absent sans maquette : textes ci-dessus, choix de l'humain du 08/11/2026)

