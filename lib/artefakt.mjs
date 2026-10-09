/// Artefakter: det sessionen producerat, som filer.
///
/// Ett samtal slutar ofta i något man ska lämna ifrån sig — ett yttrande,
/// ett underlag till en nämnd, en sammanställning. Hittills kunde man kopiera
/// texten. Nu blir den en fil som hör till ärendet.
///
/// ── Varför sessionen INTE blir en mapp ───────────────────────────────────
///
/// Det naturliga vore att göra varje session till en katalog och lägga allt
/// där. Men sessionen är EN krypterad fil som skrivs om vid varje fråga, och
/// bilagorna ligger redan inuti den.
///
/// Lade vi en presentation på fem megabyte där hade varje ny fråga i samma
/// samtal krypterat om och skrivit om de fem megabyten. Ett samtal med tjugo
/// frågor hade skrivit hundra megabyte till disk för en fil som aldrig
/// ändrades.
///
/// Alltså: sessionen förblir sin fil, och artefakterna får egna bredvid.
///
///     sessioner/<id>.json        samtalet, som förut
///     sessioner/<id>/<art>.maximus  en artefakt, eget kuvert
///
/// Katalogen heter samma som filens stam. I praktiken ÄR sessionen en mapp
/// — bara inte en som tvingar fram en omskrivning av allt för varje rad som
/// läggs till.
///
/// ── Nyckeln följer sessionen ─────────────────────────────────────────────
///
/// En artefakt bär samma uppgifter som samtalet den kom ur. Är sessionen
/// förseglad krypteras artefakten med sessionens nyckel och är borta med
/// koden; annars med huvudnyckeln.
///
/// Att lägga en docx i klartext bredvid en krypterad session vore att låsa
/// dörren och lämna fönstret öppet.

import { mkdir, readdir, unlink, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tx } from './sprakstod.mjs';

/// Filändelse och mimetyp per sort.
export const SORTER = {
  docx: { slut: 'docx', namn: 'Word', typ: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { slut: 'xlsx', namn: 'Excel', typ: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  pptx: { slut: 'pptx', namn: 'PowerPoint', typ: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  pdf: { slut: 'pdf', namn: 'PDF', typ: 'application/pdf' },
  md: { slut: 'md', namn: 'Markdown', typ: 'text/markdown; charset=utf-8' },
};

export const arSort = s => Object.hasOwn(SORTER, String(s));

/// Var en sessions artefakter bor.
export const katalogen = (sessionskatalog, id) => join(sessionskatalog, id);

/// Ett filnamn som går att lägga i en mapp på vilket system som helst.
///
/// Rubriken kommer ur ett samtal och kan innehålla snedstreck, kolon och
/// radbrytningar. Ett filnamn med ett snedstreck i är en katalog som inte
/// finns; ett med kolon är en fil Windows vägrar skriva.
export function filnamn(rubrik, sort) {
  const rent = String(rubrik || tx('artefakt.utanNamn'))
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .replace(/[. ]+$/, '');
  return `${rent || tx('artefakt.utanNamn')}.${SORTER[sort]?.slut || 'bin'}`;
}

/// Lägger en artefakt. Returnerar posten som ska stå i sessionen.
export async function lagg(maximus, sessionskatalog, session, { sort, rubrik, data, om = '', nyckel = null }) {
  if (!arSort(sort)) throw new Error(tx('artefakt.skriverInte', { sort }));
  const kat = katalogen(sessionskatalog, session.id);
  await mkdir(kat, { recursive: true });
  const id = randomUUID();
  await maximus.skrivFil(join(kat, `${id}.maximus`), data, { nyckel });
  return {
    id, sort, rubrik: String(rubrik || tx('artefakt.utanNamn')).slice(0, 120),
    namn: filnamn(rubrik, sort),
    om: String(om || '').slice(0, 300),
    byte: Buffer.isBuffer(data) ? data.length : Buffer.byteLength(String(data), 'utf8'),
    skapad: new Date().toISOString(),
  };
}

/// Hämtar bytena.
export async function las(maximus, sessionskatalog, sessionsId, artefaktId) {
  return maximus.lasRa(join(katalogen(sessionskatalog, sessionsId), `${artefaktId}.maximus`));
}

/// Tar bort en artefakt — filen och inget annat. Posten i sessionen plockas
/// av anroparen, som ändå ska spara sessionen.
export async function taBort(sessionskatalog, sessionsId, artefaktId) {
  await unlink(join(katalogen(sessionskatalog, sessionsId), `${artefaktId}.maximus`)).catch(e => {
    if (e.code !== 'ENOENT') throw e;
  });
  // Tom katalog städas bort. En mapp som ligger kvar utan innehåll är en
  // mapp någon öppnar och undrar över.
  await readdir(katalogen(sessionskatalog, sessionsId))
    .then(f => (f.length ? null : rm(katalogen(sessionskatalog, sessionsId), { recursive: true })))
    .catch(() => {});
}

/// Hela katalogen, när sessionen tas bort.
export const taBortAlla = (sessionskatalog, sessionsId) =>
  rm(katalogen(sessionskatalog, sessionsId), { recursive: true, force: true });

/// Vilka filer som faktiskt ligger där.
///
/// Används av städningen: en artefakt vars post försvunnit ur sessionen —
/// en avbruten skrivning, en återställd säkerhetskopia — ligger annars kvar
/// krypterad och osynlig för evigt.
export async function foraldralosa(sessionskatalog, sessionsId, kanda) {
  const kat = katalogen(sessionskatalog, sessionsId);
  const vet = new Set((kanda || []).map(a => `${a.id}.maximus`));
  const filer = await readdir(kat).catch(() => []);
  return filer.filter(f => f.endsWith('.maximus') && !vet.has(f));
}

/// Hur mycket en sessions artefakter väger.
export async function storlek(sessionskatalog, sessionsId) {
  const kat = katalogen(sessionskatalog, sessionsId);
  let n = 0;
  for (const f of await readdir(kat).catch(() => [])) {
    n += await stat(join(kat, f)).then(s => s.size).catch(() => 0);
  }
  return n;
}
