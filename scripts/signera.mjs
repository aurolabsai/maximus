#!/usr/bin/env node
/// Signering och notarisering. Vägen fram, och vad som fattas.
///
/// Utan signatur möts varje maskin som inte är byggmaskinen av macOS
/// Gatekeeper: "Maximus kan inte öppnas eftersom utvecklaren inte kan
/// verifieras." Det är den första sekunden av produkten hos en ny kund, och
/// den säger att programmet inte går att lita på.
///
/// Apple kräver tre saker som bara en människa med ett konto kan skaffa:
///
///   1. Medlemskap i Apple Developer Program (99 USD/år).
///   2. Ett **Developer ID Application**-certifikat i nyckelringen. Bara
///      kontoinnehavaren kan skapa det.
///   3. Notariseringsuppgifter — antingen en API-nyckel från App Store
///      Connect (att föredra: går att återkalla) eller ett Apple-id med ett
///      appspecifikt lösenord.
///
/// Det här skriptet skaffar ingenting. Det TITTAR efter vad som finns, säger
/// exakt vad som saknas och var man får tag i det, och kör bygget när allt är
/// på plats. Sedan kontrollerar det resultatet — för ett bygge som säger sig
/// vara signerat och inte är det är värre än ett osignerat.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const kor = promisify(execFile);
const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tyst = async (cmd, args) => { try { return (await kor(cmd, args)).stdout; } catch (e) { return e.stdout || ''; } };

if (process.platform !== 'darwin') {
  console.error('Signering av macOS-appen görs på macOS. Windows har en egen väg, och den är inte byggd än.');
  process.exit(1);
}

// ── Vad finns? ────────────────────────────────────────────────────────────

const identiteter = await tyst('security', ['find-identity', '-v', '-p', 'codesigning']);
const devId = [...identiteter.matchAll(/"(Developer ID Application:[^"]+)"/g)].map(m => m[1]);

const env = process.env;
const harApiNyckel = Boolean(env.APPLE_API_ISSUER && env.APPLE_API_KEY && env.APPLE_API_KEY_PATH);
const harAppleId = Boolean(env.APPLE_ID && env.APPLE_PASSWORD && env.APPLE_TEAM_ID);

const brist = [];

if (!devId.length) {
  brist.push(`Inget **Developer ID Application**-certifikat i nyckelringen.

  Bara kontoinnehavaren kan skapa det:
    1. developer.apple.com → Certificates → + → Developer ID Application
    2. Ladda ned och dubbelklicka så hamnar det i nyckelringen
    3. Kontrollera: security find-identity -v -p codesigning

  Kräver medlemskap i Apple Developer Program, 99 USD/år. Det finns ingen
  väg runt det: Gatekeeper litar på Apples kedja, inte på oss.`);
} else if (devId.length > 1 && !env.APPLE_SIGNING_IDENTITY) {
  brist.push(`Flera Developer ID-certifikat finns. Säg vilket:
${devId.map(d => `    export APPLE_SIGNING_IDENTITY="${d}"`).join('\n')}`);
}

if (!harApiNyckel && !harAppleId) {
  brist.push(`Inga notariseringsuppgifter i miljön.

  Notarisering KRÄVS med ett Developer ID-certifikat. Utan den varnar
  Gatekeeper ändå, och då var signaturen förgäves.

  API-nyckel (att föredra — går att återkalla utan att röra ditt Apple-id):
    appstoreconnect.apple.com → Users and Access → Integrations → Keys
    export APPLE_API_ISSUER=…         (Issuer ID)
    export APPLE_API_KEY=…            (Key ID)
    export APPLE_API_KEY_PATH=~/.maximus/AuthKey_XXXX.p8

  Eller Apple-id med appspecifikt lösenord (appleid.apple.com → Sign-In and
  Security → App-Specific Passwords):
    export APPLE_ID=…  APPLE_PASSWORD=…  APPLE_TEAM_ID=…`);
}

if (brist.length) {
  console.error('\nMAXIMUS — bygget kan inte signeras än.\n');
  for (const b of brist) console.error(`  ${b.replace(/\n/g, '\n  ')}\n`);
  console.error('Inget byggs. Ett osignerat bygge som kallas signerat är sämre än inget.\n');
  process.exit(1);
}

// ── Bygg ──────────────────────────────────────────────────────────────────

const identitet = env.APPLE_SIGNING_IDENTITY || devId[0];
console.log(`\nMAXIMUS — signerar med:\n  ${identitet}`);
console.log(`  notarisering via ${harApiNyckel ? 'App Store Connect-nyckel' : 'Apple-id'}\n`);

const extra = process.argv.slice(2);
console.log('Bygger…\n');
try {
  await kor('npm', ['run', 'tauri', 'build', '--', ...extra],
    { cwd: ROT, env: { ...env, APPLE_SIGNING_IDENTITY: identitet }, maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  console.error((e.stdout || '').slice(-4000));
  console.error((e.stderr || '').slice(-4000));
  console.error('\nBygget gick inte igenom.\n');
  process.exit(1);
}

// ── Kontrollera ───────────────────────────────────────────────────────────
//
// Tre kontroller, för de svarar på tre olika frågor. Ett bygge kan vara
// signerat men inte notariserat, och notariserat men inte häftat — och då
// varnar Gatekeeper ändå på en maskin utan nät.

const kat = join(ROT, 'src-tauri', 'target', 'release', 'bundle', 'macos');
const app = (await readdir(kat).catch(() => [])).find(f => f.endsWith('.app'));
if (!app) { console.error(`Hittade ingen .app i ${kat}.`); process.exit(1); }
const vag = join(kat, app);

const prov = [
  ['Signaturen håller', await tyst('codesign', ['--verify', '--deep', '--strict', '--verbose=2', vag])],
  ['Gatekeeper släpper igenom', await tyst('spctl', ['--assess', '--type', 'execute', '--verbose=4', vag])],
  ['Notariseringen är häftad', await tyst('xcrun', ['stapler', 'validate', vag])],
];

console.log(`\nKontroll av ${app}:\n`);
let allt = true;
for (const [vad, ut] of prov) {
  // `spctl` skriver "accepted", `stapler` skriver "The validate action
  // worked", `codesign` skriver "satisfies its Designated Requirement".
  const ok = /accepted|satisfies its Designated Requirement|worked!/i.test(ut);
  allt = allt && ok;
  console.log(`  ${ok ? '✓' : '✗'} ${vad}`);
  if (!ok) console.log(`      ${ut.trim().split('\n').slice(0, 3).join('\n      ')}`);
}

console.log(allt
  ? '\nAppen öppnas utan varning på en maskin som aldrig sett den.\n'
  : '\nNågot håller inte. Ett bygge som inte klarar alla tre varnar hos kunden.\n');
process.exit(allt ? 0 : 1);
