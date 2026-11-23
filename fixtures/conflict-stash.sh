#!/bin/sh
# Dépôt prêt pour un Pop ou un Apply en conflit lancé dans Octogit. Usage : conflict-stash.sh <dossier>
# Le stash « park the wip » (stash@{0}) contient des changements de `main` qui entrent en conflit au Pop :
# `settings.txt` (2 blocs) et `notes.txt` (1 bloc) en conflit de texte, `logo.bin` (binaire modifié des deux côtés)
# et `old.txt` (supprimé côté stash, modifié côté courant) non fusionnables, `readme.txt` repris sans conflit
# (Auto-merged), `scratch.txt` non suivi créé par le stash. Le Pop n'est pas lancé. Aucun réseau.
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
printf 'header\nfirst\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nsecond\nfooter\n' > "$1/settings.txt"
printf 'note\n' > "$1/notes.txt"
printf 'r1\nr2\nr3\nr4\nr5\nr6\nr7\n' > "$1/readme.txt"
printf 'old\n' > "$1/old.txt"
printf '\000base\n' > "$1/logo.bin"
save "$1" "Initial commit" "Alice Martin" "alice@example.com" "2024-01-10T10:00:00Z"

# Le travail en cours, mis de côté : tout est stashé, le fichier non suivi aussi.
printf 'header\nfirst stash\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nsecond stash\nfooter\n' > "$1/settings.txt"
printf 'note stash\n' > "$1/notes.txt"
printf 'r1 stash\nr2\nr3\nr4\nr5\nr6\nr7\n' > "$1/readme.txt"
printf '\000stash\n' > "$1/logo.bin"
rm "$1/old.txt"
printf 'scratch\n' > "$1/scratch.txt"
git -C "$1" stash push --include-untracked -q -m "park the wip"

# Le travail qui a continué sur `main` pendant ce temps.
printf 'header\nfirst main\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nsecond main\nfooter\n' > "$1/settings.txt"
printf 'note main\n' > "$1/notes.txt"
printf '\000main\n' > "$1/logo.bin"
printf 'old main\n' > "$1/old.txt"
save "$1" "Continue on main" "Bob Durand" "bob@example.com" "2024-01-11T10:00:00Z"
