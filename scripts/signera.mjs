#!/usr/bin/env node
/// Signering och notarisering av Mac-släppet. Ett kommando, från källkod till
/// en DMG som öppnas utan varning på en Mac som aldrig sett appen.
///
///   node scripts/signera.mjs            skarpt: Developer ID + notarisering
///   node scripts/signera.mjs --prov     provkörning med ad hoc-signatur: allt
///                                       utom Apples notarisering, för att se
///                                       att flödet håller innan certifikatet finns
///
/// Varför ett eget flöde och inte bara `tauri build` med en identitet:
/// appen bär 42 körbara filer och bibliotek (Node, llama-server, whisper-cli,
/// Swift-hjälparna, ggml-biblioteken). Apple avvisar notariseringen om en
/// enda av dem saknar signatur, hardened runtime eller tidsstämpel, och Node
/// dör under hardened runtime utan sina JIT-rättigheter. De signeras här en
/// och en, inifrån och ut — aldrig med ett blint --deep (2026-10-10, efter att
/// 1.0.0 inte gick att öppna på en annan Mac).
///
/// Uppdateringssignaturen (minisign/Ed25519, .sig) och Apples signatur är två
/// olika saker. .sig säger att uppdateringen kommer från oss; Apples kedja
/// säger att Gatekeeper får öppna den. Det här skriptet gör båda, i den
/// ordningen: uppdateringsarkivet byggs först av den färdiga, häftade appen.
///
/// Apple kräver tre saker som bara kontoinnehavaren kan skaffa:
///   1. Medlemskap i Apple Developer Program.
///   2. Ett Developer ID Application-certifikat (med privat nyckel) i nyckelringen.
///   3. Notariseringsåtkomst, sparad i nyckelringen en gång:
///        xcrun notarytool store-credentials maximus
///      (Apple-id + appspecifikt lösenord, eller en App Store Connect-nyckel).
///      Lösenordet skrivs i terminalen, aldrig i ett skript eller en chatt.

import { spawn } from 'node:child_process';
import { readdir, rm, mkdir, cp, symlink, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROV = process.argv.includes('--prov');
const PROFIL = process.env.MAXIMUS_NOTARY_PROFIL || 'maximus';
const RATT = join(ROT, 'src-tauri', 'entitlements');
const BYGGT = join(ROT, 'src-tauri', 'target', 'release', 'bundle');
const UT = join(BYGGT, 'slapp');

/// Kör ett kommando och ger tillbaka exitkoden och ALL utskrift. codesign,
/// spctl och stapler skriver sina besked på stderr; ett omslag som bara läste
/// stdout och struntade i koden kunde aldrig se ett fel (det gamla `tyst`).
function kor(cmd, args, { env, cwd, visa = false } = {}) {
  return new Promise(los => {
    const p = spawn(cmd, args, { cwd: cwd || ROT, env: env || process.env });
    let ut = '';
    const ta = d => { ut += d; if (visa) process.stdout.write(d); };
    p.stdout.on('data', ta); p.stderr.on('data', ta);
    p.on('error', e => los({ kod: 127, ut: String(e.message) }));
    p.on('close', kod => los({ kod, ut }));
  });
}
const maste = async (vad, cmd, args, opt) => {
  const r = await kor(cmd, args, opt);
  if (r.kod !== 0) { console.error(`\n✗ ${vad} (kod ${r.kod})\n${r.ut.trim().split('\n').slice(-25).join('\n')}\n`); process.exit(1); }
  return r.ut;
};

if (process.platform !== 'darwin') { console.error('Mac-släppet byggs på macOS.'); process.exit(1); }
const version = JSON.parse(await readFile(join(ROT, 'package.json'), 'utf8')).version;
console.log(`\nMAXIMUS ${version} — ${PROV ? 'PROVKÖRNING (ad hoc, ingen notarisering)' : 'Developer ID och notarisering'}\n`);

// ── Vad finns? ────────────────────────────────────────────────────────────

const brist = [];
let identitet = '-';
if (!PROV) {
  const id = (await kor('security', ['find-identity', '-v', '-p', 'codesigning'])).ut;
  const devId = [...id.matchAll(/"(Developer ID Application:[^"]+)"/g)].map(m => m[1]);
  if (process.env.APPLE_SIGNING_IDENTITY) identitet = process.env.APPLE_SIGNING_IDENTITY;
  else if (devId.length === 1) identitet = devId[0];
  else if (devId.length > 1) brist.push(`Flera Developer ID-certifikat. Välj ett:\n${devId.map(d => `    export APPLE_SIGNING_IDENTITY="${d}"`).join('\n')}`);
  else brist.push(`Inget Developer ID Application-certifikat med privat nyckel i nyckelringen.
    developer.apple.com/account → Certificates → + → Developer ID Application.
    Skapa begäran i Nyckelhanterarens Certifikatassistent på DEN HÄR datorn, så
    att den privata nyckeln hamnar här. Kontrollera: security find-identity -v -p codesigning`);
  const n = await kor('xcrun', ['notarytool', 'history', '--keychain-profile', PROFIL]);
  if (n.kod !== 0) brist.push(`Ingen notariseringsprofil "${PROFIL}" i nyckelringen. Kör en gång, i terminalen:
    xcrun notarytool store-credentials ${PROFIL}`);
}
const nyckel = process.env.TAURI_SIGNING_PRIVATE_KEY
  || await readFile(join(homedir(), '.maximus', 'slapp.key'), 'utf8').catch(() => '');
if (!nyckel) brist.push('Uppdateringsnyckeln saknas (~/.maximus/slapp.key eller TAURI_SIGNING_PRIVATE_KEY).');
if (brist.length) {
  console.error('Släppet kan inte byggas än:\n');
  for (const b of brist) console.error(`  • ${b}\n`);
  process.exit(1);
}
console.log(`  signerar med: ${identitet}\n`);

// ── 1. Bygg appen (osignerad uppdatering; den görs om på slutet) ──────────

await maste('Bygget', 'npx', ['tauri', 'build', '--bundles', 'app', '--config', 'src-tauri/tauri.slapp.conf.json'],
  { env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: nyckel, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '' }, visa: false });
