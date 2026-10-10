// Packar MAXIMUS för skrivbordet: servern, dess filer och en egen Node.
//
// Appen ska inte kräva att kunden har Node installerat, och den ska inte
// använda den Node som råkar ligga i PATH — en handläggares dator har vad
// IT har lagt dit. Runtime hämtas en gång, kontrolleras mot nodejs.org:s
// egna SHA256-summor, och läggs bredvid servern i paketet.
//
// Körberoendena räknas av npm (MODULER nedan) och kopieras ur node_modules;
// ingenting installeras här.

import { cp, mkdir, copyFile, readFile, writeFile, rm, stat, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const BACKEND = 'src-tauri/resources/backend';
const NODE = `src-tauri/resources/node${process.platform === 'win32' ? '.exe' : ''}`;

// Allt servern behöver, och ingenting annat. Prov, testfiler och planer
// hör hemma i repot, inte i en app hos en kund.
const DELAR = ['server.mjs', 'package.json', 'lib', 'public', 'data', 'lagar', 'verktyg'];

/// Playwright följer med, men inte webbläsaren.
///
/// Utan modulerna finns ingen webbfunktion alls i en byggd app — de låg inte
/// i DELAR och packades aldrig. Med dem blir det 18 MB. Chromium väger 196
/// till och packas inte: MAXIMUS använder systemets Chrome eller Edge om de
/// finns, och hämtar annars ett headless-skal vid behov. På Windows finns
/// Edge alltid.
// Och hela kedjan av körberoenden, räknad av npm själv — inte en lista för
// hand. PptxGenJS och docx (Fas 23) drar med sig jszip och ett tiotal
// små; en handskriven lista hade glömt något, och då fattas filerna först
// hos en kund. Typerna behövs inte för att köra.
const MODULER = execFileSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], { encoding: 'utf8' })
  .split('\n').map(r => r.trim()).filter(r => r.includes('/node_modules/'))
  .map(r => r.slice(r.indexOf('node_modules/') + 'node_modules/'.length))
  .filter((m, i, a) => !m.includes('/node_modules/') && !m.startsWith('@types/') && a.indexOf(m) === i);

await rm(BACKEND, { recursive: true, force: true });
await mkdir(BACKEND, { recursive: true });
// En valfri utökning (lib/utokning/, public/utokning/; se server.mjs) följer
// bara med i ett bygge som ber om det: MAXIMUS_MED_UTOKNING=1.
const utanUtokning = process.env.MAXIMUS_MED_UTOKNING !== '1';
const ejUtokning = kalla => !(utanUtokning && /(^|\/)(lib|public)\/utokning(\/|$)/.test(kalla.replaceAll('\\', '/')));
for (const del of DELAR) await cp(del, `${BACKEND}/${del}`, { recursive: true, filter: ejUtokning });
console.log(`  backend: ${DELAR.join(', ')}`);

for (const m of MODULER) {
  await cp(`node_modules/${m}`, `${BACKEND}/node_modules/${m}`, { recursive: true });
}
console.log(`  moduler: ${MODULER.join(', ')} (utan webbläsare)`);

/// Namnmodellens motor (2026-10-10): onnxruntime-node
/// följer med via package.json som allt annat, men bär färdiga binärer för
/// sex plattformar, 288 MB. Bara målet som byggs följer med — för en Mac med
/// M-chip ca 85 MB. Modellen själv packas inte: den hämtas från en låst
/// revision när användaren ber om den (lib/namnmodell.mjs).
const ORT_BIN = `${BACKEND}/node_modules/onnxruntime-node/bin`;
if (await stat(ORT_BIN).catch(() => null)) {
  for (const napi of await readdir(ORT_BIN)) {
    for (const plattform of await readdir(`${ORT_BIN}/${napi}`)) {
      const dir = `${ORT_BIN}/${napi}/${plattform}`;
      if (plattform !== process.platform) { await rm(dir, { recursive: true, force: true }); continue; }
      for (const ark of await readdir(dir)) if (ark !== process.arch) await rm(`${dir}/${ark}`, { recursive: true, force: true });
    }
  }
  console.log(`  onnxruntime-node: bara ${process.platform}-${process.arch}`);
}

/// Node-runtimen, fastnaglad (granskningen 2026-10-09).
///
/// Här hämtades `latest-v22.x` och kontrollerades mot SHASUMS256.txt från
/// samma server i samma anrop. Det fångar en trasig hämtning, inte en
/// utbytt: den som kan byta arkivet kan byta summan bredvid. Bygget var
/// dessutom inte reproducerbart — två byggen samma vecka kunde få olika Node.
///
/// Nu står versionen och summorna här, som i hamta-llama.mjs. Summorna är
/// lästa 2026-10-09 ur https://nodejs.org/dist/v22.23.3/SHASUMS256.txt (samma
/// innehåll under latest-v22.x samma dag). Signaturen på SHASUMS256.txt.asc
/// är inte kontrollerad; den som byter version gör det för hand och bör
/// kontrollera den med Nodes släppnycklar.
const NODE_VERSION = 'v22.23.3';
const NODE_SUMMOR = {
  'darwin-arm64': '23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53',
  'darwin-x64': '8a677b0219178efd6eb0e475457c4afb452b521a92f6e67845a73bd85727f2a8',
  'win-arm64': '33dad22e4cef5ee8f9fbb1b0d037fdacd0e56d12a4580f0d63f68b894deab535',
  'win-x64': '2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71',
};

