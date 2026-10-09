#!/usr/bin/env node
/// Hämtar llama-server till appens egna resurser.
///
/// Skalet lade `/opt/homebrew/bin` i PATH och hoppades. På en dator utan
/// Homebrew och llama.cpp startade MAXIMUS, guiden visades, och sedan svarade
/// ingenting — utan att något sa varför. Turn-key betyder att ingenting ska
/// installeras vid sidan av.
///
/// Binärerna byggs inte här. ggml-org släpper dem färdiga för varje bygge,
/// signerade med sha256 i GitHubs eget API, och att bygga om llama.cpp själv
/// vore att ta på sig ett underhåll utan att vinna något.
///
///     node scripts/hamta-llama.mjs              alla mål
///     node scripts/hamta-llama.mjs macos-arm64  ett mål
///
/// Byggnumret står här och ingen annanstans. Ett paket ska gå att bygga om
/// och bli detsamma.

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, readdir, stat, lstat, readlink, symlink, chmod, cp } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const kor = promisify(execFile);
const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');
/// Binärerna hämtas hit, en katalog per mål. Bara den plattform som byggs
/// kopieras sedan in i resources — annars hade en Mac-app burit på Windows
/// binärer, och paketet vuxit från 29 MB till 162.
const DIT = join(ROT, 'src-tauri', 'llama');

/// Bygget. Byt här, och kör om skriptet.
const BYGGE = 'b11179';

/// Målen, och varför just de här paketen.
///
/// macOS: Metal-bygget, som är det enda som finns för Mac och det enda som
/// behövs — GPU:n sitter i samma chip.
///
/// Windows: Vulkan, inte CUDA. CUDA väger 240 MB, kräver ett Nvidia-kort och
/// rätt drivrutin. Vulkan ger GPU på AMD, Intel och Nvidia med samma 31 MB,
/// och faller tillbaka till processorn när inget kort svarar. En kommun köper
/// inte grafikkort till handläggarna.
const MAL = {
  'macos-arm64': {
    fil: `llama-${BYGGE}-bin-macos-arm64.tar.gz`,
    sha256: '7901d3315717a73b6af1facf3074c7b32b372330f236feba67a78b4f573b8437',
    om: 'Apple Silicon, Metal',
  },
  'macos-x64': {
    fil: `llama-${BYGGE}-bin-macos-x64.tar.gz`,
    sha256: 'c6d1e01d76c677dca301cf2edb89acf8e97f4cb031f6b6e0ecb31548e32b1271',
    om: 'Intel-Mac',
  },
  'win-x64': {
    fil: `llama-${BYGGE}-bin-win-vulkan-x64.zip`,
    sha256: 'cc70d58f661dccab723a855c78745a99dd5d55102fd8828fe883f070ad3a6f23',
    om: 'Windows, Vulkan — GPU hos AMD, Intel och Nvidia',
  },
  'win-arm64': {
    fil: `llama-${BYGGE}-bin-win-cpu-arm64.zip`,
    sha256: '424fbeaeac09f7f60d0a802a47afb9cb913a00013eb1f35853c88db1dcf27023',
    om: 'Windows på ARM',
  },
};

const URL_FOR = fil => `https://github.com/ggml-org/llama.cpp/releases/download/${BYGGE}/${fil}`;

/// Det som faktiskt behövs.
///
/// Paketet innehåller ett trettiotal verktyg — llama-cli, llama-bench,
/// llama-quantize — och MAXIMUS kör ett enda av dem. De andra kastas.
///
/// Biblioteken behålls alla. Ett första försök plockade ut dem med namn och
/// missade libllama-server-impl.dylib; binären startade inte, och felet var
/// "Library not loaded" på en fil som aldrig kopierats. Vilka bibliotek en
/// binär behöver är inte vår gissning att göra — de väger tillsammans mindre
/// än en tiondel av modellen.
const BEHOVS = [/^llama-server(\.exe)?$/, /\.(dylib|so|dll)$/, /\.metallib$/];

