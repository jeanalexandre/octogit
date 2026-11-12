#!/usr/bin/env bash
# Vérifie le .dmg produit par `pnpm tauri build` : il est monté en lecture seule et
# l'Octogit.app qu'il contient est contrôlée (signature ad hoc, arm64 seulement, macOS 13.0 minimum,
# icône identique à assets/icons/octogit.icns).
# Dossier du bundle : OCTOGIT_BUNDLE_DIR, sinon target/release/bundle (workspace Cargo).
set -u

root="$(cd "$(dirname "$0")/.." && pwd)"
bundle="${OCTOGIT_BUNDLE_DIR:-$root/target/release/bundle}"
fail() { echo "ECHEC : $*" >&2; exit 1; }

version="$(/usr/bin/plutil -extract version raw -o - "$root/src-tauri/tauri.conf.json" 2>/dev/null)" \
  || fail "version illisible dans src-tauri/tauri.conf.json"
dmg="$bundle/dmg/Octogit_${version}_aarch64.dmg"

[ -s "$dmg" ] || fail "$dmg absent ou vide : Octogit.app non vérifiable"

mnt="$(mktemp -d "${TMPDIR:-/tmp}/octogit-mnt.XXXXXX")" || fail "dossier temporaire impossible"
attached=0
cleanup() {
  if [ "$attached" -eq 1 ]; then hdiutil detach "$mnt" -force >/dev/null 2>&1 || hdiutil detach "$mnt" >/dev/null 2>&1; fi
  rmdir "$mnt" 2>/dev/null
}
trap cleanup EXIT
trap 'exit 130' INT TERM

hdiutil attach -readonly -nobrowse -noautoopen -mountpoint "$mnt" "$dmg" >/dev/null 2>&1 \
  || fail "montage impossible : $dmg"
attached=1

app="$mnt/Octogit.app"
[ -d "$app" ] || fail "Octogit.app absent du .dmg ($dmg)"

sig="$(codesign -dv "$app" 2>&1)"
echo "$sig" | grep -q '^Signature=adhoc' || fail "signature non ad hoc : $(echo "$sig" | grep -E '^(Signature|Authority)' | tr '\n' ' ')"
echo "$sig" | grep -q '^Authority=' && fail "identité Apple Developer présente"

plist="$app/Contents/Info.plist"
exe="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist" 2>&1)" \
  || fail "CFBundleExecutable illisible : $exe"
bin="$app/Contents/MacOS/$exe"
[ -f "$bin" ] || fail "exécutable déclaré absent : $bin"
archs="$(lipo -archs "$bin" 2>&1)"
[ "$archs" = "arm64" ] || fail "architectures '$archs' (attendu : arm64)"

min="$(/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$plist" 2>&1)" \
  || fail "LSMinimumSystemVersion illisible : $min"
printf '%s' "$min" | grep -Eq '^[0-9]+(\.[0-9]+)*$' || fail "LSMinimumSystemVersion '$min' invalide"
major="${min%%.*}"
# 13.0 est le plancher : tout numéro majeur >= 13 convient, quel que soit le mineur.
[ "$((10#$major))" -ge 13 ] || fail "LSMinimumSystemVersion '$min' (attendu : >= 13.0)"

icon="$app/Contents/Resources/icon.icns"
[ -f "$icon" ] || fail "icône absente : $icon"
cmp -s "$icon" "$root/assets/icons/octogit.icns" \
  || fail "Contents/Resources/icon.icns différente de assets/icons/octogit.icns (icône de remplacement ?)"

echo "OK : $dmg (Octogit.app adhoc, $archs, macOS >= $min, icône fournie)"
