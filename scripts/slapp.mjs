#!/usr/bin/env node

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { grind as provgrind, loggaUndantag } from './slappgrind.mjs';

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BYGGT = join(ROT, 'src-tauri', 'target', 'release', 'bundle', 'slapp');
const UTAN_NOTARISERING = process.argv.includes('--utan-notarisering');
const UTAN_PROV = (process.argv.find(a => a.startsWith('--utan-gemmaprov=')) || '').slice('--utan-gemmaprov='.length).trim();

const BAS = process.env.MAXIMUS_SLAPP_BAS || 'https://github.com/aurolabsai/maximus/releases/download';

const PLATTFORM = [
  [/\.app\.tar\.gz$/, () => `darwin-${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}`],
  [/\.AppImage$/, () => 'linux-x86_64'],
];

async function filer(kat) {
  const ut = [];
  for (const d of await readdir(kat, { withFileTypes: true }).catch(() => [])) {
    const v = join(kat, d.name);
    if (d.isDirectory()) ut.push(...await filer(v));
    else ut.push(v);
  }
  return ut;
}

const version = JSON.parse(await readFile(join(ROT, 'package.json'), 'utf8')).version;
const alla = await filer(BYGGT);
const sigar = alla.filter(f => f.endsWith('.sig'));

const brist = [];
if (!alla.length) brist.push(`Inget bygge i ${BYGGT}. Kör:\n`
  + '  node scripts/signera.mjs');
if (alla.length && !sigar.length) {
  brist.push('Bygget saknar .sig-filer. Bygg med släppkonfigurationen och nyckeln i miljön:\n'
    + '  node scripts/signera.mjs');
}

const konf = JSON.parse(await readFile(join(ROT, 'src-tauri', 'tauri.slapp.conf.json'), 'utf8'));
const pub = konf.plugins?.updater?.pubkey || '';
if (!pub || pub.startsWith('SÄTT-')) {
  brist.push('src-tauri/tauri.slapp.conf.json saknar en riktig plugins.updater.pubkey.\n'
    + '  Gör nyckelparet en gång:  npx tauri signer generate -w ~/.maximus/slapp.key\n'
    + '  Lägg den PUBLIKA nyckeln där. Den privata ligger utanför förrådet.');
}

const macApp = join(BYGGT, 'Maximus.app');
if (alla.some(f => f.endsWith('.app.tar.gz')) && !UTAN_NOTARISERING) {
  const { spawnSync } = await import('node:child_process');
  const prova = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return { ok: r.status === 0, ut: `${r.stdout}${r.stderr}`.trim() }; };
  const hafta = prova('xcrun', ['stapler', 'validate', macApp]);
  const gk = prova('spctl', ['--assess', '--type', 'execute', '--verbose=4', macApp]);
  if (!hafta.ok || !gk.ok) brist.push('Mac-appen är inte notariserad och häftad, och Gatekeeper avvisar den:\n'
    + `    stapler: ${hafta.ut.split('\n').pop()}\n    spctl:   ${gk.ut.split('\n').pop()}\n`
    + '  Bygg med node scripts/signera.mjs (Developer ID + notarisering).');
}

const prov = provgrind(ROT, { version });
if (!prov.ok && !UTAN_PROV) {
  brist.push('Provsviten mot den riktiga modellen har inte gått igenom för den här koden:\n'
    + prov.skal.map(x => `    ${x}\n`).join('')
    + '  Kör:  npm run gemmaprov   (hela sviten, inte --snabb)\n'
    + `  Resultatet läses ur ${prov.vag}.`);
}

if (brist.length) {
  console.error(`\nMAXIMUS ${version} — släppet är inte klart.\n`);
  for (const b of brist) console.error(`  ${b}\n`);
  console.error('Manifestet skrivs inte. Ett osignerat släpp är en bakdörr med ett\n'
    + 'vänligt gränssnitt: den som kan svara på manifestets adress byter ut appen.\n');
  process.exit(1);
}

const platforms = {};
for (const sig of sigar) {
  const fil = sig.replace(/\.sig$/, '');
  const namn = fil.split('/').pop();
  const nyckel = PLATTFORM.find(([r]) => r.test(namn))?.[1]();
  if (!nyckel) { console.error(`  hoppar över ${namn} — vet inte vilken plattform den hör till`); continue; }
  platforms[nyckel] = { signature: (await readFile(sig, 'utf8')).trim(), url: `${BAS}/v${version}/${namn}` };
}

if (!Object.keys(platforms).length) {
  console.error('Ingen signerad fil kändes igen. Manifestet skrivs inte.');
  process.exit(1);
}

const noter = await readFile(join(ROT, 'data', 'slapp.md'), 'utf8').catch(() => '');
const manifest = {
  version,
  notes: noter.trim().slice(0, 8000) || `MAXIMUS ${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};

if (!prov.ok) {
  const logg = loggaUndantag(ROT, { version, commit: prov.commit, skal: UTAN_PROV, brist: prov.skal });
  console.error(`\nVARNING: släppet går ut UTAN godkänt prov mot den riktiga modellen.\n  Skäl: ${UTAN_PROV}\n`
    + prov.skal.map(x => `  ${x}\n`).join('') + `  Uppskrivet i ${logg}.\n`);
}

const vag = join(ROT, 'tmp', 'latest.json');
await writeFile(vag, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nMAXIMUS ${version} — manifestet skrivet: ${vag}`);
for (const [p, v] of Object.entries(platforms)) console.log(`  ${p.padEnd(16)} ${v.url.split('/').pop()}`);
console.log(`\nLadda upp latest.json och filerna ovan till releasen v${version}: gh release create v${version} ...\n`);
