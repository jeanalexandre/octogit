#!/bin/sh
# Dépôt de 10 000 commits (lent à ouvrir à la main, rapide à créer : un seul `git fast-import`).
# Usage : large.sh <dossier>
# Déterministe : un commit par minute depuis 2024-01-01T00:00:00Z ; sur chaque dizaine, le 5e commit
# ouvre une branche et le 6e la fusionne dans main (« Commit n », auteurs en rotation).
set -e
. "$(dirname "$0")/lib.sh"
init_repo "$1"
awk '
BEGIN {
  total = 10000
  split("Alice Martin|Bob Durand|Jean-Alexandre Gautreau|Chloé Lefèvre", authors, "|")
  split("alice@example.com|bob@example.com|ja@example.com|chloe@example.com", emails, "|")
  base = 1704067200
  tip = 0; side = 0
  for (n = 1; n <= total; n++) {
    a = (n % 4) + 1
    r = n % 10
    msg = "Commit " n
    printf "commit refs/heads/main\nmark :%d\n", n
    printf "author %s <%s> %d +0000\ncommitter %s <%s> %d +0000\n", authors[a], emails[a], base + 60 * n, authors[a], emails[a], base + 60 * n
    printf "data %d\n%s\n", length(msg), msg
    if (r == 5) {
      # Commit de branche : issu de la pointe de main, mais main ne l avance pas.
      printf "from :%d\n", tip
      side = n
    } else {
      if (tip != 0) printf "from :%d\n", tip
      if (r == 6) printf "merge :%d\n", side
      tip = n
    }
    body = "line " n
    printf "M 100644 inline file.txt\ndata %d\n%s\n\n", length(body), body
  }
}' | git -C "$1" fast-import --quiet --force
git -C "$1" reset -q --hard
