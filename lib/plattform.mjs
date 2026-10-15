
import { access, constants } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { platform, homedir } from 'node:os';
import { tx } from './sprakstod.mjs';

export const AR_MAC = platform() === 'darwin';
export const AR_WINDOWS = platform() === 'win32';
export const AR_LINUX = platform() === 'linux';

const EXTRA = AR_MAC
  ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', join(homedir(), '.local/bin'), join(homedir(), '.cargo/bin')]
  : AR_WINDOWS
    ? ['C:\\Program Files', 'C:\\Program Files (x86)', join(homedir(), 'AppData', 'Local', 'Programs')]
    : ['/usr/local/bin', '/usr/bin', '/bin', '/snap/bin', join(homedir(), '.local/bin'), join(homedir(), '.cargo/bin')];

const ENDELSER = AR_WINDOWS ? ['.exe', '.cmd', '.bat', ''] : [''];

const egnaVagar = () => {
  const rot = process.env.MAXIMUS_RESURSER;
  if (!rot) return [];
  const mal = AR_MAC ? `macos-${process.arch}` : AR_WINDOWS ? `win-${process.arch}` : `linux-${process.arch}`;
  return [join(rot, 'bin', mal), join(rot, 'bin')];
};

const funna = new Map();

export async function hitta(namn, { extraVagar = [] } = {}) {
  if (funna.has(namn)) return funna.get(namn);
  const vagar = [...egnaVagar(), ...(process.env.PATH || '').split(delimiter), ...EXTRA, ...extraVagar].filter(Boolean);
  for (const v of vagar) {
    for (const e of ENDELSER) {
      const full = join(v, namn + e);
      try { await access(full, constants.X_OK); funna.set(namn, full); return full; }
      catch {  }
    }
  }
  funna.set(namn, null);
  return null;
}

export async function formaga() {
  const [pdf, ffmpeg, whisper, tesseract, soffice] = await Promise.all([
    hitta('pdftotext'), hitta('ffmpeg'), hitta('whisper-cli'), hitta('tesseract'), hitta('soffice'),
  ]);
  return {
    plattform: platform(),
    pdf: { finns: Boolean(pdf), vag: pdf, kravs: 'poppler', om: tx('plattform.om.pdf') },
    ljud: { finns: Boolean(whisper && (ffmpeg || AR_MAC)), whisper, ffmpeg, kravs: tx('plattform.kravs.ljud'),
            om: tx('plattform.om.ljud') },
    ocr: { finns: AR_MAC || Boolean(tesseract), vag: tesseract, kravs: AR_MAC ? tx('plattform.kravs.inbyggt') : 'tesseract',
           om: tx('plattform.om.ocr') },
    kontor: { finns: AR_MAC || Boolean(soffice), vag: soffice, kravs: AR_MAC ? tx('plattform.kravs.inbyggt') : 'libreoffice',
              om: tx('plattform.om.kontor') },
  };
}

export async function tillWav(fran, till) {
  const ff = await hitta('ffmpeg');
  if (ff) return { fil: ff, argument: ['-y', '-i', fran, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', till] };
  if (AR_MAC) return { fil: '/usr/bin/afconvert', argument: ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', fran, till] };
  throw new Error(tx('plattform.ingetLjud'));
}

export function datakatalog(namn = 'Maximus') {
  if (AR_MAC) return join(homedir(), 'Library', 'Application Support', namn);
  if (AR_WINDOWS) return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), namn);
  return join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), namn.toLowerCase());
}

export const HAR_NYCKELRING = AR_MAC;

export function oppnaKommando(adress) {
  if (AR_MAC) return { fil: '/usr/bin/open', argument: [adress] };
  if (AR_WINDOWS) return { fil: 'explorer.exe', argument: [adress] };
  return { fil: 'xdg-open', argument: [adress] };
}
