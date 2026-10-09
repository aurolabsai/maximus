// Vilka delar av ett långt underlag ska skickas?
//
// Ett dokument på hundra sidor maskeras på trettio millisekunder — den
// deterministiska grinden bryr sig inte om storlek. Problemet är det som
// kommer sedan: 150 000 tecken ryms inte i någon kontext, och att skicka
// allt vore dessutom att låta hela akten lämna organisationen för att någon
// undrade över en sak.
//
// Urvalet görs utan modell, med BM25 — samma metod som sökmotorer använt i
// trettio år. Skälet är inte att det är bäst utan att det är FÖRKLARLIGT:
// den som skickar ett underlag ska kunna se exakt vilka stycken som valdes
// och varför, och ett embeddingavstånd förklarar ingenting för någon.
//
// Mindre skickat är också mindre röjt. Urvalet är en dataminimering, inte
// bara en optimering.

const STOPPORD = new Set(`
och eller men om att som är var vara varit blir blev har hade ska skall
skulle kan kunde vill ville får fick måste bör borde inte ingen inget inga
jag du han hon hen den det vi ni de dom denna detta dessa en ett min mitt
mina din ditt dina sin sitt sina vår vårt våra er ert era hur vad vem vilken
vilket vilka när var varför vart här där nu sedan efter före under över
mellan utan med för till från på av i så också bara mer mest än
the and but for nor yet not are was were been being has have had does did
can could will would shall should may might must you your yours his her hers its
our ours their theirs they them this that these those what which who whom whose
when where why how there here then than into onto from with about over under
after before between without also just only more most very any all some each
`.trim().split(/\s+/));

const ord = t => String(t).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) || [];
const nyttiga = t => ord(t).filter(o => o.length > 2 && !STOPPORD.has(o));

/// Delar en text i stycken som går att läsa var för sig.
///
/// Sidbrytningar och tomrader först, för de är författarens egen indelning.
/// Ett stycke som blir för långt delas på meningar — annars hade en enda
/// löpande sida ätit hela budgeten.
export function stycken(text, { minsta = 200, storsta = 2000 } = {}) {
  const grova = String(text || '').split(/\n\s*\n|\n---[^\n]*---\n/).map(s => s.trim()).filter(Boolean);
  const ut = [];
  for (const g of grova) {
    if (g.length <= storsta) { ut.push(g); continue; }
    let bit = '';
    for (const m of g.match(/[^.!?]+[.!?]+\s*/g) || [g]) {
      if (bit.length + m.length > storsta && bit) { ut.push(bit.trim()); bit = ''; }
      bit += m;
    }
    if (bit.trim()) ut.push(bit.trim());
  }
  // Slå ihop det som blev för kort med föregående — ett stycke på tio tecken
  // säger ingenting ensamt.
  //
  // Sammanslagningen slutar när stycket är LÄSBART, inte när det är fullt.
  //
  // Första försöket slog ihop upp till samma tak som delningen använder, och
  // sextio korta stycken blev då ett enda — hela dokumentet en klump som
  // antingen rymdes eller inte, utan något att välja mellan. Ett stycke som
  // nått minsta längd står på egna ben och får inte växa mer.
  const hop = [];
  for (const s of ut) {
    const sist = hop[hop.length - 1];
    if (sist && sist.length < minsta) hop[hop.length - 1] = sist + '\n' + s;
    else hop.push(s);
  }
  return hop;
}

/// BM25. k1 och b som de brukar vara; de är inte avstämda och ska inte vara.
export function ranka(fraga, delar, { k1 = 1.5, b = 0.75 } = {}) {
  const fragor = [...new Set(nyttiga(fraga))];
  if (!fragor.length || !delar.length) return delar.map((text, i) => ({ i, text, poang: 0, traffar: [] }));

  const ordPer = delar.map(d => nyttiga(d));
  const medel = ordPer.reduce((s, o) => s + o.length, 0) / delar.length || 1;
  const df = new Map();
  for (const o of ordPer) for (const t of new Set(o)) df.set(t, (df.get(t) || 0) + 1);

  return delar.map((text, i) => {
    const o = ordPer[i];
    const rakna = new Map();
    for (const t of o) rakna.set(t, (rakna.get(t) || 0) + 1);
    let poang = 0;
    const traffar = [];
    for (const t of fragor) {
      const tf = rakna.get(t) || 0;
      if (!tf) continue;
      const n = df.get(t) || 0;
      const idf = Math.log(1 + (delar.length - n + 0.5) / (n + 0.5));
      poang += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * o.length / medel));
      traffar.push(t);
    }
    return { i, text, poang, traffar };
  });
}

/// Väljer det som ryms, i dokumentets egen ordning.
///
/// Poängen avgör VAD som kommer med, men det som kommer med sätts tillbaka i
/// rätt ordning. En modell som får stycke 40, 7 och 61 i den ordningen läser
/// en annan historia än den som skrevs.
export function valj(fraga, text, { budget = 12000, minstaPoang = 0.1 } = {}) {
  const delar = stycken(text);
  if (text.length <= budget) return { valda: delar, alla: delar.length, tecken: text.length, helt: true };

  const rankade = ranka(fraga, delar).sort((a, b) => b.poang - a.poang);
  const tagna = [];
  let tecken = 0;
  for (const r of rankade) {
    if (r.poang < minstaPoang && tagna.length) break;
    if (tecken + r.text.length > budget) continue;
    tagna.push(r);
    tecken += r.text.length;
  }
  // Fick ingenting poäng tar vi början — bättre än att skicka tomt.
  if (!tagna.length) {
    for (const d of delar) {
      if (tecken + d.length > budget) break;
      tagna.push({ i: delar.indexOf(d), text: d, poang: 0, traffar: [] });
      tecken += d.length;
    }
  }
  tagna.sort((a, b) => a.i - b.i);
  return {
    valda: tagna.map(t => t.text),
    stycken: tagna.map(t => ({ nr: t.i + 1, poang: Math.round(t.poang * 100) / 100, traffar: t.traffar })),
    alla: delar.length, tecken, helt: false,
  };
}
