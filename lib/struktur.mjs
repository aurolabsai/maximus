
const FORKORTNING = /(?:^|\s)(t\.ex|bl\.a|m\.m|m\.fl|d\.v\.s|dvs|osv|ca|kap|mom|nr|st|f\.d|s\.k|jfr|resp|ang|enl|prop|not|avd|fig|e\.g|i\.e|etc|vs|approx|no|cf|mr|mrs|ms|dr|prof|sec|art|para|ch|u\.s|u\.k|inc|ltd|co)\.$/i;

export function meningar(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const ut = [];
  let start = 0;
  for (let i = 0; i < t.length; i++) {
    if (!'.!?'.includes(t[i])) continue;
    const efter = t.slice(i + 1, i + 3);
    if (i === t.length - 1) { ut.push(t.slice(start).trim()); start = t.length; break; }
    if (!/^\s/.test(efter)) continue;
    const nasta = t.slice(i + 1).replace(/^\s+/, '')[0] || '';
    if (!/[A-ZÅÄÖ0-9]/.test(nasta)) continue;
    const fore = t.slice(start, i + 1);
    if (FORKORTNING.test(fore)) continue;
    if (/(?:^|\s)[0-9a-zåäö]\.$/i.test(fore)) continue;
    ut.push(fore.trim());
    start = i + 1;
  }
  if (start < t.length) ut.push(t.slice(start).trim());
  return ut.filter(Boolean);
}

const nyckel = m => m.toLowerCase().replace(/[^a-zåäöé0-9§ ]/g, '').replace(/\s+/g, ' ').trim();

export function strykUpprepning(rader, sedda = new Set()) {
  const kvar = [];
  for (const m of rader) {
    const n = nyckel(m);
    if (!n) continue;
    if (sedda.has(n)) continue;
    if (n.length >= 40 && kvar.some(k => nyckel(k).includes(n))) continue;
    sedda.add(n);
    kvar.push(m);
  }
  return kvar.filter((m, i) => {
    const n = nyckel(m);
    return !(n.length >= 40 && kvar.some((k, j) => j > i && nyckel(k).includes(n)));
  });
}

const BISATS = /(?:^|\s)(då|när|om|som|där|ifall|innan|efter att|medan|såvida|when|if|which|that|where|before|after|while|unless|whereby)(?=\s)/i;

export function strykUpprepadSvans(rader, { minOrd = 8 } = {}) {
  const sedda = new Set();
  return rader.map((m, i) => {
    const komman = [...m.matchAll(/,\s+/g)].map(x => x.index);
    if (i > 0) {
      for (const k of komman) {
        const svans = m.slice(k + 1).trim().replace(/[.!?]+$/, '');
        if (svans.split(/\s+/).length < minOrd) continue;

        if (!/^(eller|och|samt|or|and)\s/i.test(svans)) continue;
        if (!BISATS.test(svans)) continue;

        if (!sedda.has(nyckel(svans))) continue;
        const kvar = m.slice(0, k).trim();
        if (kvar.split(/\s+/).length < 6) continue;
        if (/(?<![\p{L}])(och|eller|samt|men|som|att|där|när|om|av|i|på|till|and|or|but|that|which|where|when|if|of|in|on|to|the|a|an)$/iu.test(kvar)) continue;
        return `${kvar}.`;
      }
    }
    for (const k of komman) {
      const svans = m.slice(k + 1).trim().replace(/[.!?]+$/, '');
      if (svans.split(/\s+/).length < minOrd) continue;
      if (!/^(eller|och|samt|or|and)\s/i.test(svans)) continue;
      if (!BISATS.test(svans)) continue;
      sedda.add(nyckel(svans));
    }
    return m;
  });
}

export function brytStycken(rader, { tak = 65 } = {}) {
  const ut = [];
  let bunt = [], ord = 0;
  for (const m of rader) {
    const n = m.split(/\s+/).length;
    if (bunt.length && ord + n > tak) { ut.push(bunt.join(' ')); bunt = []; ord = 0; }
    bunt.push(m); ord += n;
  }
  if (bunt.length) ut.push(bunt.join(' '));
  return ut;
}

export function tillLista(rader) {
  if (rader.length < 3) return null;
  const inledning = m => m.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
  const forsta = inledning(rader[0]);
  if (!rader.every(m => inledning(m) === forsta)) return null;
  if (rader.some(m => m.split(/\s+/).length > 40)) return null;
  return rader.map(m => `- ${m}`).join('\n');
}

