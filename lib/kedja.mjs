
import { maskera, granska, avmaskera, ommaskera } from './maskering.mjs';
import { hittaFynd, maskeraFynd, grindSvarar } from './grind.mjs';
import { maskeraDelar, maskeraOkanda, maskeraFornamn, skydda, rensaOsynliga } from './failclosed.mjs';
import * as Namnmodell from './namnmodell.mjs';
import { strukturera } from './struktur.mjs';
import { atertolka } from './atertolka.mjs';
import { svaraLokalt, langd, molnNamn } from './lokal.mjs';
import { tx } from './sprakstod.mjs';

const svarare = () => {
  const m = molnNamn();
  return m ? { aktor: tx('lib.kedja.molnmodell', { m }), lokalt: false, ut: tx('lib.kedja.gickMaskerad', { m }), frontier: m }
    : { aktor: tx('lib.kedja.lokalModell'), lokalt: true, ut: tx('lib.kedja.ingentingLamnade'), frontier: tx('lib.kedja.lokalModell') };
};
import { raden } from './nu.mjs';
import { tillInstruktion } from './policy.mjs';
import { personatext } from './persona.mjs';
import { uppgiften, uppgiftsvink, slutlig, inramaUtkast } from './uppgift.mjs';
import { kris, tillModellen } from './stod.mjs';
import { arPersonlig, tonvink, utanDom } from './ton.mjs';
import { kanskeFlera, planera } from './delar.mjs';
import { byggBilaga } from './uppslag.mjs';
import { bedom as bedomRojning } from './rojning.mjs';
import { valj } from './urval.mjs';
import { sakerstallModell } from './modell.mjs';

export function maskeraHart(text_, { karta = new Map(), raknare = new Map(), sorter = null } = {}) {
  const kant = ommaskera(rensaOsynliga(text_ || ''), karta);

  const regel = maskera(kant, { karta, raknare, sorter });
  const funna = [...regel.funna];

  const skyddat = skydda(regel.text);

  const namnPa = !sorter || sorter.has('namn') || sorter.has('ort') || sorter.has('organisation');
  let text = skyddat.text;
  if (namnPa) {
    const okanda = maskeraOkanda(text, { karta, raknare });
    funna.push(...okanda.funna);
    const forn = maskeraFornamn(okanda.text, { karta, raknare });
    funna.push(...forn.funna);
    const delar = maskeraDelar(forn.text, karta);
    funna.push(...delar.funna);
    text = delar.text;
    const nm = Namnmodell.maskeraNamnmodell(text, Namnmodell.fyndFor(text_ || ''), { karta, raknare, sorter });
    funna.push(...nm.funna);
    text = nm.text;
  }

  return { text, funna, skyddat, karta, raknare };
}

