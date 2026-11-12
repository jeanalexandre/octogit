#!/bin/sh
# Dépôt pour la mise en page de BranchSidebar. Usage : layout.sh <dossier> (crée <dossier>-origin.git et <dossier>-other)
# - Local : 23 branches sans dossier (main, topic-01 à topic-21, zlast) ; zlast est la branche courante,
#   sur le commit le plus ancien : le tri par date la met en dernier, hors des 8 premières lignes ;
# - origin : 3 branches (main, develop, release), sans dossier ; <dossier>-other, un autre clone, y pousse
#   une branche de plus (voir `Workspace.pushBranchFromOther`) ;
# - ni tag ni stash : les sections Tags et Stashes sont vides.
set -e
. "$(dirname "$0")/lib.sh"
"$(dirname "$0")/simple.sh" "$1"
repo=$1
origin=$1-origin.git

git init -q --bare -b main "$origin"
git -C "$repo" remote add origin "$origin"
git -C "$repo" branch develop main
git -C "$repo" branch release main
git -C "$repo" push -q origin main develop release
git -C "$repo" branch -D develop release -q

n=1
while [ "$n" -le 21 ]; do
  git -C "$repo" branch "$(printf 'topic-%02d' "$n")" main
  n=$((n + 1))
done
git -C "$repo" checkout -q -b zlast main~2

git clone -q "$origin" "$1-other"
git -C "$1-other" config user.name "Bob Durand"
git -C "$1-other" config user.email "bob@example.com"
