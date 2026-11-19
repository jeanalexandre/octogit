#!/bin/sh
# Dépôt pour l'indexation fine de DiffView et Discard changes. Usage : stage.sh <dossier>
# Fichiers de 20 lignes « l01 »… « l20 » (« s01 »… pour staged.txt, « b01 »… pour both.txt), commités avec logo.bin (binaire) :
# - lines.txt : non indexé, lignes 2, 10 et 18 changées (trois blocs, « L02 changed », « L10 changed », « L18 changed ») ;
# - staged.txt : indexé, lignes 3 et 15 changées (deux blocs, « S03 changed », « S15 changed »), arbre de travail identique à l'index ;
# - both.txt : ligne 2 changée et indexée (« B02 staged »), puis ligne 18 changée non indexée (« B18 edited ») ;
# - logo.bin : binaire modifié, non indexé ;
# - lib/ProfileBadge.svelte : non suivi.
set -e
. "$(dirname "$0")/lib.sh"
init_repo "$1"
repo=$1

numbered() {
  n=1
  while [ "$n" -le 20 ]; do
    printf '%s%02d\n' "$1" "$n"
    n=$((n + 1))
  done
}

# change <fichier> <ligne> <texte> : remplace la ligne donnée.
change() {
  awk -v n="$2" -v t="$3" 'NR == n { print t; next } { print }' "$repo/$1" > "$repo/$1.tmp"
  mv "$repo/$1.tmp" "$repo/$1"
}

numbered l > "$repo/lines.txt"
numbered s > "$repo/staged.txt"
numbered b > "$repo/both.txt"
printf 'PNG\000\001\002\003' > "$repo/logo.bin"
git -C "$repo" add lines.txt staged.txt both.txt logo.bin
GIT_AUTHOR_NAME="Alice Martin" GIT_AUTHOR_EMAIL=alice@example.com GIT_AUTHOR_DATE=2024-01-10T09:00:00Z \
GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE=2024-01-10T09:00:00Z \
  git -C "$repo" commit -q -m "Add numbered files"

change lines.txt 2 "L02 changed"
change lines.txt 10 "L10 changed"
change lines.txt 18 "L18 changed"
change staged.txt 3 "S03 changed"
change staged.txt 15 "S15 changed"
git -C "$repo" add staged.txt
change both.txt 2 "B02 staged"
git -C "$repo" add both.txt
change both.txt 18 "B18 edited"
printf 'PNG\000\001\002\003\004\005' > "$repo/logo.bin"
mkdir -p "$repo/lib"
printf '<p>badge</p>\n' > "$repo/lib/ProfileBadge.svelte"