export async function forbered(fraga_, { signal, onSteg = () => {}, tolka = false, karta: inKarta = [], raknare: inRaknare = {}, sorter = null, modelltak = null } = {}) {
  const t0 = Date.now();
  await Namnmodell.forbered([String(fraga_ || '')], modelltak == null ? { helt: true } : { tak: modelltak }).catch(() => {});
  const kvitto = [];
  onSteg({ steg: 'maskera', text: tx('lib.kedja.steg.maskera') });

  const karta = new Map(inKarta.map(k => [k.original, k.platshallare]));
  const raknare = new Map(Object.entries(inRaknare));

  const foreAntal = inKarta.length;
  const hart = maskeraHart(fraga_, { karta, raknare, sorter });
  const funna = [...hart.funna];
  const skyddat = hart.skyddat;
  let text = hart.text;

  kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.regler'), vad: tx('lib.kedja.maskerade', { n: karta.size - foreAntal }),
    ms: Date.now() - t0, lokalt: true });

  text = skyddat.aterstall(text);

  let varning = null, tolkad = false;
  if (tolka) {
    const tm = Date.now();
    const foreModell = karta.size;
    if (!(await grindSvarar())) {
      varning = tx('lib.kedja.tolkningInteIgang');
      kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), vad: tx('lib.kedja.svaradeInte'), ms: Date.now() - tm, lokalt: true, fel: true });
    } else {
      onSteg({ steg: 'tolka', text: tx('lib.kedja.steg.tolka') });
      try {
        const fynd = await hittaFynd(text, { signal });
        const av = maskeraFynd(text, fynd, { karta, raknare });
        text = av.text;
        funna.push(...av.funna);
        const igen = maskeraDelar(text, karta);
        text = igen.text;
        funna.push(...igen.funna);
        tolkad = true;
        const extra = karta.size - foreModell;
        kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), lokalt: true, ms: Date.now() - tm,
          vad: extra ? tx('lib.kedja.hittadeTill', { n: extra }) : tx('lib.kedja.ingetMer') });
      } catch (e) {
        varning = tx('lib.kedja.tolkningSvaradeInte', { fel: e.message });
        kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), vad: tx('lib.kedja.svaradeInte'), ms: Date.now() - tm, lokalt: true, fel: true });
      }
    }
  }

  const kvar = granska(text, sorter);

  const helaKartan = [...karta.entries()].map(([original, platshallare]) => ({ original, platshallare }));

  const rojning = bedomRojning(text, { maskerade: helaKartan.length - foreAntal });

  return {
    original: fraga_,
    maskerad: text,
    karta: helaKartan,
    nya: helaKartan.slice(foreAntal),
    raknare: Object.fromEntries(raknare),
    funna, kvar, varning, tolkad, kvitto, rojning,
  };
}

