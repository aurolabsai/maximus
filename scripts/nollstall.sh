#!/bin/sh
# Nollställer Auros Maximus för en hel genomgång från noll (2026-10-06:
# "restart delux. Nollad. Så att vi kan mäta och se om/hur allt faktiskt
# fungerar som det ska, från onboarding till.. slutet.").
#
# Ingenting raderas: datan flyttas undan med tidsstämpel, och appens egen
# webbdata (panelens läge, vad du sett) likaså. macOS behörigheter (Kalender,
# Påminnelser, Automation, Full skivåtkomst) står kvar — de hör till appen,
# inte till datan. Molnnycklarna i nyckelringen rörs inte.
#
#   sh scripts/nollstall.sh            # data /tmp/maximus-visning, port 3262
#   sh scripts/nollstall.sh --tillbaka <backupmapp>   # ångra
set -e
cd "$(dirname "$0")/.."
DATA=${MAXIMUS_DATA:-/tmp/maximus-visning}
STAMP=$(date +%Y%m%d-%H%M%S)

APP=src-tauri/target/debug/bundle/macos/Maximus.app
# Startar den byggda appen som den är — ingen ombyggnad, så att en
# nollställning inte hänger på Xcode eller nyckelringen.
starta() { open -n --env MAXIMUS_PORT="${MAXIMUS_PORT:-3262}" --env MAXIMUS_DATA="$DATA" "$APP"; }

stoppa() {
  pkill -f 'Maximus.app/Contents/MacOS/maximus' || true
  pkill -f 'target/debug/maximus' || true
  while lsof -ti tcp:"${MAXIMUS_PORT:-3262}" >/dev/null; do sleep 1; done
}

if [ "$1" = "--tillbaka" ]; then
  [ -d "$2" ] || { echo "Ingen sådan backup: $2"; exit 1; }
  stoppa
  [ -d "$DATA" ] && mv "$DATA" "$DATA-nollad-$STAMP"
  mv "$2" "$DATA"
  echo "Tillbaka: $2 → $DATA"
  starta
  exit 0
fi

stoppa
BACKUP="$DATA-backup-$STAMP"
[ -d "$DATA" ] && mv "$DATA" "$BACKUP" && echo "Datan sparad: $BACKUP"
for d in "$HOME/Library/WebKit/ai.aurolabs.maximus" "$HOME/Library/WebKit/maximus" "$HOME/Library/Caches/ai.aurolabs.maximus"; do
  [ -d "$d" ] && mv "$d" "$d-backup-$STAMP" && echo "Webbdata sparad: $d-backup-$STAMP"
done
mkdir -p "$DATA"
starta
echo "Nollställd. Maximus börjar om från onboarding. Ångra: sh scripts/nollstall.sh --tillbaka $BACKUP"