// Tauris egna uppdateringsarkiv är av den ad hoc-signerade appen. De får inte
// följa med: slapp.mjs ska bara hitta det som görs av den notariserade appen.
for (const f of await readdir(join(BYGGT, 'macos')).catch(() => []))
  if (f.endsWith('.tar.gz') || f.endsWith('.tar.gz.sig')) await rm(join(BYGGT, 'macos', f));
await rm(UT, { recursive: true, force: true });
await mkdir(UT, { recursive: true });
const APP = join(UT, 'Maximus.app');
await cp(join(BYGGT, 'macos', 'Maximus.app'), APP, { recursive: true, verbatimSymlinks: true });
console.log('✓ byggd');

// ── 2. Signera inifrån och ut ─────────────────────────────────────────────

async function machO(kat) {
  const ut = [];
  for (const d of await readdir(kat, { withFileTypes: true })) {
    const v = join(kat, d.name);
    if (d.isSymbolicLink()) continue;
    if (d.isDirectory()) { ut.push(...await machO(v)); continue; }
    const typ = (await kor('file', ['-b', v])).ut;
    if (/Mach-O/.test(typ)) ut.push(v);
  }
  return ut;
}
const RES = join(APP, 'Contents', 'Resources');
const filer = await machO(RES);
const bibliotek = filer.filter(f => f.endsWith('.dylib'));
const program = filer.filter(f => !f.endsWith('.dylib'));
const ratt = f => f.endsWith('/node') ? 'node.plist' : 'hjalpare.plist';
// Bibliotekskontrollen (hardened runtime) kräver samma Team ID på program och
// bibliotek. Ad hoc har inget Team ID, så i provkörningen kunde llama-server
// inte ladda sina egna bibliotek. Bara provet får släppa på kontrollen; det
// skarpa släppet har ett Team ID överallt och behåller den.
const PROVRATT = join(UT, 'prov-rattigheter');
if (PROV) {
  await mkdir(PROVRATT, { recursive: true });
  for (const f of ['node.plist', 'hjalpare.plist', 'app.plist']) {
    const x = await readFile(join(RATT, f), 'utf8');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(PROVRATT, f), x.replace('<dict>', '<dict>\n  <key>com.apple.security.cs.disable-library-validation</key><true/>'));
  }
}
const rattKat = PROV ? PROVRATT : RATT;
const sign = (fil, plist) => ['--force', '--sign', identitet, '--options', 'runtime',
  ...(PROV ? [] : ['--timestamp']), ...(plist ? ['--entitlements', join(rattKat, plist)] : []), fil];

for (const f of bibliotek) await maste(`Signera ${f.slice(RES.length)}`, 'codesign', sign(f, null));
for (const f of program) await maste(`Signera ${f.slice(RES.length)}`, 'codesign', sign(f, ratt(f)));
await maste('Signera appen', 'codesign', sign(APP, 'app.plist'));
if (PROV) await rm(PROVRATT, { recursive: true, force: true });
console.log(`✓ signerad: ${bibliotek.length} bibliotek, ${program.length} program, appen`);