export async function lokaltSvar(fraga_, { signal, onSteg = () => {}, onText, onDel = () => {}, historik = [], sammandrag = '', bilagor = [], policy = '', underlag = '', aterkallat = '', bilder = null, persona = null, profil = '', planera: delaUpp = true } = {}) {
  const t0 = Date.now();
  const kvitto = [];
  let omstart = false;

  const beskurna = bilagor.map(b => {
    const text = b.original || b.maskerad || '';
    const v = valj(fraga_, text, { budget: 12000 });
    return { namn: b.namn, text: v.valda.join('\n\n'), helt: v.helt, stycken: v.stycken?.length || v.alla, av: v.alla };
  });
  for (const b of beskurna.filter(b => !b.helt)) {
    kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.denHarDatorn'), lokalt: true, ms: 0,
      vad: tx('lib.kedja.styckenValda', { namn: b.namn, stycken: b.stycken, av: b.av }) });
  }

  const bas = [...tillInstruktion(policy), ...(kris(fraga_) ? [tillModellen(), ''] : []),
    ...(underlag ? [underlag, ''] : []),
    ...beskurna.flatMap(b => [
      byggBilaga(b.namn, b.text, { om: b.helt ? '' : tx('lib.kedja.styckenAv', { stycken: b.stycken, av: b.av }) }), '']),
    ...(aterkallat ? [aterkallat, ''] : [])];

  const forstaTecknet = (pa, nar) => {
    let borjat = false;
    return bit => {
      if (!borjat) { borjat = true; nar(); }
      pa?.(bit);
    };
  };

  let kortadeHistoriken = false, klipptFragan = false;
  const onKort = (o = {}) => { kortadeHistoriken = true; if (o.klippt) klipptFragan = true; };

  let matt = null;
  const onMatt = m => { matt = m; };
  const mattKvitto = () => {
    if (!matt?.skickade) return [];
    const nytt = Math.max(0, matt.skickade - matt.cachade);
    return [{ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), lokalt: true, ms: 0,
      vad: matt.cachade
        ? tx('lib.kedja.nyaTokens', { nytt, cachade: matt.cachade, skickade: matt.skickade })
        : tx('lib.kedja.franBorjan', { skickade: matt.skickade }) }];
  };

  const kor = async (med, pa) => {
    try { return await svaraLokalt(med, { historik, sammandrag, signal, onText: pa, onKort, onMatt, plats: 'samtal', bilder, medTid: true, persona, profil }); }
    catch (e) {
      if (!e.borde_starta_om || signal?.aborted) throw e;
      onSteg({ steg: 'laddar', text: tx('lib.kedja.steg.laddar') });
      await sakerstallModell();
      omstart = true;
      return svaraLokalt(med, { historik, sammandrag, signal, onText: pa, onKort, onMatt, plats: 'samtal', bilder, medTid: true, persona, profil });
    }
  };
  const historikKvitto = () => !kortadeHistoriken ? []
    : [{ tid: new Date().toISOString(), aktor: tx('lib.kedja.denHarDatorn'), lokalt: true, ms: 0,
        vad: klipptFragan
          ? tx('lib.kedja.klippt')
          : sammandrag
          ? tx('lib.kedja.sammandrag')
          : tx('lib.kedja.forLangt') }];

  const plan = delaUpp ? await tillPlan(fraga_, { onSteg, kvitto, signal }) : null;

  if (plan) {
    const delar = [{ rubrik: tx('lib.kedja.planen'), svar: planText(plan) }];
    onDel({ index: 0, rubrik: tx('lib.kedja.planen') });
    onText?.(delar[0].svar, 0);

    for (const [i, d] of plan.delar.entries()) {
      onDel({ index: i + 1, rubrik: tx('lib.kedja.delAv', { i: i + 1, n: plan.delar.length }), fraga: d });
      onSteg({ steg: 'lokalt', text: tx('lib.kedja.steg.laserDel', { i: i + 1 }) });
      const td = Date.now();
      const ra = await kor(delfraga(bas, fraga_, plan, delar, d),
        forstaTecknet(bit => onText?.(bit, i + 1), () => onSteg({ steg: 'skriver', text: tx('lib.kedja.steg.skriverDel', { i: i + 1 }) })));
      delar.push({ rubrik: tx('lib.kedja.del', { i: i + 1 }), fraga: d, svar: strukturera(ra), ms: Date.now() - td });
      kvitto.push({ tid: new Date().toISOString(), aktor: svarare().aktor, lokalt: svarare().lokalt, ms: Date.now() - td,
        vad: tx('lib.kedja.svaradeDel', { i: i + 1, n: ra.length }) });
    }
    if (uppgiften(fraga_)) {
      const rubrik = { sammanfattning: tx('lib.kedja.sammanfattningen'), underlag: tx('lib.kedja.beslutsunderlaget') }[uppgiften(fraga_)?.vad]
        || tx('lib.kedja.fardigaTexten');
      onDel({ index: delar.length, rubrik });
      onSteg({ steg: 'skriver', text: { sammanfattning: tx('lib.kedja.steg.sammanfattning'),
        underlag: tx('lib.kedja.steg.underlag') }[uppgiften(fraga_)?.vad]
        || tx('lib.kedja.steg.fardig') });
      const ts = Date.now();
      const ra = await kor(
        [...bas, tx('lib.kedja.prompt.stallde'), fraga_, '',
          tx('lib.kedja.prompt.idelar'),
          ...delar.slice(1).map(d => `${d.fraga || d.rubrik}\n${kortat(d.svar, 1400)}`),
          '', slutlig(fraga_)].join('\n').trim(),
        forstaTecknet(bit => onText?.(bit, delar.length), () => {}));
      delar.push({ rubrik, svar: strukturera(inramaUtkast(ra, fraga_)), ms: Date.now() - ts });
      kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), lokalt: true,
        ms: Date.now() - ts, vad: tx('lib.kedja.skrevIhop', { rubrik: rubrik.toLowerCase(), n: ra.length }) });
    }

    const tomma = /^\s*(den här delen är (redan )?besvarad|delen är redan besvarad|this part (is|has|was) (already )?(been )?(answered|covered)|already (answered|covered) above)[^\n]{0,80}$/i;
    const visas = delar.filter((d, i) => i === 0 || !tomma.test(String(d.svar || '').trim()));
    return { svar: sammanfoga(visas), delar: visas, ravar: sammanfoga(visas), frontier: svarare().frontier,
      aterstallda: 0, anmarkningar: [],
      kvitto: [...klarKvitto(kvitto, omstart, t0, true), ...historikKvitto(), ...mattKvitto()] };
  }

  const med = [...bas, fraga_ + langd(fraga_) + tonvink(fraga_, historik) + uppgiftsvink(fraga_)]
    .join('\n').trim();
  onSteg({ steg: 'lokalt', text: tx('lib.kedja.steg.forbereder') });
  const ra = await kor(med, forstaTecknet(onText, () => onSteg({ steg: 'skriver', text: tx('lib.kedja.steg.skriver') })));
  const rent = arPersonlig(fraga_, historik) ? utanDom(ra) : ra;
  const ramat = inramaUtkast(rent, fraga_);
  return {
    svar: strukturera(ramat), ravar: rent, frontier: svarare().frontier, delar: [],
    aterstallda: 0, anmarkningar: [],
    kvitto: [...klarKvitto(kvitto, omstart, t0, false), ...historikKvitto(), ...mattKvitto(),
      { tid: new Date().toISOString(), aktor: svarare().aktor, lokalt: svarare().lokalt, ms: Date.now() - t0,
        vad: tx('lib.kedja.svaradeMed', { n: rent.length, ut: svarare().ut }) }],
  };
}

