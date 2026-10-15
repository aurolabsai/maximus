#!/usr/bin/env node

import { readFile, readdir, stat, access, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const kor = promisify(execFile);
const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function hittaPaket() {
  const kandidater = [];
  const arg = process.argv[2];
  if (arg) kandidater.push(join(arg, 'Contents', 'Resources', 'resources'), join(arg, 'Contents', 'Resources'));
  else {
    const macos = join(ROT, 'src-tauri', 'target', 'release', 'bundle', 'macos');
    const app = (await readdir(macos).catch(() => [])).find(f => f.endsWith('.app'));
    if (app) kandidater.push(join(macos, app, 'Contents', 'Resources', 'resources'),
      join(macos, app, 'Contents', 'Resources'));
  }
  kandidater.push(join(ROT, 'src-tauri', 'resources'));
  for (const k of kandidater) {
    try { await access(join(k, 'backend', 'server.mjs')); return k; } catch {  }
  }
  return kandidater[0];
}

const paket = await hittaPaket();
const byggt = paket.includes('.app/');
const prov = [];
const finns = async v => { try { await access(v); return true; } catch { return false; } };

async function allaFiler(kat, ut = []) {
  for (const d of await readdir(kat, { withFileTypes: true }).catch(() => [])) {
    const v = join(kat, d.name);
    if (d.isDirectory()) await allaFiler(v, ut);
    else if (d.isFile()) ut.push(v);
  }
  return ut;
}

const backend = join(paket, 'backend');
for (const del of ['server.mjs', 'lib', 'public', 'data', 'lagar', 'package.json']) {
  prov.push([`backend/${del} följer med`, await finns(join(backend, del)),
    'klargor-skrivbord.mjs packade den inte — se DELAR i den filen']);
}

prov.push(['playwright följer med', await finns(join(backend, 'node_modules', 'playwright')),
  'utan den finns ingen webbfunktion alls i den byggda appen']);

const node = join(paket, process.platform === 'win32' ? 'node.exe' : 'node');
const harNode = await finns(node);
prov.push(['en egen Node följer med', harNode, 'appen skulle använda datorns node, om den finns']);
if (harNode) {
  const s = await stat(node);
  prov.push(['Node går att köra', Boolean(s.mode & constants.S_IXUSR), 'körflaggan försvann i packningen']);
  const v = await kor(node, ['--version']).then(r => r.stdout.trim()).catch(() => '');
  prov.push([`Node svarar (${v || 'inget svar'})`, /^v\d+/.test(v), 'den packade binären körs inte här']);
}

const bin = join(paket, 'bin');
const binfiler = await readdir(bin).catch(() => []);
prov.push(['modellservern följer med', binfiler.length > 0,
  'utan llama-server finns ingen lokal modell — kör scripts/hamta-llama.mjs']);

const HEM = process.env.HOME || '';
const misstankta = [];
if (byggt || await finns(backend)) {
  for (const f of await allaFiler(backend)) {
    if (!/\.(mjs|js|json|md|sh)$/.test(f)) continue;
    if (f.includes('/node_modules/')) continue;
    const t = await readFile(f, 'utf8').catch(() => '');
    for (const rad of t.split('\n')) {
      if (/^\s*(\/\/|\/\*|\*|#)/.test(rad)) continue;
      if (HEM && rad.includes(HEM)) misstankta.push(`${f.replace(paket, '')}: ${rad.trim().slice(0, 90)}`);
      else if (/['"`]\/Users\/[^/'"`]+/.test(rad)) misstankta.push(`${f.replace(paket, '')}: ${rad.trim().slice(0, 90)}`);
    }
  }
}
prov.push(['ingen sökväg till byggmaskinen', misstankta.length === 0,
  misstankta.slice(0, 5).join('\n      ')]);

if (harNode && await finns(join(backend, 'server.mjs'))) {
  const tom = await mkdtemp(join(tmpdir(), 'maximus-ren-'));
  const ut = await new Promise(los => {
    const p = execFile(node, [join(backend, 'server.mjs')],
      { env: { ...process.env, MAXIMUS_DATA: tom, PORT: '3399', MAXIMUS_INGEN_MODELL: '1' } },
      () => {});
    let text = '';
    const lyss = d => {
      text += d;
      if (/http:\/\/127\.0\.0\.1|MAXIMUS \d/.test(text)) { p.kill(); los(text); }
    };
    p.stdout?.on('data', lyss);
    p.stderr?.on('data', lyss);
    setTimeout(() => { p.kill(); los(text); }, 12000);
  });
  await rm(tom, { recursive: true, force: true });
  prov.push(['servern startar mot en tom datamapp', /MAXIMUS \d|127\.0\.0\.1/.test(ut),
    ut.trim().split('\n').slice(-3).join('\n      ') || 'inget svar på tolv sekunder']);
}

console.log(`\nMAXIMUS — prov på ${byggt ? 'det byggda paketet' : 'förrådets resurser (inget bygge hittat)'}`);
console.log(`  ${paket}\n`);
let allt = true;
for (const [vad, ok, varfor] of prov) {
  allt = allt && ok;
  console.log(`  ${ok ? '✓' : '✗'} ${vad}`);
  if (!ok && varfor) console.log(`      ${varfor}`);
}

console.log(byggt ? '' : '\n  Bygg först för det riktiga provet:'
  + '\n    node scripts/signera.mjs');
console.log(allt
  ? '\nIngenting som bara fungerar här.\n'
  : '\nNågot skulle fattas hos en kund.\n');

console.log('Kvar att prova på en dator som aldrig sett appen:');
console.log('  · Gatekeeper släpper igenom den hämtade filen (scripts/signera.mjs kontrollerar bygget)');
console.log('  · macOS frågar om Mail och Kalender vid första användningen, och nej fungerar');
console.log('  · modellen hämtas vid första starten och ryms på disken');
console.log('  · en dator utan Rosetta, om bygget är x86_64\n');
process.exit(allt ? 0 : 1);
