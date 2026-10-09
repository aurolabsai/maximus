#!/bin/sh
# För in koden i den byggda appen utan att bygga om, signerar och startar om.
#
# Signeringen provas FÖRST, på en kopia av en fil. 2026-10-06 kördes rsync
# medan nyckelringen var låst: koden kom in, signaturen gick inte att lägga,
# och appen stod med en trasig signatur. macOS kände då inte igen den — och
# frågade om Kalendern igen och igen, fast lovet redan var givet.
#
#   sh scripts/synka-appen.sh
set -e
cd "$(dirname "$0")/.."
PORT=${MAXIMUS_PORT:-3262}
DATA=${MAXIMUS_DATA:-/tmp/maximus-visning}
APP=src-tauri/target/debug/bundle/macos/Maximus.app
B=$APP/Contents/Resources/resources/backend
ID=$(security find-identity -p codesigning 2>/dev/null | awk '/"Maximus lokal signering"/{print $2; exit}')
[ -n "$ID" ] || { echo "Certifikatet \"Maximus lokal signering\" saknas — kör kor-appen.sh."; exit 1; }
PROV=$(mktemp -d)/prov; cp /usr/bin/true "$PROV"
codesign --force -s "$ID" "$PROV" 2>/dev/null || { echo "Nyckelringen är låst — appen rördes inte. Lås upp och kör igen."; exit 1; }
for d in lib public verktyg data lagar; do rsync -a --delete --exclude "/utokning/" "$d/" "$B/$d/"; done
cp server.mjs package.json "$B/"
codesign --force --deep -s "$ID" --identifier ai.aurolabs.maximus "$APP"
codesign --verify --deep --strict "$APP"
pkill -f 'Maximus.app/Contents/MacOS/maximus' || true
while lsof -ti tcp:"$PORT" >/dev/null; do sleep 1; done
open -n --env MAXIMUS_PORT="$PORT" --env MAXIMUS_DATA="$DATA" "$APP"
echo "Synkad, signerad och startad · port $PORT"