async function tillPlan(fraga, { onSteg, kvitto, signal }) {
  if (!kanskeFlera(fraga)) return null;
  onSteg({ steg: 'planerar', text: tx('lib.kedja.steg.planerar') });
  const tp = Date.now();
  const plan = await planera(fraga, { signal });
  kvitto.push({ tid: new Date().toISOString(), aktor: tx('lib.kedja.lokalModell'), lokalt: true, ms: Date.now() - tp,
    vad: plan ? tx('lib.kedja.delade', { n: plan.delar.length }) : tx('lib.kedja.enFraga') });
  return plan;
}

const RAKNAR = /(?<![\p{L}\p{N}])(två|tre|fyra|fem|sex|sju|two|three|four|five|six|seven|\d+)\s+(delar|frågor|punkter|steg|parts|questions|points|steps)(?![\p{L}\p{N}])/iu;

const planText = plan => {
  const mening = plan.plan && !RAKNAR.test(plan.plan) ? plan.plan : '';
  return [mening, mening ? '' : null,
    ...plan.delar.map((d, i) => `${i + 1}. ${d}`)].filter(r => r !== null).join('\n').trim();
};

const sammanfoga = delar => delar.map(d => `**${d.rubrik}${d.fraga ? ` — ${d.fraga}` : ''}**\n\n${d.svar}`).join('\n\n');

const delfraga = (bas, fraga, plan, klara, d) => [...bas,
  tx('lib.kedja.prompt.stallde'), fraga, '',
  ...(klara.length > 1 ? [tx('lib.kedja.prompt.redanSvarat'),
    ...klara.slice(1).map(k => `${k.fraga}\n${kortat(k.svar, 900)}`), ''] : []),
  tx('lib.kedja.prompt.baraDelen'),
  tx('lib.kedja.prompt.redanBesvarad'),
  d + langd(d)].join('\n').trim();

const kortat = (text, n) => text.length <= n ? text : `${text.slice(0, n)}…`;

const klarKvitto = (kvitto, omstart, t0, flera) => [
  ...(omstart ? [{ tid: new Date().toISOString(), aktor: tx('lib.kedja.denHarDatorn'), lokalt: true, ms: 0,
    vad: tx('lib.kedja.omstart') }] : []),
  ...kvitto,
  ...(flera ? [{ aktor: tx('lib.kedja.denHarDatorn'), lokalt: true, ms: Date.now() - t0,
    vad: tx('lib.kedja.ingentingLamnade') }] : []),
];
