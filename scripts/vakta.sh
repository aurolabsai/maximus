#!/bin/sh
PORT="${MAXIMUS_PORT:-3261}"
HAR=$(cd "$(dirname "$0")/.." && pwd)
lyssnar() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; }

DATA="${MAXIMUS_DATA:-$HOME/Library/Application Support/Maximus}"
MARKE="$DATA/stangd-med-flit"
avslutad() { [ -f "$MARKE" ]; }

tyst=0
while :; do
  if avslutad; then
    printf '\n── vakten slutar: MAXIMUS stängdes med flit %s ──\n' "$(cat "$MARKE")" \
      >> "${MAXIMUS_LOGG:-/tmp/maximus.log}"
    exit 0
  fi
  if lyssnar; then
    tyst=0
  else
    tyst=$((tyst+1))
    if [ "$tyst" -ge 2 ]; then
      printf '\n── vakten startar om, porten var tyst %s s ──\n' "$((tyst*5))" >> "${MAXIMUS_LOGG:-/tmp/maximus.log}"
      sh "$HAR/scripts/omstart.sh" >/dev/null 2>&1
      tyst=0
      sleep 10
    fi
  fi
  sleep 5
done
