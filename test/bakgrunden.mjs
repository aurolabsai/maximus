/// Fas 26 på riktigt: en server under launchd, med egen datakatalog och egen
/// port — aldrig användarens. Den startar, startas om när den
/// dödas, och går ner när läget slås av. Ingen modell laddas: utan fönster
/// laddas den först när ett varv behöver den.
import * as B from '../lib/bakgrund.mjs';
import { execFileSync } from 'node:child_process';
import { rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const data = '/tmp/maximus-bakgrund-prov', port = 3496;
const server = dirname(dirname(fileURLToPath(import.meta.url)));
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const vanta = async (villkor, s = 60) => { for (let i = 0; i < s * 2; i++) { if (await villkor()) return true; await new Promise(r => setTimeout(r, 500)); } return false; };
await rm(data, { recursive: true, force: true }); await mkdir(data, { recursive: true });
const o = { data, node: process.execPath, server, port, stig: process.env.PATH };
try {
  await B.slaPa('bakgrund', o);
  ok(await B.lage({ data }) === 'bakgrund', 'läget läses ur filen');
  ok(await vanta(() => B.portUpptagen(port)), 'launchd startade servern');
  const etik = B.etikett(data, 'bakgrund');
  const pid = () => Number((/pid = (\d+)/.exec(execFileSync('/bin/launchctl', ['print', `gui/${process.getuid()}/${etik}`]).toString()) || [])[1] || 0);
  const forsta = pid();
  ok(forsta > 0, `servern kör under launchd (pid ${forsta})`);
  const loggen = () => execFileSync('/bin/cat', [`${data}/server.log`]).toString();
  ok(!/Startar den lokala modellen/.test(loggen()), 'ingen modell laddades utan fönster');
  process.kill(forsta, 'SIGKILL');
  ok(await vanta(async () => pid() > 0 && pid() !== forsta && await B.portUpptagen(port), 30), 'dödad server startades om av launchd');
  // Övertagandet: appens server har porten. Den launchd startar väntar och
  // tar över först när porten blir ledig — aldrig två samtidigt.
  await B.slaAv('bakgrund', { data });
  await vanta(async () => !(await B.portUpptagen(port)), 20);
  const { createServer } = await import('node:net');
  const appens = createServer().listen(port, '127.0.0.1');
  await new Promise(r => appens.once('listening', r));
  await B.slaPa('bakgrund', o);
  ok(await vanta(() => /väntar och tar över/.test(loggen()), 30), 'med porten upptagen väntar bakgrundsservern');
  appens.close();
  ok(await vanta(() => /MAXIMUS 4/.test(loggen().split('väntar och tar över').at(-1)), 40), 'när appens server stängs tar den över');
  await B.slaAv('bakgrund', { data });
  ok(await vanta(async () => !(await B.portUpptagen(port)), 20), 'av: servern gick ner');
  ok(await B.lage({ data }) === 'oppen', 'av: filen är borta');
} finally {
  await B.slaAv('bakgrund', { data }).catch(() => {});
  await rm(data, { recursive: true, force: true }).catch(() => {});
}
process.exit(rott ? 1 : 0);
