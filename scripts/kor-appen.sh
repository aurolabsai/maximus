#!/bin/sh
# Bygger och startar Maximus som riktig .app (inte den nakna debug-binären).
# macOS frågar om Kalender/Påminnelser bara för en app med Info.plist och ett
# stabilt id — en binär startad från en terminal nekas tyst (2026-10-06).
#
#   sh scripts/kor-appen.sh            # port 3262, data /tmp/maximus-visning
#   MAXIMUS_PORT=… MAXIMUS_DATA=… sh scripts/kor-appen.sh
set -e
cd "$(dirname "$0")/.."
PORT=${MAXIMUS_PORT:-3262}
DATA=${MAXIMUS_DATA:-/tmp/maximus-visning}
APP=src-tauri/target/debug/bundle/macos/Maximus.app
npx tauri build --debug --bundles app >/dev/null
# Ett stabilt signeringsid gör att macOS minns lovet för Kalender och
# Påminnelser mellan byggena. Med en ad hoc-signatur är varje bygge en ny app
# för macOS, och frågan kommer igen (2026-10-06). Finns certifikatet
# "Maximus lokal signering" i nyckelringen används det, annars ad hoc.
ID=$(security find-identity -p codesigning 2>/dev/null | awk '/"Maximus lokal signering"/{print $2; exit}')
codesign --force --deep -s "${ID:--}" --identifier ai.aurolabs.maximus "$APP"
# En trasig signatur är värre än ingen: macOS frågar om lovet igen och igen.
codesign --verify --deep --strict "$APP" || { echo "Signaturen gick inte att lägga (nyckelringen låst?). Appen startades inte om."; exit 1; }
pkill -f 'Maximus.app/Contents/MacOS/maximus' || true
pkill -f 'target/debug/maximus' || true
while lsof -ti tcp:"$PORT" >/dev/null; do sleep 1; done
open -n --env MAXIMUS_PORT="$PORT" --env MAXIMUS_DATA="$DATA" "$APP"
echo "Maximus.app startad · port $PORT · data $DATA"
