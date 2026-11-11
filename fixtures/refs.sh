#!/bin/sh
# Dépôt avec toutes les sortes de refs. Usage : refs.sh <dossier> (crée <dossier>-origin.git et <dossier>-other)
# Part de branches.sh (main, feature/profiles, un merge, origin --bare), puis :
# - tags : v1.0.0 (léger, sur « Fix parser bug »), v1.1.0 (annoté, sur le merge) ;
# - develop, branche courante, suit origin/develop : en avance de 2 (« Rework files » et
#   « Signed work », le second portant un en-tête gpgsig factice) et en retard de 3 (« Remote one »,
#   « Remote two », « Remote three », poussés depuis un autre clone puis récupérés) ;
# - spike/gix : branche seulement distante (origin/spike/gix, jamais créée en local) ;
# - un stash « try notify debounce » (modification non validée de file.txt) ;
# - « Rework files » modifie file.txt, ajoute new.txt et supprime main.txt (M, A, D).
set -e
. "$(dirname "$0")/lib.sh"
"$(dirname "$0")/branches.sh" "$1"
repo=$1
other=$1-other
origin=$1-origin.git

git -C "$repo" tag v1.0.0 "$(git -C "$repo" rev-parse main~2)"
GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE=2024-01-15T10:00:00Z \
  git -C "$repo" tag -a v1.1.0 -m "Release 1.1.0" main

git -C "$repo" branch -q --set-upstream-to=origin/main main
git -C "$repo" checkout -q -b develop
git -C "$repo" push -q -u origin develop

git -C "$origin" symbolic-ref HEAD refs/heads/main
git clone -q "$origin" "$other"
git -C "$other" config user.name "Bob Durand"
git -C "$other" config user.email "bob@example.com"
git -C "$other" checkout -q develop
commit "$other" "Remote one" "Bob Durand" "bob@example.com" "2024-01-16T09:00:00Z"
commit "$other" "Remote two" "Bob Durand" "bob@example.com" "2024-01-16T10:00:00Z"
commit "$other" "Remote three" "Bob Durand" "bob@example.com" "2024-01-16T11:00:00Z"
git -C "$other" push -q origin develop
git -C "$other" checkout -q -b spike/gix
commit "$other" "Spike gix" "Bob Durand" "bob@example.com" "2024-01-16T12:00:00Z"
git -C "$other" push -q origin spike/gix
git -C "$repo" fetch -q origin

printf 'reworked\n' >> "$repo/file.txt"
printf 'new\n' > "$repo/new.txt"
git -C "$repo" rm -q main.txt
git -C "$repo" add file.txt new.txt
GIT_AUTHOR_NAME="Alice Martin" GIT_AUTHOR_EMAIL=alice@example.com GIT_AUTHOR_DATE=2024-01-17T09:00:00Z \
  GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE=2024-01-17T09:00:00Z \
    git -C "$repo" commit -q -m "Rework files"

tree=$(git -C "$repo" rev-parse 'HEAD^{tree}')
parent=$(git -C "$repo" rev-parse HEAD)
signed=$(printf 'tree %s\nparent %s\nauthor Alice Martin <alice@example.com> 1705568400 +0000\ncommitter Alice Martin <alice@example.com> 1705568400 +0000\ngpgsig -----BEGIN SSH SIGNATURE-----\n \n c2lnbmF0dXJl\n -----END SSH SIGNATURE-----\n\nSigned work\n' "$tree" "$parent" |
  git -C "$repo" hash-object -t commit -w --stdin)
git -C "$repo" update-ref refs/heads/develop "$signed"

printf 'debounce\n' >> "$repo/file.txt"
GIT_AUTHOR_NAME="Alice Martin" GIT_AUTHOR_EMAIL=alice@example.com GIT_AUTHOR_DATE=2024-01-20T09:00:00Z \
  GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE=2024-01-20T09:00:00Z \
    git -C "$repo" stash push -q -m "try notify debounce"
