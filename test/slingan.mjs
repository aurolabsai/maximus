/// Fas 28 mot den riktiga modellen: tre uppgifter som kräver två eller fler
/// verktyg, med påhittade mejl och möten (aldrig användarens). Modellen är
/// provserverns; verktygen är lib/verktyg.mjs med en provkontext.
import { slinga } from '../lib/slinga.mjs';
import { skapaVerktyg } from '../lib/verktyg.mjs';
import { verktygsanrop } from '../lib/lokal.mjs';
const url = `unix:${process.argv[2] || '/tmp/maximus-prov/modell.sock'}`;
const imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 1);
const dag = d => d.toISOString().slice(0, 10);
const MEJL = [
  { id: '1', titel: 'Möte om upphandlingen', fran: 'Henrik Lindgren <henrik@kommun.example>', tid: new Date().toISOString(), text: `Hej! Kan vi ses i morgon ${dag(imorgon)} klockan 10:00 om upphandlingen? /Henrik` },
  { id: '2', titel: 'Faktura 1041', fran: 'Kontorab <faktura@kontorab.se>', tid: new Date().toISOString(), text: 'Faktura 1041. Att betala: 12 400 kr.' },
  { id: '3', titel: 'Faktura 1042', fran: 'Kontorab <faktura@kontorab.se>', tid: new Date().toISOString(), text: 'Faktura 1042. Att betala: 3 850 kr.' },
  { id: '4', titel: 'Nyhetsbrev', fran: 'news@ai.se', tid: new Date().toISOString(), text: 'Veckans AI-nyheter.' },
];
const MOTEN = [
  { rubrik: 'Styrgrupp', start: `${dag(imorgon)}T09:30`, slut: `${dag(imorgon)}T11:00`, heldag: false },
  { rubrik: 'Lunch med Karin', start: `${dag(imorgon)}T12:00`, slut: `${dag(imorgon)}T13:00`, heldag: false },
];
const ctx = { lasKalla: async typ => (typ === 'epost' ? MEJL : []), kalender: async () => MOTEN, genvagar: async () => [] };
const agent = { epost: { konto: 'prov' }, kalender: {} };
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const kor = async uppgift => {
  const t0 = Date.now();
  const r = await slinga({ uppgift, verktyg: skapaVerktyg(ctx, agent), anropa: o => verktygsanrop({ url, meddelanden: o.meddelanden, verktyg: o.verktyg }) });
  console.log(`  ${uppgift}\n  → ${r.steg.map(s => `${s.verktyg}(${JSON.stringify(s.argument)})`).join(' → ')}\n  → ${r.svar.replace(/\n/g, ' ').slice(0, 300)} (${Math.round((Date.now() - t0) / 1000)} s)`);
  return r;
};
let r = await kor('Henrik har mejlat om ett möte. När vill han ses, och krockar det med något i min kalender?');
ok(r.steg.some(s => s.verktyg === 'mejl') && r.steg.some(s => s.verktyg === 'kalender' || s.verktyg === 'lediga_tider'), 'mejl och kalender');
ok(/10[:.]00/.test(r.svar) && /styrgrupp|krock/i.test(r.svar), 'svaret ser krocken med styrgruppen');
r = await kor('Hur mycket ska jag betala totalt för fakturorna i inkorgen?');
ok(r.steg.some(s => s.verktyg === 'mejl') && r.steg.some(s => s.verktyg === 'rakna'), 'mejl och räkna');
ok(/16[\s ]?250/.test(r.svar), 'summan 16 250 kr, uträknad');
r = await kor('Hitta en ledig timme i morgon eftermiddag mellan 13 och 17.');
ok(r.steg.some(s => s.verktyg === 'lediga_tider' || s.verktyg === 'kalender'), 'kalendern eller lediga tider');
ok(/13[:.]00|14[:.]00/.test(r.svar), 'en ledig tid efter lunchen');
process.exit(rott ? 1 : 0);
