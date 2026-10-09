// Meddelanden (iMessage och SMS) och samtalslistan, för agenten.
//
// Auro 2026-10-04: "imessage och telefon samt filmappar = behöver lösas.
// om det är sån access du pratar om, ja då får du länka till det så att
// det öppnas ... men det är ju bara om och när de apparna väljs av
// användaren."
//
// Båda ligger i SQLite-filer som macOS skyddar med "Full skivåtkomst":
//
//   ~/Library/Messages/chat.db
//   ~/Library/Application Support/CallHistoryDB/CallHistory.storedata
//
// Ingen app kan ge sig själv den rätten. Utan den svarar läsningen med
// `tillstand: true`, och appen öppnar rätt ruta i Systeminställningar
// (FDA_URL) — bara när någon valt just den här källan.
//
// Läs, aldrig skriv: filerna öppnas med sqlite3 -readonly,
// macOS eget program. Ingen rad skrivs, och ingenting lämnar datorn.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { access, constants } from 'node:fs/promises';
import { AR_MAC } from './plattform.mjs';
import { tx } from './sprakstod.mjs';

const kor = promisify(execFile);
const SQLITE = '/usr/bin/sqlite3';
export const CHATT = () => join(homedir(), 'Library', 'Messages', 'chat.db');
export const SAMTAL = () => join(homedir(), 'Library', 'Application Support', 'CallHistoryDB', 'CallHistory.storedata');

/// Rutan i Systeminställningar där Full skivåtkomst ges.
export const FDA_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles';

/// Apples tid räknas från 1 januari 2001. Meddelandena i nanosekunder
/// (sedan macOS 10.13), samtalen i sekunder.
const APPLE = Date.UTC(2001, 0, 1);
export const fran2001 = v => {
  const n = Number(v) || 0;
  return new Date(APPLE + (n > 1e12 ? n / 1e6 : n * 1000));
};

/// Texten ur attributedBody, när text-kolumnen är tom (nyare macOS).
///
/// Fältet är ett NSAttributedString i Apples "typedstream". Strängen står
/// efter ordet NSString, sex byte in, med längden före: en byte, eller 0x81
/// följt av två byte (little endian) för längre texter.
export function urAttributedBody(hex) {
  if (!hex) return '';
  const b = Buffer.from(String(hex), 'hex');
  const i = b.indexOf('NSString');
  if (i < 0) return '';
  let p = i + 'NSString'.length + 5;
  let len = b[p];
  if (len === 0x81) { len = b.readUInt16LE(p + 1); p += 3; }
  else if (len === 0x82) { len = b.readUInt32LE(p + 1); p += 5; }
  else p += 1;
  return b.subarray(p, p + len).toString('utf8');
}

async function fraga(fil, sql) {
  if (!AR_MAC) return { finns: false, rader: [] };
  try { await access(fil, constants.F_OK); } catch { return { finns: false, rader: [] }; }
  try {
    const { stdout } = await kor(SQLITE, ['-readonly', '-json', fil, sql], { maxBuffer: 32e6, timeout: 20000 });
    return { finns: true, rader: stdout.trim() ? JSON.parse(stdout) : [] };
  } catch (e) {
    // Utan Full skivåtkomst: "authorization denied" eller "unable to open".
    if (/authoriz|not permitted|unable to open|denied/i.test(`${e.stderr || ''} ${e.message || ''}`)) {
      const f = new Error(tx('lib.meddelanden.fullSkiv'));
      f.tillstand = true;
      throw f;
    }
    throw new Error(tx('lib.meddelanden.lista'));
  }
}

/// De senaste meddelandena, nyast först. Bara inkommande som förval — det
/// du själv skrivit vet du redan.
export async function meddelanden({ antal = 60, egna = false } = {}) {
  const r = await fraga(CHATT(), `select m.ROWID as id, m.text, hex(m.attributedBody) as ab, m.date, m.is_from_me as egen,
      h.id as fran, m.service from message m left join handle h on h.ROWID = m.handle_id
      where m.associated_message_type = 0 ${egna ? '' : 'and m.is_from_me = 0'}
      order by m.date desc limit ${Math.max(1, Math.min(500, Number(antal) || 60))}`);
  return r.rader.map(x => {
    const text = String(x.text || urAttributedBody(x.ab) || '').replace(/￼/g, '').trim();
    return { id: `msg:${x.id}`, fran: x.fran || tx('lib.meddelanden.okand'), tid: fran2001(x.date).toISOString(),
      titel: text.slice(0, 90) || tx('lib.meddelanden.bilaga'), text: text.slice(0, 2000), tjanst: x.service || '' };
  }).filter(x => x.text || x.titel);
}

/// Samtalslistan, nyast först: vem, när, hur länge, och om det missades.
export async function samtal({ antal = 60 } = {}) {
  const r = await fraga(SAMTAL(), `select Z_PK as id, ZADDRESS as adress, ZNAME as namn, ZDATE as datum,
      ZDURATION as langd, ZORIGINATED as utgaende, ZANSWERED as besvarat from ZCALLRECORD
      order by ZDATE desc limit ${Math.max(1, Math.min(500, Number(antal) || 60))}`);
  return r.rader.map(x => {
    const vem = x.namn || x.adress || tx('lib.meddelanden.okantNummer');
    const min = Math.round((Number(x.langd) || 0) / 60);
    const vad = tx(x.utgaende ? 'lib.meddelanden.duRingde' : x.besvarat ? 'lib.meddelanden.samtalFran' : 'lib.meddelanden.missat', { vem });
    return { id: `samtal:${x.id}`, fran: x.adress || '', tid: fran2001(x.datum).toISOString(),
      titel: `${vad}${min ? ` · ${min} min` : ''}`, text: vad, missat: !x.utgaende && !x.besvarat };
  });
}

/// Går källan att läsa just nu? { finns, tillstand } — för frågan om lov.
export async function prova(vad) {
  try {
    const r = vad === 'samtal' ? await samtal({ antal: 1 }) : await meddelanden({ antal: 1 });
    void r;
    const fil = vad === 'samtal' ? SAMTAL() : CHATT();
    try { await access(fil, constants.F_OK); } catch { return { finns: false }; }
    return { finns: true, ok: true };
  } catch (e) { return { finns: true, ok: false, tillstand: Boolean(e.tillstand), fel: e.message }; }
}
