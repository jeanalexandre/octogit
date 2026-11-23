#!/bin/sh
# Dépôt prêt pour un rebase de 5 commits arrêté sur des conflits. Usage : conflict-rebase.sh <dossier>
# `develop` et `feature/profiles` (courante) ont divergé depuis « Initial commit » (main). Rebaser feature/profiles sur
# develop rejoue 5 commits : « Add one » passe, « Profiles settings » (auteur Carol Dev, `settings.txt`) est en
# conflit à l'étape 2, « Profiles notes » (`notes.txt`) en conflit à l'étape 3, « Add four » et « Add five » passent.
# Le rebase n'est pas lancé. Aucun réseau.
set -e
. "$(dirname "$0")/lib.sh"

# save <message> <nom> <email> <date ISO> : commit de tous les changements
save() {
  git -C "$1" add -A
  GIT_AUTHOR_NAME=$3 GIT_AUTHOR_EMAIL=$4 GIT_AUTHOR_DATE=$5 \
  GIT_COMMITTER_NAME=$3 GIT_COMMITTER_EMAIL=$4 GIT_COMMITTER_DATE=$5 \
    git -C "$1" commit -q -m "$2"
}

init_repo "$1"
printf 'header\nfirst\nfooter\n' > "$1/settings.txt"
printf 'note\n' > "$1/notes.txt"
save "$1" "Initial commit" "Alice Martin" "alice@example.com" "2024-01-10T10:00:00Z"

git -C "$1" checkout -q -b develop
printf 'header\nfirst develop\nfooter\n' > "$1/settings.txt"
printf 'note develop\n' > "$1/notes.txt"
save "$1" "Develop edits" "Bob Durand" "bob@example.com" "2024-01-11T10:00:00Z"

git -C "$1" checkout -q main
git -C "$1" checkout -q -b feature/profiles
printf 'one\n' > "$1/one.txt"
save "$1" "Add one" "Alice Martin" "alice@example.com" "2024-01-12T10:00:00Z"
printf 'header\nfirst profiles\nfooter\n' > "$1/settings.txt"
save "$1" "Profiles settings" "Carol Dev" "carol@example.com" "2024-01-12T11:00:00Z"
printf 'note profiles\n' > "$1/notes.txt"
save "$1" "Profiles notes" "Alice Martin" "alice@example.com" "2024-01-12T12:00:00Z"
printf 'four\n' > "$1/four.txt"
save "$1" "Add four" "Alice Martin" "alice@example.com" "2024-01-12T13:00:00Z"
printf 'five\n' > "$1/five.txt"
save "$1" "Add five" "Alice Martin" "alice@example.com" "2024-01-12T14:00:00Z"
