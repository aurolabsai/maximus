
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { arFodelsedag } from './maskering.mjs';
import { hitta, tillWav, AR_MAC } from './plattform.mjs';
import { hamtaVerifierad, stammerFil } from './modeller.mjs';
import { tx, aktuellt } from './sprakstod.mjs';

const kor = promisify(execFile);
const HAR = new URL('../verktyg/', import.meta.url).pathname;
export const ORON = {
  svensk: {
    id: 'svensk',
    namn: 'KB-Whisper large',
    hus: 'Kungliga biblioteket',
    fil: 'ggml-kb-whisper-large-q5_0.bin',
    kalla: 'https://huggingface.co/KBLab/kb-whisper-large/resolve/d5d5984b4d8f7c4847a8ea203f1976285fb28300/ggml-model-q5_0.bin',
    sha256: '6d2863812d7410322bb7d8647a5c7260761300fa946714c9ed66d22bb30bcb19',
    byte: 1081140203,
    get storlek() { return tx('lib.dokument.ora.svensk.storlek'); },
    get om() { return tx('lib.dokument.ora.svensk.om'); },
    get sprak() { return tx('lib.dokument.ora.svensk.sprak'); },
  },
  snabb: {
    id: 'snabb',
    namn: 'Whisper large-v3-turbo',
    hus: 'OpenAI',
    fil: 'ggml-large-v3-turbo-q5_0.bin',
    kalla: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-large-v3-turbo-q5_0.bin',
    sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
    byte: 574041195,
    storlek: '530 MB',
    get om() { return tx('lib.dokument.ora.snabb.om'); },
    get sprak() { return tx('lib.dokument.ora.snabb.sprak'); },
  },
};

let VALT = ORON.svensk;
export function satOra(id) { if (ORON[id]) VALT = ORON[id]; }
export const valtOra = () => VALT;

let EGET = null;
export function satEgetOra(vag) { EGET = vag || null; }
export const egetOra = () => EGET;
const egetNamn = v => String(v).split('/').pop();

const vagen = o => join(process.env.HOME, 'models', 'whisper', o.fil);
const MODELL_FALLBACK = join(process.env.HOME, 'models', 'whisper', 'ggml-large-v3-turbo-q5_0.bin');

async function modellfilen() {
  if (EGET) { try { if ((await stat(EGET)).size > 30e6) return EGET; } catch {  } }
  for (const o of [VALT, ...Object.values(ORON)]) {
    try { if ((await stat(vagen(o))).size > 4e8) return vagen(o); } catch {  }
  }
  try { if ((await stat(MODELL_FALLBACK)).size > 4e8) return MODELL_FALLBACK; } catch {  }
  return vagen(VALT);
}

export async function orat() {
  if (EGET) {
    try { const f = await stat(EGET); if (f.size > 30e6) return { finns: true, id: 'egen', namn: egetNamn(EGET), storlek: `${Math.round(f.size / 1e6)} MB`, om: 'Din egen fil.' }; } catch {  }
  }
  const o = VALT;
  try {
    const f = await stat(vagen(o));
    return { finns: f.size > 4e8, id: o.id, namn: o.namn, storlek: o.storlek, om: o.om };
  } catch { return { finns: false, id: o.id, namn: o.namn, storlek: o.storlek, om: o.om }; }
}

export async function oronlage() {
  const ut = [];
  for (const o of Object.values(ORON)) {
    let finns = false;
    try { finns = (await stat(vagen(o))).size > 4e8; } catch {  }
    ut.push({ ...o, kalla: undefined, fil: undefined, sha256: undefined, finns, valt: o.id === VALT.id });
  }
  return ut;
}

export async function hamtaOrat({ onSteg = () => {}, onFramsteg = () => {}, id = null, liggare } = {}) {
  const o = (id && ORON[id]) || VALT;
  const MODELL = vagen(o);
  if (await stammerFil(MODELL, o)) return { redan: true };
  onSteg({ steg: 'laddar', text: tx('lib.dokument.hamtar', { namn: o.namn, storlek: o.storlek }) });
  await mkdir(join(process.env.HOME, 'models', 'whisper'), { recursive: true });
  await hamtaVerifierad(o.kalla, MODELL, { byte: o.byte, sha256: o.sha256, vad: `lyssnarmodellen ${o.namn}`,
    onFramsteg, liggare });
  onFramsteg({ gjort: o.byte, av: o.byte, andel: 1, klar: true });
  return { redan: false };
}

