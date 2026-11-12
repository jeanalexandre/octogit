#!/bin/sh
# Dépôt à beaucoup de lanes. Usage : wide.sh <dossier>
# Part de simple.sh (3 commits sur main), puis 40 branches « lane-01 » à « lane-40 » qui partent de
# « Initial commit » et portent chacune un commit : chaque pointe occupe sa lane, le graphe compte
# plus de 40 lanes, soit plus de 1 000 px, au-delà de 40 % de la zone du graphe à toute taille d'écran.
set -e
. "$(dirname "$0")/lib.sh"
"$(dirname "$0")/simple.sh" "$1"
repo=$1

n=1
while [ "$n" -le 40 ]; do
  name=$(printf 'lane-%02d' "$n")
  git -C "$repo" checkout -q -b "$name" main~2
  commit "$repo" "Work $name" "Bob Durand" "bob@example.com" "$(printf '2024-02-%02dT09:00:00Z' $(( (n - 1) / 2 + 1 )))"
  n=$((n + 1))
done
git -C "$repo" checkout -q main
