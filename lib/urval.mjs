
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
  const hop = [];
  for (const s of ut) {
    const sist = hop[hop.length - 1];
    if (sist && sist.length < minsta) hop[hop.length - 1] = sist + '\n' + s;
    else hop.push(s);
  }
  return hop;
}

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