export const INGET_TAL = /Inget tal|No speech/;

export const LJUD = ['.m4a', '.mp3', '.wav', '.aiff', '.aif', '.aac', '.caf', '.mp4', '.mov', '.flac', '.ogg', '.opus', '.webm'];

export const SORTER = {
  '.pdf': 'pdf', '.doc': 'word', '.docx': 'word', '.rtf': 'word', '.odt': 'word',
  '.txt': 'text', '.md': 'text', '.json': 'text',
  '.csv': 'kalkyl', '.tsv': 'kalkyl', '.xlsx': 'kalkyl', '.xlsm': 'kalkyl', '.ods': 'kalkyl',
  '.png': 'bild', '.jpg': 'bild', '.jpeg': 'bild', '.heic': 'bild', '.tiff': 'bild',
};

const TAK = 40 * 1024 * 1024;

export async function lasDokument(namn, data) {
  if (data.length > TAK) throw new Error(tx('lib.dokument.forStor'));
  const slut = extname(namn).toLowerCase();
  const sort = SORTER[slut];
  if (!sort) throw new Error(tx('lib.dokument.lasesInte', { slut: slut || tx('lib.dokument.utanAndelse') }));

  const tmp = join(tmpdir(), `maximus-${randomUUID()}${slut}`);
  await writeFile(tmp, data, { mode: 0o600 });
  try {
    let text = '', hur = sort;
    if (sort === 'text') text = data.toString('utf8');
    else if (sort === 'kalkyl') {
      const { lasKalkyl, lasCsv, tillText } = await import('./kalkyl.mjs');
      const blad = /\.(csv|tsv)$/i.test(slut) ? lasCsv(data.toString('utf8')) : lasKalkyl(data);
      text = tillText(blad);
      hur = 'kalkyl';
    }
    else if (sort === 'pdf') {
      const pdfkit = AR_MAC ? await hitta('maximus-pdf') : null;
      const pdftotext = pdfkit ? null : await hitta('pdftotext');
      if (!pdfkit && !pdftotext) throw new Error(tx('lib.dokument.pdfLasareSaknas'));
      try {
        text = pdfkit
          ? (await kor(pdfkit, [tmp], { maxBuffer: 64e6 })).stdout
          : (await kor(pdftotext, ['-layout', '-enc', 'UTF-8', tmp, '-'], { maxBuffer: 64e6 })).stdout;
      } catch (e) {
        throw new Error(/lösenordsskyddad/i.test(e.stderr || '') ? tx('lib.dokument.pdfLosenord')
          : /empty|damaged|Couldn't open|skadad/i.test(e.stderr || '')
          ? tx('lib.dokument.pdfSkadad')
          : tx('lib.dokument.pdfKundeInte'));
      }
      if (text.replace(/\s/g, '').length < 40) {
        text = await ocr(tmp);
        hur = tx('lib.dokument.hur.pdfBild');
      }
    } else if (sort === 'word') {
      try {
        text = (await kor('/usr/bin/textutil', ['-convert', 'txt', '-stdout', tmp],
          { maxBuffer: 64e6 })).stdout;
      } catch { throw new Error(tx('lib.dokument.wordLasesInte')); }
    } else {
      text = await ocr(tmp);
      hur = tx('lib.dokument.hur.bild');
    }

    text = stada(text);
    if (!text.trim()) throw new Error(tx('lib.dokument.ingenText'));
    return { namn: basename(namn), sort: hur, tecken: text.length, text };
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function ocr(vag) {
  try {
    const bin = await hitta('maximus-ocr');
    const { stdout } = bin
      ? await kor(bin, [vag], { maxBuffer: 64e6, timeout: 180000 })
      : await kor('/usr/bin/swift', [join(HAR, 'ocr.swift'), vag], { maxBuffer: 64e6, timeout: 180000 });
    return stdout;
  } catch (e) {
    throw new Error(tx('lib.dokument.ocrFel'));
  }
}

const fogaAdresser = t => t
  .replace(/[\w.+-]+(?:[ \n][\w.+-]+)?@[\w-]+(?:[ \n][\w.-]+)?\.\p{L}{2,}/gu, m => m.replace(/\s+/g, ''))
  .replace(/https?:\/\/[^\s]+[ \n][^\s]*\.[a-z]{2,}(?:\/[^\s]*)?/gi, m => m.replace(/\s+/g, ''));

export function stada(text) {
  return fogaAdresser(String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2')
    .replace(/(\p{L},?)\n(\p{Lu}?\p{Ll})/gu, '$1 $2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

export function fogaSiffror(text) {
  return String(text).replace(/\b\d{2,4}(?:[ .\-]\d{2,4}){2,5}\b/g, traff => {
    const rena = traff.replace(/[ .\-]/g, '');
    if (rena.length !== 10 && rena.length !== 12) return traff;
    if (!arFodelsedag(rena.slice(-10))) return traff;
    return rena.length === 12 ? `${rena.slice(0, 8)}-${rena.slice(8)}` : `${rena.slice(0, 6)}-${rena.slice(6)}`;
  });
}

function lyssna(whisper, argument, { signal, pa }) {
  return new Promise((los, fel) => {
    const b = spawn(whisper, argument, { signal });
    let ut = '';
    let svans = '';
    let felut = '';
    b.stdout.setEncoding('utf8');
    b.stdout.on('data', bit => {
      ut += bit;
      svans += bit;
      const rader = svans.split('\n');
      svans = rader.pop() ?? '';
      for (const rad of rader) {
        const m = TIDRAD.exec(rad.trim());
        if (m?.[4].trim()) pa?.(stampla(m));
      }
    });
    b.stderr.setEncoding('utf8');
    b.stderr.on('data', bit => { felut = (felut + bit).slice(-4000); });
    b.on('error', fel);
    b.on('close', kod => {
      const m = TIDRAD.exec(svans.trim());
      if (m?.[4].trim()) pa?.(stampla(m));
      if (kod === 0) los({ stdout: ut });
      else fel(new Error(felut.trim().split('\n').pop() || `whisper slutade med ${kod}`));
    });
  });
}

const TIDRAD = /^\[(\d\d):(\d\d):(\d\d)[.\d]*\s*-->[^\]]*\]\s*(.*)$/;
const stampla = m => `[${Number(m[1]) ? `${m[1]}:` : ''}${m[2]}:${m[3]}] ${m[4].trim()}`;

export async function transkribera(namn, data, { sprak = aktuellt(), signal, pa } = {}) {
  const slut = extname(namn).toLowerCase();
  if (!LJUD.includes(slut)) throw new Error(tx('lib.dokument.transkriberarInte', { slut: slut || tx('lib.dokument.utanAndelse') }));
  if (!(await orat()).finns) throw new Error(tx('lib.dokument.oratSaknas'));
  if (data.length > 500 * 1024 * 1024) throw new Error(tx('lib.dokument.ljudForStort'));

  const ra = join(tmpdir(), `maximus-${randomUUID()}${slut}`);
  const wav = join(tmpdir(), `maximus-${randomUUID()}.wav`);
  await writeFile(ra, data, { mode: 0o600 });
  try {
    const konv = await tillWav(ra, wav);
    await kor(konv.fil, konv.argument, { timeout: 300000 })
      .catch(() => { throw new Error(tx('lib.dokument.ljudLasesInte')); });

    const whisper = await hitta('whisper-cli');
    if (!whisper) throw new Error(tx('lib.dokument.whisperSaknas'));
    const rader = [];
    const oratsFil = await modellfilen();
    const { stdout } = await lyssna(whisper, ['-m', oratsFil, '-l', sprak, '-f', wav, '-np'],
      { signal, pa: rad => { rader.push(rad); pa?.(rad, rader.length); } });

    const text = fogaSiffror(rader.join('\n') || stdout.trim());
    if (!text.trim()) throw Object.assign(new Error(tx('lib.dokument.ingetTal')), { kod: 'inget-tal' });
    return { namn: basename(namn), sort: tx('lib.dokument.hur.ljud'), tecken: text.length, text };
  } finally {
    await unlink(ra).catch(() => {});
    await unlink(wav).catch(() => {});
  }
}
