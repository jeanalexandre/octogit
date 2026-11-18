#!/bin/sh
# Dépôt pour la recherche dans l'historique (S-30) : 120 commits linéaires sur main, assez pour que des
# résultats sortent de la fenêtre virtualisée. Usage : search.sh <dossier>
# Déterministe : un commit par minute depuis 2024-01-01T00:00:00Z, « Task n » avec un corps « Routine change n »,
# auteurs en rotation (Alice Martin, Bob Durand, Chloé Lefèvre). Exceptions, du plus ancien au plus récent :
# - 10 : résumé « Add notify watcher » ;
# - 30 : résumé « Refactor watcher », description « Uses the NOTIFY crate for events » (« notify » seulement dans le corps) ;
# - 45 : auteur « Zoé Quillet » <zq@example.com> (le seul de ce nom) ;
# - 60 : résumé « Tune notify debounce » ;
# - 110 : résumé « Drop notify ».
set -e
. "$(dirname "$0")/lib.sh"
init_repo "$1"
awk '
BEGIN {
  total = 120
  split("Alice Martin|Bob Durand|Chloé Lefèvre", authors, "|")
  split("alice@example.com|bob@example.com|chloe@example.com", emails, "|")
  base = 1704067200
  for (n = 1; n <= total; n++) {
    a = (n % 3) + 1
    name = authors[a]; email = emails[a]
    summary = "Task " n
    body = "Routine change " n
    if (n == 10) summary = "Add notify watcher"
    if (n == 30) { summary = "Refactor watcher"; body = "Uses the NOTIFY crate for events" }
    if (n == 45) { name = "Zoé Quillet"; email = "zq@example.com" }
    if (n == 60) summary = "Tune notify debounce"
    if (n == 110) summary = "Drop notify"
    msg = summary "\n\n" body
    printf "commit refs/heads/main\nmark :%d\n", n
    printf "author %s <%s> %d +0000\ncommitter %s <%s> %d +0000\n", name, email, base + 60 * n, name, email, base + 60 * n
    printf "data %d\n%s\n", length(msg), msg
    if (n > 1) printf "from :%d\n", n - 1
    content = "line " n
    printf "M 100644 inline file.txt\ndata %d\n%s\n\n", length(content), content
  }
}' | git -C "$1" fast-import --quiet --force
git -C "$1" reset -q --hard
