// Tala i stället för att skriva (Fas 42, 2026-10-05).
//
// Auro: mikrofonen i rutan skickade inspelningen som en ljudfil, med kort
// och avskrift ("lite osexigt"), och det sagda blev aldrig en fråga. Nu
// dikterar den: orden kommer i rutan medan du talar, och "skicka" sagt
// sist — eller en stunds tystnad — skickar.
//
// Igenkänningen är Apples DictationTranscriber (SpeechAnalyzer, macOS 26),
// på datorn. SpeechTranscriber, den nyare, kan inte svenska än; whisper
// skriver bra men i efterhand, inte medan man talar. Ljudet kommer från
// fönstret i bitar och skrivs till hjälparen (verktyg/diktera.swift), som
// aldrig öppnar mikrofonen själv och aldrig sparar något.

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

/// Orden som skickar, eller avbryter, när de sägs sist.
// Svenska och engelska, alltid (fas 3): "skicka", "send it now", "avbryt",
// "never mind". Gränsen förstår å, ä och ö (JS \b gör det inte).
const SKICKA = /[\s,.]*(?<![\p{L}\p{N}])(skicka(?:\s+det)?(?:\s+nu)?|send(?:\s+it)?(?:\s+now)?|submit)[.!?]*\s*$/iu;
const AVBRYT = /[\s,.]*(?<![\p{L}\p{N}])(avbryt|glöm\s+det|cancel(?:\s+(?:it|that))?|never\s*mind|forget\s+it|scratch\s+that)[.!?]*\s*$/iu;

/// Kommandoordet sist i det dikterade, om det finns. Texten utan ordet.
export function kommando(text) {
  const t = String(text || '');
  if (SKICKA.test(t)) return { gor: 'skicka', text: t.replace(SKICKA, '').trim() };
  if (AVBRYT.test(t)) return { gor: 'avbryt', text: t.replace(AVBRYT, '').trim() };
  return { gor: null, text: t.trim() };
}

/// Egna ord att ge igenkänningen som ledtrådar: namn, företag, projekt.
/// Ett ord med stor bokstav som inte står först i en mening, ett ord med
/// versaler eller siffror inuti ("Auroagent", "LBE", "Q4"), och hela namn
/// på projekt och uppdrag. Utan dem blev "Auroagent" "Maur agent".
export function ordUr(texter, { tak = 150 } = {}) {
  const ut = new Map();
  const lagg = o => { const k = o.toLowerCase(); if (!ut.has(k)) ut.set(k, o); };
  for (const t of texter.namn || []) { const n = String(t || '').trim(); if (n && n.length <= 60) lagg(n); }
  for (const text of texter.fritt || []) {
    for (const mening of String(text || '').split(/(?<=[.!?:\n])\s+/)) {
      const ord = mening.split(/[^\p{L}\p{N}@&-]+/u).filter(Boolean);
      ord.forEach((o, i) => {
        if (o.length < 3 || o.length > 30) return;
        const versal = /^\p{Lu}/u.test(o), inuti = /.\p{Lu}|\p{N}/u.test(o.slice(1)) || /^\p{Lu}{2,}$/u.test(o);
        if (inuti || (versal && i > 0)) lagg(o);
      });
    }
  }
  return [...ut.values()].slice(0, tak);
}

/// Hela texten hittills: det som fastställts, och det som ännu kan ändras.
/// Hjälparen skickar ett resultat per stycke; ett fastställt stycke följs
/// av nästa styckes tillfälliga.
export function sammanfoga(fasta, tillfalligt) {
  return [...fasta, tillfalligt].map(s => String(s || '').trim()).filter(Boolean).join(' ');
}

/// En diktering: en hjälparprocess, texten hittills, och dess slut.
/// `starta(argv)` ger en process med stdin/stdout (spawn, eller ett prov).
export function nyDiktering({ bin, argv = [], starta = (b, a) => spawn(b, a, { stdio: ['pipe', 'pipe', 'ignore'] }) } = {}) {
  const p = starta(bin, argv);
  const d = { fasta: [], tillfalligt: '', fel: null, redo: false, laddar: false, slut: false, senast: Date.now() };
  let redo, slut;
  const redoLofte = new Promise(r => { redo = r; });
  const slutLofte = new Promise(r => { slut = r; });
  createInterface({ input: p.stdout }).on('line', rad => {
    let h; try { h = JSON.parse(rad); } catch { return; }
    if (h.fel) { d.fel = h.fel; redo(); slut(); }
    else if (h.laddar) d.laddar = true;
    else if (h.redo) { d.redo = true; redo(); }
    else if (h.slut) { d.slut = true; slut(); }
    else if (typeof h.text === 'string') {
      if (h.klar) { d.fasta.push(h.text); d.tillfalligt = ''; } else d.tillfalligt = h.text;
    }
  });
  p.on('exit', () => { d.slut = true; redo(); slut(); });
  p.on('error', e => { d.fel = e.message; redo(); slut(); });
  p.stdin.on('error', () => {});
  return {
    tillstand: d,
    text: () => sammanfoga(d.fasta, d.tillfalligt),
    vantaRedo: ms => Promise.race([redoLofte, new Promise(r => setTimeout(r, ms))]),
    ljud(buf) { d.senast = Date.now(); if (!d.slut && buf?.length) p.stdin.write(buf); },
    async avsluta(ms = 6000) {
      if (!d.slut) p.stdin.end();
      await Promise.race([slutLofte, new Promise(r => setTimeout(r, ms))]);
      if (!d.slut) p.kill();
      return sammanfoga(d.fasta, d.tillfalligt);
    },
    doda() { try { p.kill(); } catch {} d.slut = true; },
  };
}
