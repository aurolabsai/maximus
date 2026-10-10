#!/usr/bin/env node
/// Ett släpp: bygg signerat, skriv manifestet, säg vad som fattas.
///
/// Uppdateringskanalen har tre delar och två av dem kan koden äga. Den
/// tredje — den privata signeringsnyckeln — är utgivarens och får aldrig
/// ligga i källkoden. Det här skriptet gör allt utom den, och säger rakt ut
/// vad som saknas i stället för att bygga något som inte går att uppdatera.
///
/// ── De tre delarna ───────────────────────────────────────────────────────
///
/// 1. NYCKELPARET. Görs en gång:
///
///        npx tauri signer generate -w ~/.maximus/slapp.key
///
///    Den publika nyckeln skrivs in i `src-tauri/tauri.slapp.conf.json`; den
///    privata ligger utanför förrådet.
///
///    Släppkonfigurationen är en EGEN fil med avsikt. `createUpdaterArtifacts`
///    i den vanliga konfigurationen hade fått varje utvecklingsbygge att
///    kräva signeringsnyckeln — och en byggkedja som inte går att köra utan
///    en hemlighet är en byggkedja bara en person kan köra.
///
/// 2. BYGGET. Kräver nyckeln i miljön, inte i en .env-fil:
///
///        export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.maximus/slapp.key)"
///        export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=…
///        node scripts/signera.mjs
///
/// 3. MANIFESTET. Det här skriptet läser signaturfilerna ur bygget och
///    skriver den JSON som tauri-plugin-updater läser — och som
///    lib/uppdatering.mjs läser med samma fältnamn.
///
/// ── Varför signaturen inte är valfri ─────────────────────────────────────
///
/// En uppdatering som installerar sig utan signaturkontroll är en bakdörr
/// med ett vänligt gränssnitt: den som kan svara på manifestets adress kan
/// byta ut appen. Därför vägrar skriptet skriva ett manifest där en plattform
/// saknar signatur — hellre inget släpp än ett osignerat.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Släppet kommer ur scripts/signera.mjs (bundle/slapp/): den signerade,
// notariserade appen och uppdateringsarkivet av just den. Tauris egna
// arkiv i bundle/macos är av ett ad hoc-bygge och används aldrig.
const BYGGT = join(ROT, 'src-tauri', 'target', 'release', 'bundle', 'slapp');
const UTAN_NOTARISERING = process.argv.includes('--utan-notarisering');

/// Var filerna hamnar. Adressen i manifestet måste vara den filen faktiskt
/// ligger på — ett manifest som pekar fel är ett manifest som ser rätt ut.
// Släppen ligger på GitHub (2026-10-09): aurolabsai/maximus, en release per
// version (taggen v<version>), och latest.json i varje release.
const BAS = process.env.MAXIMUS_SLAPP_BAS || 'https://github.com/aurolabsai/maximus/releases/download';

/// Vilken plattformsnyckel en byggd fil hör till.
///
/// Namnen måste stämma med lib/uppdatering.mjs `plattform()` och med det
/// tauri-plugin-updater frågar efter. Tre ställen, en stavning.
const PLATTFORM = [
  [/\.app\.tar\.gz$/, () => `darwin-${process.arch === 'arm64' ? 'aarch64' : 'x86_64'}`],
  // Ingen Windows-rad (granskningen 2026-10-09): 1.0 släpps bara för macOS.
  // Windows-bygget hade en `cmd /c start`-injektion och en svag nyckel;
  // det kommer tillbaka när de vägarna är provade på en Windows-dator.
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

// Mac: en .sig säger bara att uppdateringen kommer från oss. Gatekeeper
// kräver Apples kedja — signerad med Developer ID, notariserad, häftad. Utan
// den öppnas appen inte på en annan Mac (1.0.0, 2026-10-10), hur många .sig
// som än finns. --utan-notarisering finns för provmanifest, aldrig för ett släpp.
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

const vag = join(ROT, 'tmp', 'latest.json');
await writeFile(vag, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\nMAXIMUS ${version} — manifestet skrivet: ${vag}`);
for (const [p, v] of Object.entries(platforms)) console.log(`  ${p.padEnd(16)} ${v.url.split('/').pop()}`);
console.log(`\nLadda upp latest.json och filerna ovan till releasen v${version}: gh release create v${version} ...\n`);
