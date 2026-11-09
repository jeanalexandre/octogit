#!/bin/sh
# Dépôt sans commit. Usage : empty.sh <dossier>
set -e
. "$(dirname "$0")/lib.sh"
init_repo "$1"
