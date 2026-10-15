
import { createHash } from 'node:crypto';
import { tx } from './sprakstod.mjs';
import { createWriteStream } from 'node:fs';
import { mkdir, stat, rename, unlink, readdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { homedir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import os from 'node:os';
import { statfs } from 'node:fs/promises';
import { datakatalog } from './plattform.mjs';

const VARD = 'https://huggingface.co';

export const KATALOG = [
  {
    id: 'e2b',
    niva: 'Bas',
    get varfor() { return tx('lib.modeller.e2b.varfor'); },
    namn: 'Gemma 4 E2B',
    hus: 'Google',
    licens: 'Gemma',
    repo: 'google/gemma-4-E2B-it-qat-q4_0-gguf',
    mmproj: { fil: 'gemma-4-E2B-it-mmproj.gguf', byte: 986833664, rev: '675cff42a74c774d6cb76f76d8eacb49b48c9b93',
      sha256: '021059cce659fe7f9170d5599761d7bbaf644b798dab9503aca30dc43e6beb14' },
    fil: 'gemma-4-E2B_q4_0-it.gguf',
    byte: 3349516256,
    sha256: 'fa401b55b07ee70a54c6dae3903c783a6e65064312529ea57175cb5f8dec6634',
    minne: 8,
    provad: false,
    get om() { return tx('lib.modeller.e2b.om'); },
  },
  {
    id: 'e4b',
    niva: 'Pro',
    get varfor() { return tx('lib.modeller.e4b.varfor'); },
    namn: 'Gemma 4 E4B',
    hus: 'Google',
    licens: 'Gemma',
    repo: 'google/gemma-4-E4B-it-qat-q4_0-gguf',
    mmproj: { fil: 'gemma-4-E4B-it-mmproj.gguf', byte: 991552256, rev: '4b4a2c1d584be7264f87aac328a1bc739ce81b6c',
      sha256: '7498a37cb619e55f2fcf87eb931f56e99389ed6d432e4c5c66110694c0d65578' },
    fil: 'gemma-4-E4B_q4_0-it.gguf',
    byte: 5154941280,
    sha256: '676c35070db6dbe52f93e9c864ee0fba4eddea94b9c875d9cb10daff453fbaee',
    minne: 16,
    provad: true,
    get matt() { return tx('lib.modeller.e4b.matt'); },
    get om() { return tx('lib.modeller.e4b.om'); },
  },
  {
    id: '12b',
    niva: 'Max',
    get varfor() { return tx('lib.modeller.12b.varfor'); },
    namn: 'Gemma 4 12B',
    hus: 'Google',
    licens: 'Gemma',
    repo: 'google/gemma-4-12B-it-qat-q4_0-gguf',
    mmproj: { fil: 'mmproj-gemma-4-12b-it-qat-q4_0.gguf', byte: 175115616, rev: '29d097773436b69ff9feafd636ab4cf873786537',
      sha256: 'cb018338a7538a9814d994bfe54644c71eb7ed54e31eae2f721e45fd3c260da7' },
    fil: 'gemma-4-12b-it-qat-q4_0.gguf',
    byte: 6975879296,
    sha256: '93567e57a8fe10b23569b9d9ec38cd005deedf71e29477c421a4b83f418a538b',
    minne: 24,
    provad: true,
    get matt() { return tx('lib.modeller.12b.matt'); },
    get om() { return tx('lib.modeller.12b.om'); },
  },
  {
    id: '26b',
    niva: null,
    get varfor() { return tx('lib.modeller.26b.varfor'); },
    namn: 'Gemma 4 26B A4B',
    hus: 'Google',
    licens: 'Gemma',
    repo: 'google/gemma-4-26B-A4B-it-qat-q4_0-gguf',
    mmproj: { fil: 'gemma-4-26B-it-mmproj.gguf', byte: 1194828160, rev: 'd1c082be9cf3c8a514acf63b8761f4b41935842e',
      sha256: 'a359953a076b877db30c31dbbb4c6d93b4a6e017ee5db5784247e4d4c0dd4f3b' },
    fil: 'gemma-4-26B_q4_0-it.gguf',
    byte: 14439363584,
    sha256: '3eca3b8f6d7baf218a7dd6bba5fb59a56ee25fe2d567b6f5f589b4f697eca51d',
    minne: 48,
    provad: false,
    get om() { return tx('lib.modeller.26b.om'); },
  },
  {
    id: '31b',
    niva: null,
    get varfor() { return tx('lib.modeller.31b.varfor'); },
    namn: 'Gemma 4 31B',
    hus: 'Google',
    licens: 'Gemma',
    repo: 'google/gemma-4-31B-it-qat-q4_0-gguf',
    fil: 'gemma-4-31B_q4_0-it.gguf',
    byte: 17651001568,
    sha256: '179cfb99212709597eae5929112cfca677e1bbf566178b479ae1da0c4772874b',
    minne: 64,
    provad: false,
    get om() { return tx('lib.modeller.31b.om'); },
  },
  {
    id: 'qwen3-4b',
    niva: 'Bas',
    get varfor() { return tx('lib.modeller.qwen3-4b.varfor'); },
    namn: 'Qwen3 4B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-4B-GGUF',
    fil: 'Qwen3-4B-Q4_K_M.gguf',
    byte: 2497280256,
    sha256: '7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5',
    minne: 8,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-4b.om'); },
  },
  {
    id: 'llama32-3b',
    niva: 'Bas',
    get varfor() { return tx('lib.modeller.llama32-3b.varfor'); },
    namn: 'Llama 3.2 3B',
    hus: 'Meta',
    licens: 'Llama 3.2',
    repo: 'unsloth/Llama-3.2-3B-Instruct-GGUF',
    fil: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    byte: 2019377600,
    sha256: '6c99cc00ae910f6a532a80022cb4bc1939094527a089c29294b841c0bd87f74d',
    minne: 8,
    provad: false,
    get om() { return tx('lib.modeller.llama32-3b.om'); },
  },
  {
    id: 'qwen3-8b',
    niva: 'Pro',
    get varfor() { return tx('lib.modeller.qwen3-8b.varfor'); },
    namn: 'Qwen3 8B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-8B-GGUF',
    fil: 'Qwen3-8B-Q4_K_M.gguf',
    byte: 5027783488,
    sha256: 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785',
    minne: 16,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-8b.om'); },
  },
  {
    id: 'llama31-8b',
    niva: 'Pro',
    get varfor() { return tx('lib.modeller.llama31-8b.varfor'); },
    namn: 'Llama 3.1 8B',
    hus: 'Meta',
    licens: 'Llama 3.1',
    repo: 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF',
    fil: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    byte: 4920739232,
    sha256: '7b064f5842bf9532c91456deda288a1b672397a54fa729aa665952863033557c',
    minne: 16,
    provad: false,
    get om() { return tx('lib.modeller.llama31-8b.om'); },
  },
  {
    id: 'qwen3-14b',
    niva: 'Max',
    get varfor() { return tx('lib.modeller.qwen3-14b.varfor'); },
    namn: 'Qwen3 14B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-14B-GGUF',
    fil: 'Qwen3-14B-Q4_K_M.gguf',
    byte: 9001752960,
    sha256: '500a8806e85ee9c83f3ae08420295592451379b4f8cf2d0f41c15dffeb6b81f0',
    minne: 24,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-14b.om'); },
  },
  {
    id: 'mistral-nemo',
    niva: 'Max',
    get varfor() { return tx('lib.modeller.mistral-nemo.varfor'); },
    namn: 'Mistral Nemo 12B',
    hus: 'Mistral AI',
    licens: 'Apache 2.0',
    repo: 'MaziyarPanahi/Mistral-Nemo-Instruct-2407-GGUF',
    fil: 'Mistral-Nemo-Instruct-2407.Q4_K_M.gguf',
    byte: 7477204928,
    sha256: '5964f3e6d9c17b99e3d2174022048f3ec58b12ee8fefa987888e0562d070d52e',
    minne: 24,
    provad: false,
    get om() { return tx('lib.modeller.mistral-nemo.om'); },
  },
  {
    id: 'mistral-small',
    niva: 'Stor',
    get varfor() { return tx('lib.modeller.mistral-small.varfor'); },
    namn: 'Mistral Small 24B',
    hus: 'Mistral AI',
    licens: 'Apache 2.0',
    repo: 'MaziyarPanahi/Mistral-Small-24B-Instruct-2501-GGUF',
    fil: 'Mistral-Small-24B-Instruct-2501.Q4_K_M.gguf',
    byte: 14333908416,
    sha256: 'fd7ffad78e7a43dc2fdbefdc5c9467ce572b29f3de8894db3e3354129d9d84df',
    minne: 48,
    provad: false,
    get om() { return tx('lib.modeller.mistral-small.om'); },
  },
  {
    id: 'qwen3-32b',
    niva: 'Stor',
    get varfor() { return tx('lib.modeller.qwen3-32b.varfor'); },
    namn: 'Qwen3 32B',
    hus: 'Alibaba',
    licens: 'Apache 2.0',
    repo: 'Qwen/Qwen3-32B-GGUF',
    fil: 'Qwen3-32B-Q4_K_M.gguf',
    byte: 19762149024,
    sha256: 'efd971561896866f0e910cce52761ca77b1b138090c7f15fe284676d57d1f689',
    minne: 48,
    provad: false,
    get om() { return tx('lib.modeller.qwen3-32b.om'); },
  },
];

export const modell = id => KATALOG.find(m => m.id === id) || null;

export const modellAvFil = vag => {
  const f = basename(String(vag || '')).toLowerCase();
  return KATALOG.find(m => m.fil.toLowerCase() === f) || null;
};

export async function kapacitet(dit = katalogen()) {
  let disk = null;
  try {
    const f = await statfs(dit).catch(() => statfs(homedir()));
    disk = f.bsize * f.bavail;
  } catch {  }
  return {
    minne: os.totalmem(),
    minneGB: Math.round(os.totalmem() / 2 ** 30),
    karnor: os.cpus().length,
    arkitektur: os.arch(),
    plattform: os.platform(),
    disk,
    diskGB: disk === null ? null : Math.round(disk / 2 ** 30),
  };
}

export function valjModell(kap) {
  const minneGB = kap.minneGB ?? Math.round((kap.minne || 0) / 2 ** 30);
  const diskByte = kap.disk ?? Infinity;
  const ryms = m => m.minne <= minneGB && m.byte * 1.15 <= diskByte;
  const husMedProvad = new Set(KATALOG.filter(m => m.provad).map(m => m.hus));
  const storst = lista => [...lista].sort((a, b) =>
    b.minne - a.minne
    || (husMedProvad.has(b.hus) ? 1 : 0) - (husMedProvad.has(a.hus) ? 1 : 0)
    || b.byte - a.byte)[0];

  const provade = KATALOG.filter(m => m.provad && ryms(m));
  if (provade.length) return { ...storst(provade), racker: true };
  const passar = KATALOG.filter(ryms);
  if (passar.length) return { ...storst(passar), racker: true, oprovad: true };
  const minsta = KATALOG[0];
  return {
    ...minsta,
    racker: false,
    varfor: minsta.byte * 1.15 > diskByte
      ? tx('lib.modeller.disk', { kvar: Math.round(diskByte / 2 ** 30), behover: Math.ceil(minsta.byte / 2 ** 30) })
      : tx('lib.modeller.minne', { har: minneGB, vill: minsta.minne }),
  };
}

let KATALOGEN = null;
export const satKatalog = v => { KATALOGEN = v || null; };
export const katalogen = () => KATALOGEN || join(datakatalog(), 'modeller');

export async function hittaFil(m) {
  const kandidater = [
    join(katalogen(), m.fil),
    join(homedir(), 'models', basename(m.repo), m.fil),
    join(homedir(), 'models', m.fil),
  ];
  for (const v of kandidater) {
    const s = await stat(v).catch(() => null);
    if (s?.isFile() && s.size === m.byte) return v;
  }
  return null;
}

export async function laget() {
  const kap = await kapacitet();
  const vald = valjModell(kap);
  const rader = [];
  for (const m of KATALOG) {
    const vag = await hittaFil(m);
    rader.push({ ...m, finns: Boolean(vag), vag, passar: m.minne <= kap.minneGB });
  }
  return { kapacitet: kap, rekommenderad: vald.id, racker: vald.racker, varfor: vald.varfor, modeller: rader };
}

export async function hamtaVerifierad(url, mal, { byte, sha256, vad = basename(mal), onFramsteg = () => {}, signal, liggare } = {}) {
  if (!/^[0-9a-f]{64}$/.test(String(sha256 || ''))) throw new Error(tx('lib.modeller.fel.summa', { vad }));
  const delvis = `${mal}.delvis`;
  let fran = (await stat(delvis).catch(() => null))?.size || 0;
  if (byte && fran >= byte) { await unlink(delvis).catch(() => {}); fran = 0; }

  const t0 = Date.now();
  let gjort = fran, start = 0, fel = null;
  try {
    const r = await fetch(url, {
      signal,
      headers: { 'User-Agent': 'MAXIMUS/4.0', ...(fran ? { Range: `bytes=${fran}-` } : {}) },
    });
    if (!r.ok && r.status !== 206)
      throw new Error(tx('lib.modeller.fel.http', { status: r.status }));

    start = r.status === 206 ? fran : 0;
    gjort = start;

    const summa = createHash('sha256');
    if (start) {
      const { createReadStream } = await import('node:fs');
      for await (const bit of createReadStream(delvis, { end: start - 1 })) summa.update(bit);
    }

    const av = byte || Number(r.headers.get('content-length')) + start || 0;
    let sist = 0;
    await pipeline(
      Readable.fromWeb(r.body),
      async function* (bitar) {
        for await (const b of bitar) {
          summa.update(b);
          gjort += b.length;
          if (byte && gjort > byte) throw new Error(tx('lib.modeller.fel.storre', { vad }));
          const nu = Date.now();
          if (nu - sist > 100) {
            sist = nu;
            const fart = (gjort - start) / Math.max(1, (nu - t0) / 1000);
            onFramsteg({ gjort, av, andel: av ? Math.min(1, gjort / av) : 0, fart,
              kvar: fart > 0 && av ? Math.round((av - gjort) / fart) : null });
          }
          yield b;
        }
      },
      createWriteStream(delvis, { flags: start ? 'a' : 'w', mode: 0o600 }),
    );

    if (byte && gjort !== byte) {
      await unlink(delvis).catch(() => {});
      throw new Error(tx('lib.modeller.fel.storlek', { vad, gjort, byte }));
    }
    if (summa.digest('hex') !== sha256) {
      await unlink(delvis).catch(() => {});
      throw new Error(tx('lib.modeller.fel.summaFel', { vad }));
    }
    await rename(delvis, mal);
    onFramsteg({ gjort, av: gjort, andel: 1, fart: 0, kvar: 0 });
    return mal;
  } catch (e) { fel = e; throw e; }
  finally {
    if (typeof liggare === 'function') {
      try {
        await liggare({ session: null, frontier: tx('lib.modeller.liggare.hamtning', { vad }), vag: 'direkt',
          skickat: `GET ${url}${start ? tx('lib.modeller.liggare.franByte', { start }) : ''}`,
          mottaget: fel ? null : tx('lib.modeller.liggare.mottaget', { n: gjort - start, gjort, sha: sha256.slice(0, 16) }),
          tecken: 0, sekunder: Math.round((Date.now() - t0) / 100) / 10, fel: fel ? fel.message : null });
      } catch (e) { console.error('liggaren kunde inte skriva om hämtningen:', e.message); }
    }
  }
}

export async function stammerFil(vag, { byte, sha256 }) {
  const s = await stat(vag).catch(() => null);
  if (!s?.isFile() || (byte && s.size !== byte)) return false;
  const { createReadStream } = await import('node:fs');
  const summa = createHash('sha256');
  for await (const bit of createReadStream(vag)) summa.update(bit);
  return summa.digest('hex') === sha256;
}

export async function hamtaMmproj(id, { onFramsteg = () => {}, signal, liggare } = {}) {
  const m = modell(id);
  if (!m?.mmproj) throw new Error(tx('lib.modeller.fel.ingenBild'));

  const modellvag = await hittaFil(m);
  const dit = modellvag ? dirname(modellvag) : katalogen();
  await mkdir(dit, { recursive: true });
  const mal = join(dit, m.mmproj.fil);
  if (await stammerFil(mal, m.mmproj)) return { vag: mal, redan: true };

  await hamtaVerifierad(`${VARD}/${m.repo}/resolve/${m.mmproj.rev}/${m.mmproj.fil}`, mal,
    { byte: m.mmproj.byte, sha256: m.mmproj.sha256, vad: `bilddelen till ${m.namn}`, onFramsteg, signal, liggare });
  return { vag: mal, redan: false };
}

export async function hamtaModell(id, { onFramsteg = () => {}, signal, liggare } = {}) {
  const m = modell(id);
  if (!m) throw new Error(tx('lib.modeller.fel.okand', { id }));

  const redan = await hittaFil(m);
  if (redan) return { vag: redan, redan: true, byte: m.byte };

  const dit = katalogen();
  await mkdir(dit, { recursive: true });
  const mal = join(dit, m.fil);
  await hamtaVerifierad(`${VARD}/${m.repo}/resolve/main/${m.fil}`, mal,
    { byte: m.byte, sha256: m.sha256, vad: m.namn, onFramsteg, signal, liggare });
  return { vag: mal, redan: false, byte: m.byte };
}

export async function taBort(id) {
  const m = modell(id);
  if (!m) throw new Error(tx('lib.modeller.fel.okand', { id }));
  const vag = await hittaFil(m);
  if (!vag) return { bort: false };
  if (!vag.startsWith(katalogen())) throw new Error(tx('lib.modeller.fel.utanfor'));
  await unlink(vag);
  return { bort: true };
}

export async function paborjade() {
  const filer = await readdir(katalogen()).catch(() => []);
  const ut = [];
  for (const f of filer.filter(f => f.endsWith('.delvis'))) {
    const s = await stat(join(katalogen(), f)).catch(() => null);
    if (s) ut.push({ fil: f.replace(/\.delvis$/, ''), byte: s.size });
  }
  return ut;
}
