#!/bin/sh
# Maximus — installation från Terminal.
#
#   curl -fsSL https://raw.githubusercontent.com/aurolabsai/maximus/main/install.sh | sh
#
# Hämtar senaste släppet från GitHub, kontrollerar sha256 mot GitHubs egen
# kontrollsumma, lägger appen i Program och startar den. Filer som curl hämtar
# får ingen karantänmärkning, så macOS frågar inte. Dina data i
# ~/Library/Application Support/Maximus rörs inte.
#
# MAXIMUS_MAL=<mapp>  installera någon annanstans än /Applications (prov)
# MAXIMUS_OPPNA=0     starta inte appen efteråt
set -eu

REPO=aurolabsai/maximus
FIL=Maximus.app.tar.gz
MAL=${MAXIMUS_MAL:-/Applications}

if defaults read -g AppleLanguages 2>/dev/null | grep -q '"\{0,1\}sv'; then SV=1; else SV=0; fi
say() { if [ "$SV" = 1 ]; then printf '%s\n' "$1"; else printf '%s\n' "$2"; fi; }
fel() { say "Maximus: $1" "Maximus: $2" >&2; exit 1; }

[ "$(uname -s)" = Darwin ] || fel "fungerar bara på macOS." "macOS only."
[ "$(uname -m)" = arm64 ] || fel "kräver en Mac med Apple-chip (M1 eller senare)." "requires a Mac with Apple silicon (M1 or later)."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

say "Letar efter senaste versionen…" "Looking up the latest version…"
curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" -o "$TMP/release.json" \
  || fel "kunde inte nå GitHub." "could not reach GitHub."

# JSON läses med macOS egen JavaScript, så inget behöver installeras först.
INFO=$(osascript -l JavaScript -e '
function run(a) {
  const r = JSON.parse($.NSString.stringWithContentsOfFileEncodingError(a[0], $.NSUTF8StringEncoding, null).js);
  const f = (r.assets || []).find(x => x.name === a[1]);
  return [r.tag_name || "", f ? f.browser_download_url : "", f && f.digest ? f.digest.replace(/^sha256:/, "") : ""].join(" ");
}' "$TMP/release.json" "$FIL") || fel "kunde inte läsa svaret från GitHub." "could not read GitHub's reply."
set -- $INFO
VERSION=${1:-}; URL=${2:-}; SUMMA=${3:-}
[ -n "$URL" ] && [ -n "$SUMMA" ] || fel "hittade ingen app i senaste släppet." "no app found in the latest release."
case "$URL" in "https://github.com/$REPO/releases/download/"*) ;; *) fel "oväntad nedladdningsadress." "unexpected download address." ;; esac

say "Hämtar Maximus ${VERSION}…" "Downloading Maximus ${VERSION}…"
curl -fL --progress-bar "$URL" -o "$TMP/$FIL" || fel "nedladdningen misslyckades." "the download failed."

FAKTISK=$(shasum -a 256 "$TMP/$FIL" | cut -d' ' -f1)
[ "$FAKTISK" = "$SUMMA" ] || fel "filen stämmer inte med GitHubs kontrollsumma — inget installerades." "the file does not match GitHub's checksum — nothing was installed."
say "Kontrollsumman stämmer." "Checksum verified."

mkdir -p "$TMP/app"
tar -xzf "$TMP/$FIL" -C "$TMP/app"
[ -d "$TMP/app/Maximus.app" ] || fel "paketet innehöll ingen Maximus.app." "the package contained no Maximus.app."
xattr -cr "$TMP/app/Maximus.app" 2>/dev/null || true

if pgrep -xq Maximus; then
  say "Stänger Maximus som är igång…" "Quitting the running Maximus…"
  osascript -e 'tell application "Maximus" to quit' >/dev/null 2>&1 || true
  i=0; while pgrep -xq Maximus && [ $i -lt 20 ]; do sleep 0.5; i=$((i + 1)); done
  pgrep -xq Maximus && fel "Maximus vill inte stänga. Stäng den och kör igen." "Maximus will not quit. Quit it and run this again."
fi

SUDO=
mkdir -p "$MAL" 2>/dev/null || true
if [ ! -w "$MAL" ]; then
  say "Program-mappen kräver ditt Mac-lösenord." "The Applications folder needs your Mac password."
  SUDO=sudo
fi
$SUDO rm -rf "$MAL/Maximus.app"
$SUDO mv "$TMP/app/Maximus.app" "$MAL/Maximus.app"

say "Klart: Maximus ${VERSION} ligger i ${MAL}." "Done: Maximus ${VERSION} is in ${MAL}."
if [ "${MAXIMUS_OPPNA:-1}" != 0 ]; then open "$MAL/Maximus.app"; fi
