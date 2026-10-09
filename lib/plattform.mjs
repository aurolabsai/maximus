// Var ligger verktygen, och vilka finns?
//
// MAXIMUS Skrivbord kunde anta macOS. Servern kan inte: den kan köras på en
// maskin som är lika ofta Linux som Windows. Varje hårdkodad sökväg var ett
// antagande om någon annans maskin.
//
// Inget verktyg är obligatoriskt utom modellen. Saknas pdftotext läser MAXIMUS
// inte PDF:er, och säger det — den vägrar inte starta. En kommun som får
// igång grinden men inte dokumentläsningen har fortfarande en produkt.

import { access, constants } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { platform, homedir } from 'node:os';
import { tx } from './sprakstod.mjs';

export const AR_MAC = platform() === 'darwin';
export const AR_WINDOWS = platform() === 'win32';
export const AR_LINUX = platform() === 'linux';

/// Letar upp ett kommando i PATH och på de ställen paketshanterare lägger
/// saker. `where` på Windows och `which` på resten hade räckt om PATH alltid
/// vore satt, och i en tjänst som startas av systemd eller som Windows-tjänst
/// är den ofta tom.
const EXTRA = AR_MAC
  ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', join(homedir(), '.local/bin'), join(homedir(), '.cargo/bin')]
  : AR_WINDOWS
    ? ['C:\\Program Files', 'C:\\Program Files (x86)', join(homedir(), 'AppData', 'Local', 'Programs')]
    : ['/usr/local/bin', '/usr/bin', '/bin', '/snap/bin', join(homedir(), '.local/bin'), join(homedir(), '.cargo/bin')];

const ENDELSER = AR_WINDOWS ? ['.exe', '.cmd', '.bat', ''] : [''];

/// Appens egna binärer, före allt annat.
///
/// MAXIMUS_RESURSER sätts av skrivbordsskalet och pekar på det som packats med
/// i appen. Utan den letade MAXIMUS efter llama-server i /opt/homebrew/bin och
/// hoppades — på en dator utan Homebrew startade appen, guiden visades, och
/// sedan svarade ingenting.
///
/// Det egna går före PATH med flit: en medpackad binär är den vi provat mot,
/// och en som råkar ligga i PATH är någon annans version av något som liknar
/// den. Turn-key betyder att vi vet vad som kör.
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
      catch { /* nästa */ }
    }
  }
  funna.set(namn, null);
  return null;
}

/// Vad den här maskinen kan. Frågas vid start och visas i gränssnittet, så
/// att den som installerat ser vad som fattas innan en användare gör det.
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

/// Ljudkonvertering. afconvert på Mac, ffmpeg överallt annars.
export async function tillWav(fran, till) {
  const ff = await hitta('ffmpeg');
  if (ff) return { fil: ff, argument: ['-y', '-i', fran, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', till] };
  if (AR_MAC) return { fil: '/usr/bin/afconvert', argument: ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', fran, till] };
  throw new Error(tx('plattform.ingetLjud'));
}

/// Var MAXIMUS lägger sitt.
///
/// Sökvägen var hårdkodad till macOS Library/Application Support. På Windows
/// hade det blivit en katalog som heter "Library" i hemmappen — synlig,
/// felplacerad och utanför det som säkerhetskopieras.
///
/// Varje system har ett svar på frågan, och det är det svaret som gäller:
/// Application Support på macOS, AppData\Roaming på Windows,
/// XDG_DATA_HOME eller .local/share på Linux.
export function datakatalog(namn = 'Maximus') {
  if (AR_MAC) return join(homedir(), 'Library', 'Application Support', namn);
  if (AR_WINDOWS) return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), namn);
  return join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), namn.toLowerCase());
}

/// Nyckelringen finns bara på Mac. På en server ska huvudnyckeln inte ligga
/// i ett användarkonto ändå — den kommer från miljön eller ett lösenord.
export const HAR_NYCKELRING = AR_MAC;

/// Öppnar en adress i systemets webbläsare.
export function oppnaKommando(adress) {
  if (AR_MAC) return { fil: '/usr/bin/open', argument: [adress] };
  // Inte genom cmd (granskningen 2026-10-09): cmd läser `&`, `|` och `^` i
  // en adress eller ett filnamn som nya kommandon. explorer.exe tar adressen
  // som ett enda argument. Windows släpps inte i 1.0 och är inte provat här.
  if (AR_WINDOWS) return { fil: 'explorer.exe', argument: [adress] };
  return { fil: 'xdg-open', argument: [adress] };
}
