// Mötesanteckningar (Fas 43, 2026-10-05).
//
// Auro: "Mötesanteckningar (ljudinspelning, gärna i batcher om ... 5 min
// vardera max och sessionsbundet? om 10x5min = transkribera löpande så och
// sammanfatta till slut".
//
// Inspelningen delas var femte minut. Varje del skrivs ut medan mötet
// fortsätter, och avskriften växer i samtalet. Vid stopp blir hela
// avskriften ett dokument i samtalet, och Maximus sammanfattar det: vad det
// handlade om, vad som bestämdes, vem som gör vad och när, vad som är öppet.
//
// Ren logik: tiden i varje del räknas om från mötets början, och delarna
// fogas till en avskrift.

/// Längsta del, i millisekunder.
export const DEL_MS = 5 * 60 * 1000;

const tid = sek => {
  const s = Math.max(0, Math.round(sek));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/// Raderna i en dels avskrift, med tiden räknad från mötets början.
/// Whisper skriver "[00:01:02.000 --> 00:01:05.000]  text"; utan stämpel
/// får raden delens början.
export function rader(text, franSek = 0) {
  const ut = [];
  for (const r of String(text || '').split(/\r?\n/)) {
    const m = /^\s*\[(\d+):(\d+):(\d+(?:\.\d+)?)\s*-->[^\]]*\]\s*(.*)$/.exec(r)
      || /^\s*\[(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/.exec(r);
    const t = (m ? m[4] : r).trim();
    if (!t) continue;
    const sek = m ? (Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) : 0;
    ut.push({ sek: franSek + sek, text: t });
  }
  return ut;
}

/// Hela avskriften, del för del i ordning, en rad per yttrande.
export function avskrift(delar) {
  return [...delar].sort((a, b) => a.nr - b.nr)
    .flatMap(d => rader(d.text, d.fran))
    .map(r => `[${tid(r.sek)}] ${r.text}`).join('\n');
}

import { tx } from './sprakstod.mjs';

/// Dokumentets namn: när mötet började och hur länge det pågick. Datumet
/// står som 2026-10-05 på alla språk — ett snedstreck hör inte hemma i ett
/// filnamn.
export function namn(borjade, langdSek) {
  const d = new Date(borjade);
  return `${tx('pars.mote.namn')} ${d.toLocaleDateString('sv-SE')} ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')} (${tid(langdSek)}).txt`;
}

export const arMote = filnamn => /^(Mötesanteckningar|Meeting notes) /.test(String(filnamn || ''));
