/// Vad den här datorn bär — frågat, inte gissat.
///
/// MAXIMUS 4 sa "datorn kör en motor i taget". Det var en konstant skriven som
/// en regel, och den var fel: det beror på maskinen. En M1 Max med 64 GB bär
/// samtal och agent samtidigt med stor marginal; en 16 GB-maskin gör det
/// inte. Samma kod, två olika sanningar.
///
/// En valfri lokal schemaläggare för modeller vet redan svaret, när den finns
/// på maskinen. Den håller en ledger över vad som är utlånat, hur
/// mycket som är fritt, och vad den skulle reservera för en given modell —
/// mätt från tidigare körningar, inte räknat ur filstorleken.
///
/// Mätt 2026-10-03 på en M1 Max 64 GB:
///
///     gemma-4-12b   på disk 6,5G   uppmätt topp 22G   schemaläggaren reserverar 24G
///     gemma-4-E4B   på disk 4,8G   uppmätt topp 6,3G  schemaläggaren reserverar  7G
///
/// Notera skillnaden mellan disk och topp. Räknar man på filstorleken — som
/// MAXIMUS gjorde — får man 10G för en modell som i verkligheten toppar på 22.
/// Det är därför frågan ställs till schemaläggaren och inte till `stat()`.

import { execFile } from 'node:child_process';
import os from 'node:os';
import { tx } from './sprakstod.mjs';

const kor = (fil, argument, { timeout = 8000 } = {}) => new Promise(klar => {
  execFile(fil, argument, { timeout, maxBuffer: 8e6 }, (e, ut) => klar(e ? null : String(ut)));
});

/// Var schemaläggaren ligger. LÖFTET sparas, inte svaret.
///
/// Stod `letat = true` före `await`, och returnerade `locoFil` — som
/// fortfarande var null — till alla som frågade innan det första svaret kom.
/// Fyra samtidiga frågor gav ett svar och tre null, och MAXIMUS drog slutsatsen
/// att den inte visste hur mycket modellen behövde. Ledgern kom fram, för den
/// råkade vara först.
///
/// En cache som fylls efter ett await måste hålla löftet, inte värdet.
let schemaLofte = null;
function hittaSchemalaggare() {
  schemaLofte ||= kor('/usr/bin/which', ['loco']).then(ut => ut?.trim() || null);
  return schemaLofte;
}

/// Glömmer var schemaläggaren låg. För prov.
export const glom = () => { schemaLofte = null; };

/// Ledgern, som schemaläggaren ser den. `null` om schemaläggaren inte finns på maskinen.
///
/// Att schemaläggaren saknas är inte ett fel. Oftast finns den inte, och då
/// faller MAXIMUS tillbaka på vad operativsystemet säger om minnet — sämre,
/// men inte trasigt.
export async function ledger() {
  const fil = await hittaSchemalaggare();
  if (!fil) return null;
  const ut = await kor(fil, ['status', '--json']);
  if (!ut) return null;
  try {
    const d = JSON.parse(ut);
    return {
      total: Number(d.total) || 0,
      reserv: Number(d.reserve) || 0,
      utlanat: Number(d.committed) || 0,
      fritt: Number(d.free) || 0,
      // Vad kärnan säger att den kan få fram. Lägre än `fritt` betyder att
      // ledgern lovat mer än maskinen har just nu.
      verkligt: Number(d.vm_available) || 0,
      leaser: Array.isArray(d.leases) ? d.leases.map(l => ({
        modell: l.model || null, tagg: l.tag || null,
        behov: Number(l.need) || 0, faktiskt: Number(l.actual) || 0,
      })) : [],
    };
  } catch { return null; }
}

/// Vad schemaläggaren skulle reservera för en modell, i byte.
///
/// Det här är det tal som räknas. `behovet()` i lib/modell.mjs räknar ur
/// filstorlek plus påslag och landar på tio gigabyte för en modell som
/// toppar på tjugotvå — den siffran duger för att STARTA en modell, men
/// inte för att avgöra om två får plats.
export async function reserven(modellfil) {
  const fil = await hittaSchemalaggare();
  if (!fil || !modellfil) return null;
  const ut = await kor(fil, ['estimate', String(modellfil)]);
  if (!ut) return null;
  const m = /^\s*reserve\s+([\d.,]+)\s*([KMGT])/mi.exec(ut);
  if (!m) return null;
  const tal = Number(String(m[1]).replace(',', '.'));
  const steg = { K: 2 ** 10, M: 2 ** 20, G: 2 ** 30, T: 2 ** 40 }[m[2].toUpperCase()];
  return Number.isFinite(tal) ? Math.round(tal * steg) : null;
}

