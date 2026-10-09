/// Starten: ett förslag på båda modellerna, räknat ur den här datorns minne.
///
/// Guiden frågade två gånger — först modellen som tänker, sedan om appen
/// skulle kunna skriva av ljud — och den som installerade fick fatta två
/// beslut om saker hon inte visste något om. Nu är det ett förslag, ett
/// val: vilken som tänker, vilken som hör, och varför just de på just den
/// här datorn. "Välj egen" finns för den som vill.
///
/// Ren funktion: kapaciteten, katalogen och öronen in, förslaget ut. Den går
/// att prova utan nät, utan disk och utan modell.
import { valjModell, KATALOG } from './modeller.mjs';
import { ORON } from './dokument.mjs';
import { tx, svenska } from './sprakstod.mjs';

// Decimalkomma på svenska, punkt på engelska.
const gb = byte => { const s = (byte / 2 ** 30).toFixed(1); return svenska() ? s.replace('.', ',') : s; };

/// Örat som passar datorn.
///
/// KB-Whisper är förvalet: appen är svensk, och den stavar svenska namn och
/// orter rätt. Den snabba tas bara när datorn inte orkar — under 16 GB
/// minne går den stora för långsamt bredvid en språkmodell, och på en full
/// disk är 530 MB bättre än ingenting.
export function valjOra({ minneGB, disk }, tankerByte = 0) {
  const ledigt = disk ?? Infinity;
  const svensk = ORON.svensk, snabb = ORON.snabb;
  if (minneGB < 16)
    return { ...snabb, varfor: tx('lib.start.ora.litetMinne', { gb: minneGB }) };
  // På ett annat språk än svenska är KB-Whisper fel förslag: den är tränad
  // på svenska. Den allmänna kan sjuttio språk (slutgenomgången 2026-10-09).
  if (!svenska()) return { ...snabb, varfor: tx('lib.start.ora.allman') };
  if ((tankerByte + svensk.byte) * 1.15 > ledigt)
    return { ...snabb, varfor: tx('lib.start.ora.litenDisk', { gb: Math.round(ledigt / 2 ** 30) }) };
  return { ...svensk, varfor: tx('lib.start.ora.svensk') };
}

/// Förslaget. `{ tanker, hor, minneGB, diskGB, racker, summaByte }`.
///
/// `tanker.varfor` säger varför modellen valdes PÅ DEN HÄR DATORN, inte vad
/// modellen är: minnet först, sedan skälet. Den som undrar varför hon fick
/// 12B och inte 26B ska få svaret utan att fråga.
export function forslag(kap) {
  const minneGB = kap.minneGB ?? Math.round((kap.minne || 0) / 2 ** 30);
  const m = valjModell({ ...kap, minneGB });
  const varfor = !m.racker
    ? m.varfor
    : m.oprovad
      ? tx('lib.start.oprovad', { gb: minneGB, varfor: m.varfor })
      : tx('lib.start.ryms', { gb: minneGB, namn: m.namn, varfor: m.varfor });
  const tanker = { id: m.id, namn: m.namn, hus: m.hus, licens: m.licens, byte: m.byte,
    storlek: `${gb(m.byte)} GB`, provad: Boolean(m.provad), varfor };
  const o = valjOra({ minneGB, disk: kap.disk ?? null }, m.byte);
  const hor = { id: o.id, namn: o.namn, hus: o.hus, byte: o.byte, storlek: o.storlek, varfor: o.varfor };
  return { tanker, hor, minneGB, diskGB: kap.diskGB ?? null, racker: m.racker !== false,
    summaByte: m.byte + o.byte };
}

/// Katalogen som alternativ under "Välj egen", minst först.
export const alternativ = (minneGB, finns = new Set()) => [...KATALOG]
  .sort((a, b) => a.minne - b.minne || a.byte - b.byte)
  .map(m => ({ id: m.id, namn: m.namn, hus: m.hus, licens: m.licens, byte: m.byte, storlek: `${gb(m.byte)} GB`,
    minne: m.minne, passar: m.minne <= minneGB, provad: Boolean(m.provad), finns: finns.has(m.id), om: m.om }));

/// Duger filen som egen modell?
///
/// En sökväg från användaren är det enda i starten som inte kommer ur
/// katalogen. Den prövas: absolut, .gguf, en riktig fil, större än en
/// gigabyte — det minsta en språkmodell väger. Ett svar som säger varför
/// den inte dög, aldrig ett tyst nej.
/// En egen lyssnarmodell (2026-10-06, Auro: "bara två på ljud ... Där kan
/// vi inte välja egen fil"). whisper.cpp läser ggml-filer (.bin), och de
/// minsta brukbara är runt 75 MB. `huvud` är filens första fyra byte:
/// whisper.cpp skriver magin 0x67676d6c, alltså "lmgg" på disk.
export function provaEgetOra(vag, stat, huvud = null) {
  const v = String(vag || '').trim();
  if (!v) return { ok: false, skal: tx('lib.start.ora.skriv') };
  if (!v.startsWith('/')) return { ok: false, skal: tx('lib.start.ora.snedstreck') };
  if (!/\.bin$/i.test(v)) return { ok: false, skal: tx('lib.start.ora.bin') };
  if (!stat) return { ok: false, skal: tx('lib.start.finnsInte') };
  if (!stat.isFile()) return { ok: false, skal: stat.isDirectory?.() ? tx('lib.start.mapp') : tx('lib.start.ingenFil') };
  if (stat.size < 30e6) return { ok: false, skal: tx('lib.start.ora.liten', { mb: (stat.size / 1e6).toFixed(0) }) };
  // `huvud` null = inte läst än (första prövningen); en sträng måste vara magin.
  if (huvud !== null && !['lmgg', 'ggml', 'GGUF'].includes(huvud)) return { ok: false, skal: tx('lib.start.ora.ingenWhisper') };
  return { ok: true, vag: v, storlek: stat.size >= 1e9 ? `${gb(stat.size)} GB` : `${Math.round(stat.size / 1e6)} MB` };
}

export function provaEgen(vag, stat) {
  const v = String(vag || '').trim();
  if (!v) return { ok: false, skal: tx('lib.start.egen.skriv') };
  if (!v.startsWith('/')) return { ok: false, skal: tx('lib.start.egen.snedstreck') };
  if (!/\.gguf$/i.test(v)) return { ok: false, skal: tx('lib.start.egen.gguf') };
  if (!stat) return { ok: false, skal: tx('lib.start.finnsInte') };
  if (!stat.isFile()) return { ok: false, skal: tx('lib.start.mapp') };
  if (stat.size < 1e9) return { ok: false, skal: tx('lib.start.egen.liten', { mb: (stat.size / 1e6).toFixed(0) }) };
  return { ok: true, vag: v, storlek: `${gb(stat.size)} GB` };
}
