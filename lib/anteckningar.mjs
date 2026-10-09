/// Apple Anteckningar. Läser alltid, skriver bara där du pekat.
///
/// Två användningar, och de är olika saker:
///
///   SOM KÄLLA. Det du skrivit ned är sammanhang — vad ärendet gäller, vad
///   som sagts, vad du inte vill glömma. Agenten läser det som underlag när
///   den bedömer vad som är viktigt.
///
///   SOM ANSLAGSTAVLA. Agenten lägger sina sammanställningar i en mapp du
///   pekat ut, så att de finns där du redan läser dem — i telefonen, i
///   Anteckningar, utan MAXIMUS öppet.
///
/// Det andra kräver skrivrättighet, och det är ett eget beslut per mapp.
/// Förvalet är läs.
///
/// ── Gränsen, skriven i kod och inte i text ────────────────────────────────
///
/// `skriv()` tar mappens namn och vägrar utan. Den SKAPAR en ny anteckning
/// och rör aldrig en befintlig: inget `set body of note`, ingen `delete`.
/// Det du skrivit kan agenten läsa; det kan den inte ändra på.
///
/// En mapp, inte allt. `anteckningar()` kräver ett mappnamn av samma skäl —
/// "läs mina anteckningar" är inte ett tillstånd någon kan överblicka.

import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { AR_MAC } from './plattform.mjs';
import { tx } from './sprakstod.mjs';

/// Skiljetecken, nya för varje läsning (granskningen 2026-10-09).
///
/// Här stod de fasta tecknen U+001F och U+001E. En rubrik, ett mappnamn
/// eller en text som bar dem — också i en delad iCloud-anteckning som någon
/// annan skriver i — kunde lägga till fält och hela rader: en påhittad
/// anteckning bland de riktiga. lib/flode.mjs fick samma rättelse
/// 2026-10-06. Ett slumpat värde per anrop
/// kan ingen som skriver texten känna till, och en rad med fel antal fält
/// kastas hellre än gissas.
const skiljare = () => {
  const h = randomBytes(8).toString('hex');
  return { F: `~F${h}~`, R: `~R${h}~` };
};

// 90 s, inte 45: Anteckningar som just startats eller synkar med iCloud
// svarade inte på 45 s, tre gånger i rad, och uppdraget pausades (sett hos
// Auro 2026-10-06 — samma läsning gick på 19 s strax efter).
const kor = (skript, { timeout = 90000 } = {}) => new Promise((klar, fel) => {
  execFile('/usr/bin/osascript', ['-'], { timeout, maxBuffer: 64e6 }, (e, ut, felut) => {
    if (e) {
      // Tiden tog slut: inget fel i uppdraget, bara en långsam app. Det sägs
      // som det är, och räknas inte mot pausen (se slag i lib/agent.mjs).
      if (e.killed || e.signal) return fel(Object.assign(new Error(tx('lib.anteckningar.timeout', { s: Math.round(timeout / 1000) })), { tillfalligt: true }));
      const t = String(felut || e.message);
      if (/-1743|not authorized|inte auktoriserad/i.test(t)) {
        return fel(Object.assign(new Error(tx('lib.anteckningar.tillstand')), { tillstand: true }));
      }
      if (/-600|inte igång|isn.t running/i.test(t)) {
        return fel(new Error(tx('lib.anteckningar.inteIgang')));
      }
      return fel(new Error(t.split('\n')[0].slice(0, 200) || tx('lib.anteckningar.svaradeInte')));
    }
    klar(String(ut));
  }).stdin.end(skript);
});

export const finns = () => AR_MAC;

/// Citerar en sträng in i AppleScript.
///
/// Ett mappnamn kommer från ett textfält. Utan den här raden hade ett namn
/// med citattecken kunnat stänga strängen och fortsätta som skript — samma
/// hål som SQL-injektion, i ett annat språk.
const cit = t => `"${String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/// Mapparna som finns, med konto. Det här är listan man väljer UR.
export async function mappar() {
  if (!AR_MAC) return [];
  const { F, R } = skiljare();
  const ut = await kor(`
