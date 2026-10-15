#!/bin/sh
set -e
cd "$(dirname "$0")/.."
PORT=${MAXIMUS_PORT:-3262}
DATA=${MAXIMUS_DATA:-/tmp/maximus-visning}
APP=src-tauri/target/debug/bundle/macos/Maximus.app
npx tauri build --debug --bundles app >/dev/null
ID=$(security find-identity -p codesigning 2>/dev/null | awk '/"Maximus lokal signering"/{print $2; exit}')
codesign --force --deep -s "${ID:--}" --identifier ai.aurolabs.maximus "$APP"
codesign --verify --deep --strict "$APP" || { echo "Signaturen gick inte att lägga (nyckelringen låst?). Appen startades inte om."; exit 1; }
pkill -f 'Maximus.app/Contents/MacOS/maximus' || true
pkill -f 'target/debug/maximus' || true
while lsof -ti tcp:"$PORT" >/dev/null; do sleep 1; done
open -n --env MAXIMUS_PORT="$PORT" --env MAXIMUS_DATA="$DATA" "$APP"
echo "Maximus.app startad · port $PORT · data $DATA"
