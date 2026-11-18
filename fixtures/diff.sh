#!/bin/sh
# Dépôt pour DiffView d'un commit. Usage : diff.sh <dossier>
# - « Add notes and logo » : notes.txt (5 lignes), gone.txt (2 lignes), logo.bin (binaire, 7 octets) ;
# - « Rework notes and logo » : ajoute added.txt, supprime gone.txt, modifie logo.bin (binaire, 11 octets)
#   et notes.txt (ligne 2 changée, « four » retirée, « six » ajoutée) : quatre fichiers, A, D, M binaire, M texte,
#   dans l'ordre de CommitDetail (added.txt, gone.txt, logo.bin, notes.txt) ;
# - 60 commits vides « Filler 01 »… au-dessus : le graphe défile, « Rework notes and logo » est près du bas.
set -e
. "$(dirname "$0")/lib.sh"
init_repo "$1"
repo=$1

# save <résumé> <date ISO> : commit de tout ce qui est indexé, auteur et committer Alice Martin.
save() {
  GIT_AUTHOR_NAME="Alice Martin" GIT_AUTHOR_EMAIL=alice@example.com GIT_AUTHOR_DATE=$2 \
  GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE=$2 \
    git -C "$repo" commit -q --allow-empty -m "$1"
}

printf 'one\ntwo\nthree\nfour\nfive\n' > "$repo/notes.txt"
printf 'old\nstuff\n' > "$repo/gone.txt"
printf 'PNG\000\001\002\003' > "$repo/logo.bin"
git -C "$repo" add notes.txt gone.txt logo.bin
save "Add notes and logo" 2024-01-10T09:00:00Z

printf 'one\nTWO\nthree\nfive\nsix\n' > "$repo/notes.txt"
printf 'alpha\nbeta\n' > "$repo/added.txt"
printf 'PNG\000\001\002\003\004\005\006\007' > "$repo/logo.bin"
git -C "$repo" rm -q gone.txt
git -C "$repo" add notes.txt added.txt logo.bin
save "Rework notes and logo" 2024-01-11T09:00:00Z

n=1
while [ "$n" -le 60 ]; do
  label=$(printf 'Filler %02d' "$n")
  save "$label" "2024-02-01T$(printf '%02d' $((n / 6))):$(printf '%02d' $((n % 6 * 10))):00Z"
  n=$((n + 1))
done