// En runtime som redan ligger där återanvänds bara om den är rätt version.
// Förut räckte det att filen var större än 10 MB.
let finns = false;
try {
  finns = (await stat(NODE)).size > 10_000_000
    && execFileSync(NODE, ['--version'], { encoding: 'utf8' }).trim() === NODE_VERSION;
} catch { /* ska hämtas */ }
if (!finns) {
  // Windows packar sin runtime som zip och lägger node.exe i roten; unix som
  // tar.gz med den under bin/. Samma kontrollsumma, olika uppackning.
  const win = process.platform === 'win32';
  const arkitektur = win
    ? (process.arch === 'arm64' ? 'win-arm64' : 'win-x64')
    : (process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64');
  const slut = win ? '.zip' : '.tar.gz';
  const summa = NODE_SUMMOR[arkitektur];
  if (!summa) throw new Error(`Ingen Node-runtime för ${arkitektur}.`);
  const namn = `node-${NODE_VERSION}-${arkitektur}${slut}`;
  console.log(`  hämtar ${namn}…`);
  const svar = await fetch(`https://nodejs.org/dist/${NODE_VERSION}/${namn}`);
  if (!svar.ok) throw new Error(`Node-runtimen gick inte att hämta (HTTP ${svar.status}).`);
  const arkiv = Buffer.from(await svar.arrayBuffer());
  if (createHash('sha256').update(arkiv).digest('hex') !== summa)
    throw new Error('Node-runtimens kontrollsumma stämde inte mot den fastnaglade. Ingenting packas.');
  await mkdir('tmp/node', { recursive: true });
  const nere = `tmp/node/node${slut}`;
  await writeFile(nere, arkiv);
  const mapp = namn.replace(slut, '');
  if (win) {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Expand-Archive -Force -Path '${nere}' -DestinationPath 'tmp/node'`]);
    await copyFile(`tmp/node/${mapp}/node.exe`, NODE);
  } else {
    execFileSync('tar', ['-xzf', nere, '-C', 'tmp/node']);
    await copyFile(`tmp/node/${mapp}/bin/node`, NODE);
  }
  await rm('tmp/node', { recursive: true, force: true });
}
console.log(`  node: ${((await stat(NODE)).size / 1e6).toFixed(0)} MB`);

/// llama-server och dess bibliotek, för den plattform som byggs.
///
/// Utan dem letar MAXIMUS i /opt/homebrew/bin och hittar ingenting på en dator
/// utan Homebrew. Binärerna ligger inte i repot — de hämtas från ggml-orgs
/// släpp med fastnaglat byggnummer och kontrollsumma, se scripts/hamta-llama.mjs.
const MAL = process.platform === 'darwin'
  ? (process.arch === 'arm64' ? 'macos-arm64' : 'macos-x64')
  : (process.arch === 'arm64' ? 'win-arm64' : 'win-x64');
const LAGER = `src-tauri/llama/${MAL}`;
if (!(await stat(`${LAGER}/llama-server`).catch(() => stat(`${LAGER}/llama-server.exe`).catch(() => null)))) {
  console.log(`  llama-server saknas för ${MAL} — hämtar…`);
  execFileSync(process.execPath, ['scripts/hamta-llama.mjs', MAL], { stdio: 'inherit' });
}
// Bara målet som byggs följer med. En Mac-app ska inte bära Windows-binärer.
await rm('src-tauri/resources/bin', { recursive: true, force: true });
await cp(LAGER, 'src-tauri/resources/bin', { recursive: true, verbatimSymlinks: true });
const binfiler = await readdir('src-tauri/resources/bin');
console.log(`  llama-server: ${MAL}, ${binfiler.length} filer`);

/// Verktygen: whisper-cli, och på Mac de kompilerade hjälparna för PDF,
/// bildläsning och kalender (Fas 22). Byggs om de saknas, se
/// scripts/hamta-verktyg.mjs.
const VERKTYG = `src-tauri/verktyg-bin/${MAL}`;
if (!(await stat(`${VERKTYG}/whisper-cli`).catch(() => stat(`${VERKTYG}/whisper-cli.exe`).catch(() => null)))) {
  console.log(`  verktygen saknas för ${MAL} — bygger…`);
  execFileSync(process.execPath, ['scripts/hamta-verktyg.mjs', MAL], { stdio: 'inherit' });
}
await cp(VERKTYG, 'src-tauri/resources/bin', { recursive: true });
console.log(`  verktyg: ${(await readdir(VERKTYG)).join(', ')}`);
