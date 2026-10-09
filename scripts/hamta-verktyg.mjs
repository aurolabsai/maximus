#!/usr/bin/env node
/// Verktygen som följer med appen, utöver llama-server (Fas 22).
///
/// Målet: den som laddar ner Maximus dubbelklickar, drar appen till Program
/// och öppnar den — och allt fungerar, utan Terminal, Homebrew eller IT.
/// Före det här skriptet fattades tre saker på en ren Mac:
///
///   whisper-cli   utskrift av ljud      "Be IT installera whisper-cpp"
///   pdftotext     text ur PDF           "Be IT installera poppler"
///   swift         bildläsning (OCR) och kalendern, som kördes som skript
///                 med /usr/bin/swift — som bara finns med Xcodes verktyg
///
/// På Mac:
///   - Swift-hjälparna i verktyg/ kompileras till egna program med swiftc:
///     maximus-ocr (Vision), maximus-kalender (EventKit), maximus-pdf
///     (PDFKit). Ingen poppler, ingen Swift hos användaren.
///   - whisper-cli byggs ur whisper.cpp:s källkod, fastnaglad version och
///     kontrollsumma, med Metal och statiskt länkad. ggml-org släpper inget
///     färdigt kommandoradsprogram för Mac — bara ett ramverk.
///   - ffmpeg behövs inte: afconvert finns i systemet och läser det appen
///     spelar in (m4a) och det folk drar in.
///
/// På Windows (inte provat här — byggs på en Windows-dator):
///   - whisper-cli hämtas färdig ur ggml-orgs släpp, fastnaglad.
///   - ffmpeg (LGPL) och pdftotext (poppler) behövs och står som kvar att
///     göra nedan, med vad som fattas.
///
///     node scripts/hamta-verktyg.mjs macos-arm64
///
/// Resultatet läggs i src-tauri/verktyg-bin/<mål>/ och kopieras in i
/// resources/bin av scripts/klargor-skrivbord.mjs. lib/plattform.mjs hitta()
/// letar där först.

import { createHash } from 'node:crypto';
import { mkdir, rm, readFile, writeFile, cp, stat, readdir, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIT = join(ROT, 'src-tauri', 'verktyg-bin');

/// whisper.cpp. Byt här, och kör om skriptet.
const WHISPER = {
  version: 'v1.9.4',
  url: 'https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.4.tar.gz',
  sha256: '57e280cee375ab02425b806ad5146b99f6eb9357e3c2b31357c8a6af2e2e44ae',
};

const SWIFT = [
  ['ocr.swift', 'maximus-ocr'],
  ['kalender.swift', 'maximus-kalender'],
  ['paminnelser.swift', 'maximus-paminnelser'],
  // Skrivhjälparen (Fas 32): den enda som skriver i Kalender och Påminnelser.
  ['skriv.swift', 'maximus-skriv'],
  ['pdftext.swift', 'maximus-pdf'],
  // Dikteringen (Fas 42): SpeechAnalyzer finns från macOS 26. Saknas
  // programmet säger appen det, och mikrofonen spelar in i stället.
  ['diktera.swift', 'maximus-diktera', '26.0'],
];

const kor = (fil, arg, o = {}) => execFileSync(fil, arg, { stdio: 'inherit', ...o });

async function hamta(url, sha) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} svarade ${r.status}`);
  const data = Buffer.from(await r.arrayBuffer());
  const summa = createHash('sha256').update(data).digest('hex');
  if (summa !== sha) throw new Error(`Kontrollsumman stämde inte för ${url}: ${summa}. Ingenting byggs.`);
  return data;
}

async function mac(mal) {
  const ut = join(DIT, mal);
  await rm(ut, { recursive: true, force: true });
  await mkdir(ut, { recursive: true });
  const arch = mal.endsWith('arm64') ? 'arm64' : 'x86_64';

  // Swift-hjälparna.
  for (const [kalla, namn, minsta = '12.0'] of SWIFT) {
    kor('/usr/bin/swiftc', ['-O', '-target', `${arch}-apple-macos${minsta}`,
      join(ROT, 'verktyg', kalla), '-o', join(ut, namn)]);
    console.log(`  ${namn}: kompilerad ur verktyg/${kalla}`);
  }

  // whisper-cli ur källkoden.
  const arbete = join(tmpdir(), `maximus-whisper-${WHISPER.version}`);
  await rm(arbete, { recursive: true, force: true });
  await mkdir(arbete, { recursive: true });
  const arkiv = join(arbete, 'kalla.tar.gz');
  await writeFile(arkiv, await hamta(WHISPER.url, WHISPER.sha256));
  kor('/usr/bin/tar', ['-xzf', arkiv, '-C', arbete]);
  const kalla = join(arbete, (await readdir(arbete)).find(n => n.startsWith('whisper.cpp')));
  const bygg = join(kalla, 'build');
  kor('cmake', ['-S', kalla, '-B', bygg, '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF',
    '-DWHISPER_BUILD_TESTS=OFF', '-DWHISPER_BUILD_EXAMPLES=ON', '-DWHISPER_BUILD_SERVER=OFF',
    '-DGGML_METAL=ON', '-DGGML_METAL_EMBED_LIBRARY=ON', '-DGGML_NATIVE=OFF',
    `-DCMAKE_OSX_ARCHITECTURES=${arch}`, '-DCMAKE_OSX_DEPLOYMENT_TARGET=12.0']);
  kor('cmake', ['--build', bygg, '--config', 'Release', '--target', 'whisper-cli', '-j']);
  await cp(join(bygg, 'bin', 'whisper-cli'), join(ut, 'whisper-cli'));
  await chmod(join(ut, 'whisper-cli'), 0o755);
  await rm(arbete, { recursive: true, force: true });
  console.log(`  whisper-cli: ${WHISPER.version}, Metal, statiskt länkad`);

  // Det som byggts ska gå att köra utan Homebrew. otool visar vad det
  // länkar mot — allt utanför /usr/lib och /System är ett fel.
  for (const f of await readdir(ut)) {
    const lankar = execFileSync('/usr/bin/otool', ['-L', join(ut, f)], { encoding: 'utf8' })
      .split('\n').slice(1).map(r => r.trim().split(' ')[0]).filter(Boolean);
    const frammande = lankar.filter(l => !/^(\/usr\/lib\/|\/System\/|@rpath\/libswift)/.test(l));
    if (frammande.length) throw new Error(`${f} länkar mot ${frammande.join(', ')} — finns inte på en ren Mac.`);
  }
  console.log(`  ${(await readdir(ut)).length} verktyg i ${ut}, inga länkar utanför systemet`);
}

async function windows(mal) {
  // Kvar att göra, och provas på en Windows-dator:
  //   whisper-cli: whisper-bin-x64.zip ur ggml-org/whisper.cpp (b5130 eller
  //                senare), sha256 ur GitHubs API, fastnaglad här.
  //   ffmpeg:      en LGPL-build (BtbN/FFmpeg-Builds, "lgpl"), fastnaglad.
  //   pdftotext:   poppler för Windows (oschwartz10612/poppler-windows).
  // Utan dem fungerar Maximus på Windows, men inte ljud och PDF.
  throw new Error(`Verktygen för ${mal} är inte byggda än — se kommentaren i scripts/hamta-verktyg.mjs.`);
}

const mal = process.argv[2] || (process.platform === 'darwin'
  ? (process.arch === 'arm64' ? 'macos-arm64' : 'macos-x64')
  : (process.arch === 'arm64' ? 'win-arm64' : 'win-x64'));
if (mal.startsWith('macos')) await mac(mal);
else await windows(mal);
