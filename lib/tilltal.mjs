
export const TILLTAL_REGEL = 'Den som läser det du skriver är personen du arbetar åt. Tilltala hen direkt, i du-form: "du", "dig", "din", "ditt", "dina" (på engelska "you", "your"). Skriv aldrig "hon", "han", "henne", "honom", "hennes", "hans", "användaren", "personen" eller "the user" om den som läser, och gissa aldrig någons kön.';

const B = m => new RegExp(`(?<![\\p{L}\\d])(?:${m})(?![\\p{L}\\d])`, 'giu');

const NEUTRUM = new Set(('arbete jobb företag bolag nätverk projekt ansvar område uppdrag konto team mål schema yrke intresse ärende möte '
  + 'kontor fokus fält bokslut avtal program sammanhang engagemang kunnande näringsliv ämne syfte arbetsområde ansvarsområde intresseområde '
  + 'verksamhetsområde inflytande samarbete erbjudande evenemang event nätverkande').split(' '));
const SINGULAR_ER = new Set('kalender semester manager partner leader teater minister ledamöter vatten sommar vinter nummer fönster titel'.split(' '));
const ADJEKTIV = /^(?:\p{L}+ande|\p{L}+ende|egna|egen|eget|nya|nytt|ny|nuvarande|tidigare|största|viktigaste|senaste|första|stora|stort|stor|gamla|gammal|gammalt|framtida|kommande|aktuella|aktuellt|aktuell|befintliga|olika|många)$/iu;

const PLURAL = ord => /(?:er|ar|or|na)$/iu.test(ord) && !SINGULAR_ER.has(ord.toLowerCase());
const possessiv = huvud => {
  const h = String(huvud || '').toLowerCase();
  if (!h) return 'din';
  if (NEUTRUM.has(h) || /(?:ande|ende|skap)$/u.test(h) && !PLURAL(h)) return 'ditt';
  return PLURAL(h) ? 'dina' : 'din';
};
const stor = (forlaga, ord) => (/^\p{Lu}/u.test(forlaga) ? ord[0].toUpperCase() + ord.slice(1) : ord);

const PREP_SV = /(?:för|till|åt|med|om|hos|mot|från|av|på|i|utan|kring|än)\s+$/iu;
const PREP_EN = /(?:for|to|with|about|at|from|of|on|in|by|without|than|toward|towards)\s+$/iu;

const VERB_EN = { is: 'are', was: 'were', has: 'have', does: 'do', "isn't": "aren't", "wasn't": "weren't", "hasn't": "haven't", "doesn't": "don't", "she's": "you're", "he's": "you're" };
const utanS = v => (VERB_EN[v.toLowerCase()] || (/(?:ss|sh|ch|x|z|o)es$/i.test(v) ? v.slice(0, -2) : /ies$/i.test(v) ? `${v.slice(0, -3)}y` : /s$/i.test(v) && !/ss$/i.test(v) ? v.slice(0, -1) : v));

const TREDJE = ['hon', 'han', 'henne', 'honom', 'hennes', 'hans', 'användaren', 'användarens', 'she', 'he', 'her', 'him', 'his', 'hers', 'the user', "the user's"];

export function duForm(text, { kalla = '' } = {}) {
  let t = String(text ?? '');
  if (!t) return t;
  const iKallan = new Set(TREDJE.filter(o => B(o.replace(/'/g, "['’]")).test(String(kalla || ''))));
  const far = o => !iKallan.has(o);

  t = t.replace(/(?<![\p{L}\d])(hennes|hans|användarens)(?![\p{L}\d])(?=((?:\s+[\p{L}-]+){0,3}))/giu, (m, p, efter) => {
    if (!far(p.toLowerCase())) return m;
    const orden = efter.trim().split(/\s+/).filter(Boolean);
    const huvud = orden.find(o => !ADJEKTIV.test(o)) || orden[0];
    return stor(p, possessiv(huvud));
  });
  t = t.replace(B('henne|honom'), (m, i, s) => (far(m.toLowerCase()) ? stor(m, 'dig') : m));
  t = t.replace(B('användaren'), (m, i, s) => (far('användaren') ? stor(m, PREP_SV.test(s.slice(0, i)) ? 'dig' : 'du') : m));
  t = t.replace(B('hon|han'), m => (far(m.toLowerCase()) ? stor(m, 'du') : m));

  t = t.replace(/(?<![\p{L}\d])the user['’]s(?![\p{L}\d])/giu, m => (far("the user's") ? stor(m, 'your') : m));
  t = t.replace(/(?<![\p{L}\d])(she|he|the user)\s+(['’]s|[\p{L}'’]+)(?![\p{L}\d])/giu, (m, vem, verb) => {
    if (!far(vem.toLowerCase())) return m;
    if (/^['’]s$/.test(verb)) return stor(vem, "you're");
    return `${stor(vem, 'you')} ${utanS(verb)}`;
  });
  t = t.replace(B('the user'), (m) => (far('the user') ? stor(m, 'you') : m));
  t = t.replace(B('his'), m => (far('his') ? stor(m, 'your') : m));
  t = t.replace(B('hers'), m => (far('hers') ? stor(m, 'yours') : m));
  t = t.replace(B('him'), m => (far('him') ? stor(m, 'you') : m));
  t = t.replace(/(?<![\p{L}\d])her(?![\p{L}\d])(\s+([\p{L}-]+))?/giu, (m, efter, ord) => {
    if (!far('her')) return m;
    const ager = ord && !/^(?:and|or|but|to|for|with|about|at|from|of|on|in|by|that|this|today|now|again|first|too|as|if|when|so)$/i.test(ord);
    return `${stor(m, ager ? 'your' : 'you')}${efter || ''}`;
  });
  return t;
}

export const tredjePerson = (text, { kalla = '' } = {}) => duForm(text, { kalla }) !== String(text ?? '');