/// Vad maskinen bär när schemaläggaren inte finns.
///
/// Hälften av det fysiska minnet, minus det som redan är taget. Grovt med
/// flit: utan en ledger vet ingen vad andra program lovat sig själva, och
/// att gissa högt är att gissa fel på det dyra hållet.
const utanSchemalaggare = () => ({
  total: os.totalmem(), reserv: 0, utlanat: 0,
  fritt: Math.max(0, os.freemem()), verkligt: Math.max(0, os.freemem()), leaser: [],
  gissat: true,
});

/// Lägen en maskin kan vara i.
export const LAGEN = {
  /// Båda motorerna ryms. Inget val att tvinga fram.
  bada: 'bada',
  /// En i taget. Samtal har företräde, agenten kör i glappen.
  en: 'en',
  /// Agenten ryms bara på en mindre modell, och ska säga att den gör det.
  liten: 'liten',
  /// Det räcker inte. Agenten går att slå på men viker undan ofta.
  knapp: 'knapp',
};

/// Ryms båda motorerna?
///
/// Marginalen är inte prydnad. En modell som precis får plats i ledgern är
/// en modell som swappar vid första långa frågan, och en agent som gör
/// datorn seg är en agent man stänger av — oavsett hur rätt den har.
const MARGINAL = 1.15;

export function avgor({ ledger: l, samtal, agent, agentLiten = null }) {
  const m = l || utanSchemalaggare();

  // Två olika frågor, och att blanda ihop dem var ett riktigt fel.
  //
  //   BÄR MASKINEN BÅDA?   en egenskap hos datorn. Total minus reserv.
  //                        Stabil. Avgör om man över huvud taget måste välja.
  //   FINNS PLATS NU?      ett ögonblick. Fritt plus det som redan hålls.
  //                        Flyktig. Avgör om agenten får slå just nu.
  //
  // Första versionen byggde valet på det flyktiga talet. Samma dator sa
  // "du måste välja" klockan tio och "välj fritt" klockan elva, beroende på
  // om modellen råkade vara laddad när frågan ställdes. Ett hem som ställer
  // en tvingande fråga ibland är värre än ett som alltid gör det: man lär
  // sig inte vad appen är.
  //
  // Företrädet — agenten viker för samtalet när minnet tryter — är redan
  // byggt i lib/agent.mjs och svarar på den flyktiga frågan. Den här
  // funktionen svarar på den stabila.
  const barMaskinen = Math.max(0, (m.total || 0) - (m.reserv || 0));
  const haller = (m.leaser || []).reduce((a, x) => a + (x.faktiskt || 0), 0);
  const nu = Math.max(0, Math.min(m.fritt + haller, m.verkligt + haller));

  const ryms = (tak, ...behov) => behov.reduce((a, b) => a + b, 0) * MARGINAL <= tak;
  const bas = { tillgangligt: nu, barMaskinen };

  if (!samtal) return { ...bas, lage: LAGEN.knapp, valjs: true,
    skal: tx('kapacitet.vetInte') };

  if (agent && ryms(barMaskinen, samtal, agent)) {
    return { ...bas, lage: LAGEN.bada, samtal, agent, valjs: false,
      skal: tx('kapacitet.bada') };
  }
  if (agentLiten && ryms(barMaskinen, samtal, agentLiten)) {
    return { ...bas, lage: LAGEN.liten, samtal, agent: agentLiten, valjs: false,
      skal: tx('kapacitet.liten') };
  }
  if (ryms(barMaskinen, samtal)) {
    return { ...bas, lage: LAGEN.en, samtal, agent: null, valjs: true,
      skal: tx('kapacitet.en') };
  }
  return { ...bas, lage: LAGEN.knapp, samtal, agent: null, valjs: true,
    skal: tx('kapacitet.knapp') };
}

/// Finns det plats JUST NU för ett till modellanrop?
///
/// Den flyktiga frågan, skild från den stabila ovan. Hjärtslaget frågar den
/// här innan det tänker — och svarar den nej hoppar agenten över varvet och
/// säger varför, precis som i dag.
export function rymsNu({ ledger: l, behov }) {
  const m = l || utanSchemalaggare();
  const haller = (m.leaser || []).reduce((a, x) => a + (x.faktiskt || 0), 0);
  const nu = Math.max(0, Math.min(m.fritt + haller, m.verkligt + haller));
  if (!behov) return { ja: true, tillgangligt: nu };
  return { ja: behov * MARGINAL <= nu, tillgangligt: nu, behov };
}

/// Hela frågan, ställd på en gång.
export async function lage({ samtalfil, agentfil = null, agentLitenFil = null } = {}) {
  const [l, samtal, agent, liten] = await Promise.all([
    ledger(),
    reserven(samtalfil),
    agentfil ? reserven(agentfil) : null,
    agentLitenFil ? reserven(agentLitenFil) : null,
  ]);
  return { ...avgor({ ledger: l, samtal, agent: agent ?? samtal, agentLiten: liten }), ledger: l };
}

/// Byte i läsbar form. 24159191040 → "24 GB".
export const gb = b => `${Math.round((Number(b) || 0) / 2 ** 30)} GB`;
