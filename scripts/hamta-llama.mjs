#!/usr/bin/env node

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
const DIT = join(ROT, 'src-tauri', 'llama');

const BYGGE = 'b11179';

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
