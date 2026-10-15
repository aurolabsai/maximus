
import { mkdir, readdir, unlink, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tx } from './sprakstod.mjs';

export const SORTER = {
  docx: { slut: 'docx', namn: 'Word', typ: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { slut: 'xlsx', namn: 'Excel', typ: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  pptx: { slut: 'pptx', namn: 'PowerPoint', typ: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  pdf: { slut: 'pdf', namn: 'PDF', typ: 'application/pdf' },
  md: { slut: 'md', namn: 'Markdown', typ: 'text/markdown; charset=utf-8' },
};

export const arSort = s => Object.hasOwn(SORTER, String(s));

export const katalogen = (sessionskatalog, id) => join(sessionskatalog, id);

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

export async function las(maximus, sessionskatalog, sessionsId, artefaktId) {
  return maximus.lasRa(join(katalogen(sessionskatalog, sessionsId), `${artefaktId}.maximus`));
}

export async function taBort(sessionskatalog, sessionsId, artefaktId) {
  await unlink(join(katalogen(sessionskatalog, sessionsId), `${artefaktId}.maximus`)).catch(e => {
    if (e.code !== 'ENOENT') throw e;
  });
  await readdir(katalogen(sessionskatalog, sessionsId))
    .then(f => (f.length ? null : rm(katalogen(sessionskatalog, sessionsId), { recursive: true })))
    .catch(() => {});
}

export const taBortAlla = (sessionskatalog, sessionsId) =>
  rm(katalogen(sessionskatalog, sessionsId), { recursive: true, force: true });

export async function foraldralosa(sessionskatalog, sessionsId, kanda) {
  const kat = katalogen(sessionskatalog, sessionsId);
  const vet = new Set((kanda || []).map(a => `${a.id}.maximus`));
  const filer = await readdir(kat).catch(() => []);
  return filer.filter(f => f.endsWith('.maximus') && !vet.has(f));
}

export async function storlek(sessionskatalog, sessionsId) {
  const kat = katalogen(sessionskatalog, sessionsId);
  let n = 0;
  for (const f of await readdir(kat).catch(() => [])) {
    n += await stat(join(kat, f)).then(s => s.size).catch(() => 0);
  }
  return n;
}
