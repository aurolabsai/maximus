// Svenska förnamn. 24 979 stycken, från SCB via bolddp/swedish-names.
//
// Den finns för att grinden hade ett hål: namnvakten läser versaler, och
// folk skriver inte alltid med versaler. "hej jag har problem med ella
// nordin som jobbar hos oss på solgläntan i norrby" gick ut helt omaskad.
// Det är så folk skriver när de är stressade och skriver på telefonen.
//
// Listan löser också det ingen regel kunde: "Bettan" står i den. Ett
// smeknamn som är registrerat som tilltalsnamn hos SCB är ett tilltalsnamn.
//
// 152 namn är uteslutna för att de också är vanliga svenska ord — björn,
// dag, sol, ros. De maskeras ändå när de står med versal mitt i en mening,
// och det är namnvaktens jobb.

import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const VAG = new URL('../data/fornamn.txt', import.meta.url);

/// Laddas en gång, synkront, vid start. 177 KB — det märks inte, och ett
/// asynkront uppslag i en maskeringsloop hade varit en väg till att glömma
/// await på fel rad.
export const FORNAMN = new Set(readFileSync(VAG, 'utf8').split('\n').filter(Boolean));