tell application "Notes"
	set out to ""
	repeat with a in accounts
		repeat with f in folders of a
			set out to out & (name of a) & "${F}" & (name of f) & "${F}" & (count of notes of f) & "${R}"
		end repeat
	end repeat
	return out
end tell`);
  return ut.split(R).map(r => r.trim()).filter(Boolean).map(r => r.split(F)).filter(d => d.length === 3).map(d => {
    const [konto, mapp, antal] = d;
    return { konto: (konto || '').trim(), mapp: (mapp || '').trim(), antal: Number(antal) || 0 };
  });
}

/// Anteckningarna i EN mapp.
///
/// Brödtexten följer med här, till skillnad från posten — en anteckning är
/// kort och den är din egen. Men bara ur den mapp du pekat ut.
export async function anteckningar(mapp, { konto = null, antal = 50 } = {}) {
  if (!AR_MAC) return [];
  if (!String(mapp || '').trim()) throw new Error(tx('lib.anteckningar.enMapp'));
  const n = Math.max(1, Math.min(200, Number(antal) || 50));
  const valj = konto
    ? `set f to first folder of (first account whose name is ${cit(konto)}) whose name is ${cit(mapp)}`
    : `set f to first folder whose name is ${cit(mapp)}`;
  const { F, R } = skiljare();
  const ut = await kor(`
tell application "Notes"
	${valj}
	set tot to (count of notes of f)
	set lim to ${n}
	if tot < lim then set lim to tot
	set out to ""
	repeat with i from 1 to lim
		set x to note i of f
		set out to out & (id of x) & "${F}" & (name of x) & "${F}" & ((modification date of x) as «class isot» as string) & "${F}" & (plaintext of x) & "${R}"
	end repeat
	return out
end tell`);
  return ut.split(R).map(r => r.trim()).filter(Boolean).map(r => r.split(F)).filter(d => d.length === 4).map(d => {
    const [id, titel, andrad, text] = d;
    return {
      id, titel: (titel || tx('lib.anteckningar.utanRubrik')).trim(),
      // `andrad` och inte bara tid: en anteckning du skrivit om är ny för
      // agenten, med samma id. Se stampel() i lib/agent.mjs.
      andrad: (andrad || '').trim(), tid: (andrad || '').trim(),
      text: stada(text || ''),
    };
  });
}

/// Städar en anteckning. Samma skäl som i post.mjs: osynlig utfyllnad fyller
/// förhandsvisningen utan att synas.
export function stada(t) {
  return String(t || '')
    .replace(/[\u034f\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/// Lägger en NY anteckning i en mapp.
///
/// Det enda i hela agenten som ändrar något utanför MAXIMUS, och det kräver att
/// mappen pekats ut uttryckligen. Den skapar; den ändrar aldrig något som
/// redan ligger där, och den tar aldrig bort.
///
/// Att den inte kan skriva över är inte en inställning — verben finns inte i
/// filen. Den som granskar den här koden ska kunna se det utan att leta.
export async function skriv(mapp, { rubrik, text, konto = null } = {}) {
  if (!AR_MAC) throw new Error(tx('lib.anteckningar.baraMac'));
  if (!String(mapp || '').trim()) throw new Error(tx('lib.anteckningar.utpekad'));
  const r = String(rubrik || '').trim() || 'MAXIMUS';
  const kropp = String(text || '').trim();
  if (!kropp) throw new Error(tx('lib.anteckningar.tom'));
  const valj = konto
    ? `set f to first folder of (first account whose name is ${cit(konto)}) whose name is ${cit(mapp)}`
    : `set f to first folder whose name is ${cit(mapp)}`;
  // HTML, för att Anteckningar renderar body som HTML. Allt som går in
  // escapas: en sammanställning som innehåller "<" ska inte bli en tagg.
  const html = `<div><b>${html_(r)}</b></div>` + kropp.split('\n')
    .map(x => `<div>${html_(x) || '<br>'}</div>`).join('');
  const ut = await kor(`
tell application "Notes"
	${valj}
	set nn to make new note at f with properties {name:${cit(r)}, body:${cit(html)}}
	return id of nn
end tell`);
  return { id: String(ut).trim() };
}

const html_ = t => String(t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