// Varje fil för sig, strikt, och appen som helhet.
for (const f of [...filer, APP]) await maste(`Signaturen håller inte: ${f.slice(UT.length)}`, 'codesign', ['--verify', '--strict', '--verbose=2', f]);
for (const f of program) {
  const d = await maste(`Läs ${f}`, 'codesign', ['-d', '--verbose=2', f]);
  if (!/flags=.*runtime/.test(d)) { console.error(`✗ ${f} saknar hardened runtime`); process.exit(1); }
}
console.log('✓ alla signaturer håller, hardened runtime överallt');

// ── 3. Notarisera och häfta appen ─────────────────────────────────────────

async function notarisera(fil, vad) {
  if (PROV) { console.log(`– ${vad}: notariseras inte i provkörningen`); return; }
  const r = await kor('xcrun', ['notarytool', 'submit', fil, '--keychain-profile', PROFIL, '--wait', '--output-format', 'json']);
  let svar = {}; try { svar = JSON.parse(r.ut.slice(r.ut.indexOf('{'))); } catch {}
  if (r.kod !== 0 || svar.status !== 'Accepted') {
    console.error(`\n✗ Apple godkände inte ${vad}: ${svar.status || 'okänt'} (kod ${r.kod})`);
    if (svar.id) console.error((await kor('xcrun', ['notarytool', 'log', svar.id, '--keychain-profile', PROFIL])).ut);
    else console.error(r.ut);
    process.exit(1);
  }
  console.log(`✓ ${vad}: Accepted (${svar.id})`);
}
const zip = join(UT, 'Maximus-notarisering.zip');
await maste('Packa för notarisering', 'ditto', ['-c', '-k', '--keepParent', APP, zip]);
await notarisera(zip, 'appen');
await rm(zip);
if (!PROV) {
  await maste('Häfta appen', 'xcrun', ['stapler', 'staple', APP]);
  await maste('Häftningen håller inte', 'xcrun', ['stapler', 'validate', APP]);
  await maste('Gatekeeper avvisar appen', 'spctl', ['--assess', '--type', 'execute', '--verbose=4', APP]);
  console.log('✓ appen häftad och godkänd av Gatekeeper');
}

// ── 4. Uppdateringsarkivet av den färdiga appen ───────────────────────────

const arkiv = join(UT, 'Maximus.app.tar.gz');
await maste('Packa uppdateringen', 'tar', ['-czf', arkiv, '-C', UT, 'Maximus.app']);
// Nyckeln via miljön, aldrig som argument: argument syns i processlistan.
await maste('Signera uppdateringen', 'npx', ['tauri', 'signer', 'sign', arkiv],
  { env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: nyckel, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: '' } });
await stat(`${arkiv}.sig`);
console.log('✓ uppdateringsarkiv och .sig av den slutliga appen');

// ── 5. DMG: bygg, signera, notarisera, häfta ──────────────────────────────

const dmg = join(UT, `Maximus_${version}_aarch64.dmg`);
const lada = join(UT, 'dmg');
await mkdir(lada, { recursive: true });
await maste('Kopiera till DMG', 'ditto', [APP, join(lada, 'Maximus.app')]);
await symlink('/Applications', join(lada, 'Applications'));
await maste('Skapa DMG', 'hdiutil', ['create', '-volname', 'Maximus', '-srcfolder', lada, '-ov', '-format', 'UDZO', dmg]);
await rm(lada, { recursive: true });
await maste('Signera DMG', 'codesign', ['--force', '--sign', identitet, ...(PROV ? [] : ['--timestamp']), dmg]);
await notarisera(dmg, 'DMG:n');
if (!PROV) {
  await maste('Häfta DMG:n', 'xcrun', ['stapler', 'staple', dmg]);
  await maste('Häftningen på DMG:n håller inte', 'xcrun', ['stapler', 'validate', dmg]);
  await maste('Gatekeeper avvisar DMG:n', 'spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=4', dmg]);
}
console.log(`✓ ${dmg.slice(ROT.length + 1)}`);

console.log(PROV
  ? '\nProvkörningen höll hela vägen. Skarpt släpp kräver certifikatet och notariseringen.\n'
  : `\nKlart. Allt i ${UT.slice(ROT.length + 1)}/. Kör node scripts/slapp.mjs för manifestet.\n`);
