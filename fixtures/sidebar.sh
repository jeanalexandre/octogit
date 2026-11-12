#!/bin/sh
# Dépôt pour BranchSidebar : refs.sh, complété par trois remotes, des branches groupables et un tag récent.
# Usage : sidebar.sh <dossier> (crée aussi <dossier>-upstream.git et <dossier>-backup.git)
# - remotes `upstream` (main, release/1.0) et `backup` (main), en plus d'`origin` ;
# - branches locales feat/api et feat/ui/x (sur main, 15/01), feat/graph (sur develop, 17/01) :
#   « feat · 3 » contient « ui · 1 », puis graph (plus récent) avant api ;
# - tag v0.9.0 sur « Signed work » (le commit le plus récent) : le tri par date le met avant v1.1.0
#   et v1.0.0, alors que l'ordre alphabétique le mettrait en premier et l'ordre inverse en dernier.
set -e
. "$(dirname "$0")/lib.sh"
"$(dirname "$0")/refs.sh" "$1"
repo=$1

for name in upstream backup; do
  git init -q --bare -b main "$1-$name.git"
  git -C "$repo" remote add "$name" "$1-$name.git"
done
git -C "$repo" push -q upstream main:main main:release/1.0
git -C "$repo" push -q backup main:main
git -C "$repo" fetch -q upstream
git -C "$repo" fetch -q backup

git -C "$repo" branch feat/api main
git -C "$repo" branch feat/ui/x main
git -C "$repo" branch feat/graph develop
git -C "$repo" tag v0.9.0 develop