async function hamta(url, till) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} för ${url}`);
  const summa = createHash('sha256');
  await pipeline(
    Readable.fromWeb(r.body),
    async function* (bitar) { for await (const b of bitar) { summa.update(b); yield b; } },
    createWriteStream(till),
  );
  return summa.digest('hex');
}

async function packaUpp(arkiv, dit) {
  await mkdir(dit, { recursive: true });
  if (arkiv.endsWith('.zip')) await kor('unzip', ['-oq', arkiv, '-d', dit]);
  else await kor('tar', ['-xzf', arkiv, '-C', dit]);
}

/// Plocka ut det som behövs och kasta resten.
async function gallra(fran, till) {
  await mkdir(till, { recursive: true });
  const behall = [];
  const ga = async dir => {
    for (const namn of await readdir(dir)) {
      const v = join(dir, namn);
      const s = await lstat(v);
      if (s.isDirectory()) { await ga(v); continue; }
      if (BEHOVS.some(r => r.test(namn))) behall.push({ v, lank: s.isSymbolicLink() });
    }
  };
  await ga(fran);

  // Riktiga filer först, länkarna sedan — en länk kan inte skapas innan den
  // den pekar på finns.
  //
  // Paketet är fullt av dem: libggml.dylib → libggml.0.dylib →
  // libggml.0.25.3.dylib. Ett första försök löste upp dem till kopior, och
  // biblioteken tredubblades: 65 MB i stället för 21. Ett andra kopierade
  // länkarna som de var, och de pekade in i en katalog som just raderats.
  // Det som ska följa med är länken, men relativ.
  for (const { v, lank } of behall) {
    if (lank) continue;
    const mal = join(till, v.split('/').pop());
    await cp(v, mal);
    await chmod(mal, 0o755).catch(() => {});
  }
  for (const { v, lank } of behall) {
    if (!lank) continue;
    const mal = join(till, v.split('/').pop());
    const pekar = (await readlink(v)).split('/').pop();
    await symlink(pekar, mal).catch(() => {});
  }
  return behall.length;
}

async function ettMal(namn) {
  const m = MAL[namn];
  if (!m) throw new Error(`Okänt mål: ${namn}. Finns: ${Object.keys(MAL).join(', ')}`);
  const dit = join(DIT, namn);
  const tmp = join(DIT, `.${namn}-uppackat`);
  const arkiv = join(DIT, `.${m.fil}`);

  console.log(`\n${namn} — ${m.om}`);
  await mkdir(DIT, { recursive: true });
  process.stdout.write(`  hämtar ${m.fil}… `);
  const sha = await hamta(URL_FOR(m.fil), arkiv);
  console.log('klart');

  if (m.sha256 && sha !== m.sha256) {
    await rm(arkiv, { force: true });
    throw new Error(`Kontrollsumman stämmer inte för ${m.fil}.\n  väntade ${m.sha256}\n  fick     ${sha}`);
  }
  if (!m.sha256) console.log(`  OBS: ingen kontrollsumma i skriptet. Fick ${sha} — skriv in den.`);

  await rm(tmp, { recursive: true, force: true });
  await packaUpp(arkiv, tmp);
  await rm(dit, { recursive: true, force: true });
  const antal = await gallra(tmp, dit);
  await rm(tmp, { recursive: true, force: true });
  await rm(arkiv, { force: true });

  const filer = await readdir(dit);
  if (!filer.some(f => /^llama-server(\.exe)?$/.test(f)))
    throw new Error(`llama-server fanns inte i ${m.fil}.`);
  console.log(`  ${antal} filer till src-tauri/llama/${namn}`);
}

const valda = process.argv.slice(2).filter(a => !a.startsWith('-'));
const mal = valda.length ? valda : Object.keys(MAL);
let fel = 0;
for (const namn of mal) {
  try { await ettMal(namn); }
  catch (e) { console.error(`  FEL: ${e.message}`); fel++; }
}
console.log(fel ? `\n${fel} mål misslyckades.` : '\nAlla mål klara.');
process.exit(fel ? 1 : 0);
