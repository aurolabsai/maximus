#!/bin/sh
# Håller MAXIMUS uppe — men väcker aldrig det som stängts med flit.
#
# Servern har fått SIGTERM gång på gång — ren nedstängning, kod 0, ingen
# krasch. Vem som skickar den är inte klarlagt: det är inte processgruppen
# (servern körs i egen session med init som förälder), inte cron, inte
# launchd, och inte vakten i test/. Tills det är utrett ska det ändå gå att
# använda appen.
#
# ── Men en vakt som inte kan se skillnad är värre än ingen vakt ───────────
#
# Den här startade om allt som gick ned, också en nedstängning någon bett
# om. Sett 2026-10-01: appen stängdes, servern låste Maximus och avslutade
# rent med kod 0 — och åtta sekunder senare stod den uppe igen med
# huvudnyckeln i minnet och modellen laddad. Användaren hade stängt MAXIMUS
# och MAXIMUS var igång.
#
# Servern lämnar därför ett märke när den gått ned med flit. Finns det har
# vakten inget jobb, och den avslutar i stället för att stå kvar och vänta
# på en port som ingen ska öppna.
#
# Startar om först när porten varit tyst TVÅ kontroller i rad. En enda
# missad kontroll är oftast en omstart som pågår, och en vakt som rusar in
# där startar två servrar som slåss om porten.
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