const ORORT = /^\s*(?:```|\||#{1,4}\s|>|[-*+]\s|\d+[.)]\s)/;

const RUTORD = { slutsats: 'slutsats', slutsatsen: 'slutsats', varning: 'varning', varningar: 'varning', lucka: 'lucka', luckor: 'lucka',
  conclusion: 'slutsats', warning: 'varning', warnings: 'varning', caution: 'varning', gap: 'lucka', gaps: 'lucka' };

export function rattaRutor(text) {
  return String(text || '').split('\n').map(rad => {
    const h = /^\s*#{1,4}\s*(\[!\w+\].*)$/.exec(rad);
    if (h) return `> ${h[1]}`;
    const m = /^\s*(\[!\w+\]\s.*)$/.exec(rad);
    if (m) return `> ${m[1]}`;
    const f = /^\s*\*\*([A-Za-zÅÄÖåäö]+)\s*:?\*\*\s*:?\s*(.+)$/.exec(rad);
    if (f) {
      const sort = RUTORD[f[1].toLowerCase()];
      if (sort) return `> [!${sort}] ${f[2].trim()}`;
    }
    return rad;
  }).join('\n');
}

export function radbryt(text) {
  return String(text || '').split('\n').map(rad => {
    if (ORORT.test(rad)) return rad;
    let r = rad.replace(/(\S)\s+(?=>\s*\[!)/g, '$1\n\n');
    r = r.replace(/(\S)\s+(?=>\s)/g, '$1\n\n');
    r = r.replace(/(\S)\s+(?=#{2,4}\s)/g, '$1\n\n');
    const t = r.search(/\s\|\s[^|]*\|/);
    if (t > 0 && !/^\s*\|/.test(r)) {
      r = `${r.slice(0, t)}\n\n${r.slice(t + 1)}`;
    }
    return r.replace(/\|\s+\|/g, '|\n|');
  }).join('\n').replace(/\n{3,}/g, '\n\n');
}

export function arKalltext(stycke, kalltexter) {
  const n = nyckel(stycke);
  if (n.length < 60 || !kalltexter?.length) return false;
  return kalltexter.some(t => { const tn = nyckel(t); return tn.length >= 60 && tn.includes(n); });
}

export function citeraLagtext(stycke, kalltexter) {
  if (!kalltexter?.length) return null;
  return arKalltext(stycke, kalltexter) ? stycke.split('\n').map(r => `> ${r}`).join('\n') : null;
}

const PARAGRAFSTART = /^\s*\d{1,3}\s*[a-zåäö]?\s*§/i;

function avcitera(stycke, kalltexter) {
  if (!kalltexter?.length) return stycke;
  if (/^\s*>\s*\[!/.test(stycke)) return stycke;
  const rader = stycke.split('\n');
  if (!rader.every(r => /^\s*>/.test(r))) return stycke;
  const ren = rader.map(r => r.replace(/^\s*>\s?/, '')).join('\n');
  if (PARAGRAFSTART.test(ren)) return stycke;
  return arKalltext(ren, kalltexter) ? stycke : ren;
}

export function rensaTabell(block) {
  const rader = block.split('\n');
  if (rader.filter(r => /^\s*\|/.test(r)).length < 3) return block;
  const sedda = new Set();
  return rader.filter(r => {
    if (!/^\s*\|/.test(r)) return true;
    const n = nyckel(r);
    if (/^[\s|:-]*$/.test(r)) return true;
    if (sedda.has(n)) return false;
    sedda.add(n);
    return true;
  }).join('\n');
}

const RUTTAK = { slutsats: 1, lucka: 1, varning: 2 };

export function taRutor(block) {
  const rakning = { slutsats: 0, lucka: 0, varning: 0 };
  return block.filter(b => {
    const m = /^\s*>\s*\[!([a-zåäöA-ZÅÄÖ]+)\]/.exec(b);
    if (!m) return true;
    const sort = { slutsats: 'slutsats', note: 'slutsats', tip: 'slutsats',
      varning: 'varning', warning: 'varning', caution: 'varning', important: 'varning',
      lucka: 'lucka', gap: 'lucka' }[m[1].toLowerCase()];
    if (!sort) return true;
    return ++rakning[sort] <= RUTTAK[sort];
  });
}

const LACKAGE = /(?:^|\s)(svara inte|skriv inte|använd inte|enligt formreglerna|enligt arbetsordningen|enligt instruktionen|användaren behöver|min instruktion|jag ska inte|jag får inte|det är inte tillåtet att upprepa|texten måste avslutas|do not answer|don't answer|according to the formatting rules|according to (?:my|the) instructions|the user needs|my instructions|i must not repeat|the text must end)/i;

export function strykLackage(rader) {
  return rader.filter(m => !LACKAGE.test(m));
}

export function strukturera(text, { tak = 65, lagtexter = [], kalltexter = lagtexter } = {}) {
  const block = radbryt(rattaRutor(String(text || '').replace(/\r/g, '')))
    .replace(/([^\n])\n(?=>\s*\[!)/g, '$1\n\n')
    .split(/\n{2,}/);
  const ut = [];
  const sedd = new Set();
  const seddaMeningar = new Set();
  const seddaBlock = new Set();
  for (const b of block) {
    const rent = b.trim();
    if (!rent) continue;
    if (rent.split('\n').some(r => ORORT.test(r))) {
      const b2 = avcitera(rent, kalltexter);
      const n2 = nyckel(b2);
      if (n2.length >= 40 && seddaBlock.has(n2)) continue;
      seddaBlock.add(n2);
      ut.push(rensaTabell(b2));
      continue;
    }

    let rader = strykLackage(strykUpprepning(meningar(rent), seddaMeningar));
    if (!rader.length) continue;
    rader = strykUpprepadSvans([...sedd, ...rader]).slice(sedd.size);
    for (const m of rader) sedd.add(m);

    const lista = tillLista(rader);
    if (lista) { ut.push(lista); continue; }

    for (const stycke of brytStycken(rader, { tak })) {
      const citat = citeraLagtext(stycke, kalltexter)
        || (PARAGRAFSTART.test(stycke) ? stycke.split('\n').map(r => `> ${r}`).join('\n') : null);
      ut.push(citat || stycke);
    }
  }
  return taRutor(ut).join('\n\n');
}
