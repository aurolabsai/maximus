
import { resolve, sep } from 'node:path';
import { realpath } from 'node:fs/promises';
import { HANDLINGAR } from './handlingar.mjs';
import { tx, aktuellt } from './sprakstod.mjs';
import { rensaPakallande } from './uppslag.mjs';
import { nySmitta } from './smitta.mjs';

const UNDERLAGSBIT = 2600;

const fel = (nyckel, varden) => `Fel: ${tx(nyckel, varden)}`;
const lokal = () => (aktuellt() === 'sv' ? 'sv-SE' : 'en-US');

const datum = iso => {
  const t = new Date(iso);
  return Number.isFinite(+t) ? t.toLocaleString(lokal(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : String(iso || '');
};
const rad = p => `- ${p.titel || tx('lib.verktyg.utanRubrik')}${p.fran ? tx('lib.verktyg.fran', { fran: p.fran }) : ''}${p.tid ? ` · ${datum(p.tid)}` : ''}${p.url ? ` · ${p.url}` : ''}`;
const URL_I_TEXT = /https?:\/\/[^\s<>"')\]]+/g;
const vard = u => { try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch { return String(u || '').slice(0, 60); } };

export function ledigaTider(handelser, { fran, dagar = 5, langd = 60, start = 8, slut = 17, nu = new Date() } = {}) {
  const ut = [];
  const d0 = new Date(fran || nu); d0.setHours(0, 0, 0, 0);
  for (let i = 0; i < dagar + 7 && ut.length < 12; i++) {
    const d = new Date(d0); d.setDate(d.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    if (i >= dagar + 7) break;
    const a = new Date(d); a.setHours(start, 0, 0, 0);
    const b = new Date(d); b.setHours(slut, 0, 0, 0);
    const upptagna = (handelser || [])
      .filter(h => !h.heldag && h.start && h.slut)
      .map(h => [new Date(h.start), new Date(h.slut)])
      .filter(([s, e]) => e > a && s < b)
      .sort((x, y) => x[0] - y[0]);
    let t = new Date(Math.max(a, nu));
    for (const [s, e] of [...upptagna, [b, b]]) {
      if ((s - t) / 60000 >= langd) ut.push({ fran: new Date(t), till: new Date(s) });
      if (e > t) t = e;
    }
  }
  return ut.slice(0, 12);
}

export function skapaVerktyg(ctx, agent = {}, { obevakad = false } = {}) {
  const smitta = ctx.smitta ||= nySmitta();
  const genom = async (text, { verktyg, kalla, huvud = '' }) => {
    const r = await smitta.las(text, { verktyg, kalla });
    return r === text ? text : `${huvud}${huvud ? ' ' : ''}${r}`;
  };
  const sedda = new Set();
  const traffar = new Set();
  const ren = u => String(u).replace(/[.,;:]+$/, '');
  const minns = text => { for (const m of String(text).matchAll(URL_I_TEXT)) sedda.add(ren(m[0])); return text; };
  const mapparna = () => [...new Set([...(agent.mappar || []).map(m => m.sokvag), ...(agent.mapp?.sokvag ? [agent.mapp.sokvag] : [])])];
  const av = vad => tx('lib.verktyg.avstangt', { vad: tx(vad) });
  const filtrera = (poster, sok) => {
    const q = String(sok || '').toLowerCase().trim();
    return q ? poster.filter(p => `${p.titel} ${p.fran} ${p.text}`.toLowerCase().includes(q)) : poster;
  };

  const v = [
    { namn: 'webbsok', om: tx('lib.verktyg.om.webbsok'),
      parametrar: { type: 'object', properties: { fraga: { type: 'string', description: tx('lib.verktyg.param.fraga') } }, required: ['fraga'] },
      kor: async ({ fraga }) => {
        const g = smitta.granskaSokfraga(String(fraga || ''));
        if (!g.fraga) return fel(g.hard ? 'lib.smitta.fel.hardSok' : 'lib.smitta.fel.sok', { kalla: g.kalla || '' });
        const r = await ctx.webbSok(g.fraga);
        const t = Array.isArray(r) ? r : r?.traffar || [];
        const val = Array.isArray(r) ? null : r?.val;
        if (val && !val.webb) return tx('lib.verktyg.ingenWebb', { varfor: val.varfor });
        const huvud = val ? `${tx('lib.verktyg.vagval', { form: val.form, varfor: val.varfor, fraga: val.fraga })}\n` : '';
        for (const x of t.slice(0, 8)) {
          if (typeof x?.url === 'string' && /^https?:\/\//.test(x.url)) { sedda.add(ren(x.url)); traffar.add(ren(x.url)); }
        }
        const lista = t.length ? await genom(t.slice(0, 8).map(rad).join('\n'), { verktyg: 'webbsok', kalla: tx('lib.smitta.kalla.sok') }) : tx('lib.verktyg.ingaTraffar');
        const bort = g.borttaget.length ? `${tx('lib.smitta.sokUtan', { ord: g.borttaget.join(' '), kalla: g.kalla || '' })}\n` : '';
        return bort + huvud + lista;
      } },
    { namn: 'las_sida', om: tx('lib.verktyg.om.las_sida'),
      parametrar: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
      kor: async ({ url }) => {
        if (!sedda.has(String(url)) && !smitta.iEgenText(url)) return fel('lib.verktyg.fel.adress');
        if (obevakad && !traffar.has(String(url))) return fel('lib.verktyg.fel.obevakad');
        const ok = smitta.adress(String(url), traffar);
        if (!ok.ja) return `Fel: ${ok.fel}`;
        const s = await ctx.webbHamta(String(url));
        return minns(await genom(`${s.titel}\n${s.url}\n\n${s.text}`, { verktyg: 'las_sida', kalla: tx('lib.smitta.kalla.sida', { vard: vard(s.url || url) }), huvud: String(s.url || url) }));
      } },
    { namn: 'mejl', om: tx('lib.verktyg.om.mejl'),
      parametrar: { type: 'object', properties: { sok: { type: 'string', description: tx('lib.verktyg.param.sok') }, antal: { type: 'integer' } } },
      kor: async ({ sok, antal = 15 }) => {
        if (!agent.epost?.konto) return av('lib.verktyg.av.inkorgen');
        const p = filtrera(await ctx.lasKalla('epost'), sok).slice(0, Math.min(40, antal));
        if (!p.length) return tx('lib.verktyg.ingaBrev');
        const ut = [];
        for (const x of p) ut.push(await genom(`${rad(x)}\n  ${String(x.text || '').slice(0, 400).replace(/\s+/g, ' ')}`,
          { verktyg: 'mejl', kalla: tx('lib.smitta.kalla.mejl', { fran: x.fran || '?' }), huvud: `- ${tx('lib.smitta.kalla.mejl', { fran: x.fran || '?' })}:` }));
        return minns(ut.join('\n'));
      } },
    { namn: 'kalender', om: tx('lib.verktyg.om.kalender'),
      parametrar: { type: 'object', properties: { dagar: { type: 'integer', description: tx('lib.verktyg.param.dagar') } } },
      kor: async ({ dagar = 7 }) => {
        if (!agent.kalender) return av('lib.verktyg.av.kalendern');
        const nu = new Date(); const a = new Date(nu); a.setHours(0, 0, 0, 0);
        const b = new Date(a); b.setDate(b.getDate() + Math.max(1, Math.min(60, Number(dagar) || 7)));
        const h = await ctx.kalender({ fran: Number(dagar) < 0 ? new Date(a.getTime() + Number(dagar) * 864e5) : a, till: b });
        if (!h.length) return tx('lib.verktyg.ingaMoten');
        const ut = [];
        for (const x of h) {
          const nar = x.heldag ? tx('lib.verktyg.heldag', { dag: String(x.start).slice(0, 10) }) : `${x.start?.replace('T', ' ')}–${String(x.slut || '').slice(11, 16)}`;
          ut.push(await genom(`- ${x.rubrik} · ${nar}${x.plats ? ` · ${x.plats}` : ''}${x.deltagare?.length ? ` · ${x.deltagare.join(', ')}` : ''}`,
            { verktyg: 'kalender', kalla: tx('lib.smitta.kalla.kalender', { rubrik: String(x.rubrik || '').slice(0, 60) }), huvud: `- ${nar}:` }));
        }
        return ut.join('\n');
      } },
    { namn: 'lediga_tider', om: tx('lib.verktyg.om.lediga_tider'),
      parametrar: { type: 'object', properties: { dagar: { type: 'integer' }, minuter: { type: 'integer' }, fran_kl: { type: 'integer' }, till_kl: { type: 'integer' } } },
      kor: async ({ dagar = 5, minuter = 60, fran_kl = 8, till_kl = 17 }) => {
        if (!agent.kalender) return av('lib.verktyg.av.kalendern');
        const a = new Date(); const b = new Date(a); b.setDate(b.getDate() + Math.min(30, Number(dagar) + 9));
        const h = await ctx.kalender({ fran: a, till: b });
        const l = ledigaTider(h, { dagar: Number(dagar), langd: Number(minuter), start: Number(fran_kl), slut: Number(till_kl) });
        return l.length ? l.map(x => `- ${datum(x.fran)}–${x.till.toTimeString().slice(0, 5)}`).join('\n') : tx('lib.verktyg.ingaLediga');
      } },
    { namn: 'paminnelser', om: tx('lib.verktyg.om.paminnelser'),
      parametrar: { type: 'object', properties: { sok: { type: 'string' } } },
      kor: async ({ sok }) => {
        if (!agent.paminnelser) return av('lib.verktyg.av.paminnelserna');
        const p = filtrera(await ctx.lasKalla('paminnelser'), sok).slice(0, 40);
        return p.length ? genom(p.map(x => `- ${x.titel}${x.forfaller ? tx('lib.verktyg.forfaller', { tid: datum(x.forfaller) }) : ''}${x.lista ? ` · ${x.lista}` : ''}`).join('\n'),
          { verktyg: 'paminnelser', kalla: tx('lib.smitta.kalla.paminnelser') }) : tx('lib.verktyg.ingaPaminnelser');
      } },
    { namn: 'anteckningar', om: tx('lib.verktyg.om.anteckningar'),
      parametrar: { type: 'object', properties: { sok: { type: 'string' } } },
      kor: async ({ sok }) => {
        if (!agent.anteckningar?.mapp) return av('lib.verktyg.av.anteckningarna');
        const p = filtrera(await ctx.lasKalla('anteckningar'), sok).slice(0, 15);
        if (!p.length) return tx('lib.verktyg.ingaAnteckningar');
        const ut = [];
        for (const x of p) ut.push(await genom(`${rad(x)}\n  ${String(x.text || '').slice(0, 500).replace(/\s+/g, ' ')}`,
          { verktyg: 'anteckningar', kalla: tx('lib.smitta.kalla.anteckning', { titel: String(x.titel || '').slice(0, 60) }), huvud: '-' }));
        return minns(ut.join('\n'));
      } },
    { namn: 'safari_sida', om: tx('lib.verktyg.om.safari_sida'),
      parametrar: { type: 'object', properties: {} },
      kor: async () => {
        if (!agent.safari) return av('lib.verktyg.av.safari');
        if (!ctx.safari) return fel('lib.verktyg.fel.safari');
        const s = await ctx.safari();
        return minns(await genom(`${s.titel} — ${s.url}\n\n${String(s.text || '').slice(0, 8000)}`, { verktyg: 'safari_sida', kalla: tx('lib.smitta.kalla.safari', { vard: vard(s.url) }), huvud: String(s.url || '') }));
      } },
    { namn: 'meddelanden', om: tx('lib.verktyg.om.meddelanden'),
      parametrar: { type: 'object', properties: { sok: { type: 'string' } } },
      kor: async ({ sok }) => {
        if (!agent.meddelanden) return av('lib.verktyg.av.meddelandena');
        const p = filtrera(await ctx.lasKalla('meddelanden'), sok).slice(0, 30);
        if (!p.length) return tx('lib.verktyg.ingaMeddelanden');
        const ut = [];
        for (const x of p) ut.push(await genom(`${rad(x)}: ${String(x.text || '').slice(0, 300)}`,
          { verktyg: 'meddelanden', kalla: tx('lib.smitta.kalla.meddelande', { fran: x.fran || '?' }), huvud: `- ${tx('lib.smitta.kalla.meddelande', { fran: x.fran || '?' })}:` }));
        return minns(ut.join('\n'));
      } },
    { namn: 'mapp', om: tx('lib.verktyg.om.mapp'),
      parametrar: { type: 'object', properties: { sok: { type: 'string' } } },
      kor: async ({ sok }) => {
        const rotter = mapparna();
        if (!rotter.length) return av('lib.verktyg.av.enMapp');
        const alla = [];
        for (const sokvag of rotter) alla.push(...await ctx.lasKalla({ typ: 'mapp', sokvag }).catch(() => []));
        const p = filtrera(alla, sok).slice(0, 20);
        if (!p.length) return tx('lib.verktyg.ingaFiler');
        const ut = [];
        for (const x of p) ut.push(await genom(`- ${x.titel} · ${datum(x.tid)}\n  ${String(x.text || '').slice(0, 300).replace(/\s+/g, ' ')}`,
          { verktyg: 'mapp', kalla: tx('lib.smitta.kalla.fil', { namn: String(x.titel || '').slice(0, 60) }), huvud: `- ${x.titel}:` }));
        return ut.join('\n');
      } },
    { namn: 'las_fil', om: tx('lib.verktyg.om.las_fil'),
      parametrar: { type: 'object', properties: { namn: { type: 'string' } }, required: ['namn'] },
      kor: async ({ namn }) => {
        const rotter = mapparna();
        if (!rotter.length) return av('lib.verktyg.av.enMapp');
        for (const r of rotter) {
          const rot = await realpath(resolve(r)).catch(() => null);
          const fil = rot && await realpath(resolve(rot, String(namn || ''))).catch(() => null);
          if (!rot || !fil) continue;
          if (fil === rot || !fil.startsWith(rot + sep)) return fel('lib.verktyg.fel.baraMappar');
          return minns(await genom(String(await ctx.lasFil(fil) ?? ''), { verktyg: 'las_fil', kalla: tx('lib.smitta.kalla.fil', { namn: fil.split(sep).pop() }) }));
        }
        return fel('lib.verktyg.fel.finnsInte');
      } },
    { namn: 'rakna', om: tx('lib.verktyg.om.rakna'),
      parametrar: { type: 'object', properties: { tal: { type: 'array', items: { type: 'number' } } }, required: ['tal'] },
      kor: async ({ tal }) => {
        const t = (tal || []).map(Number).filter(Number.isFinite);
        if (!t.length) return fel('lib.verktyg.fel.ingaTal');
        const s = [...t].sort((a, b) => a - b);
        const sum = t.reduce((a, b) => a + b, 0);
        const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
        return tx('lib.verktyg.rakna', { sum, antal: t.length, snitt: +(sum / t.length).toFixed(2), med, minsta: s[0], storsta: s.at(-1) });
      } },
    { namn: 'genvagar', om: tx('lib.verktyg.om.genvagar'),
      parametrar: { type: 'object', properties: {} },
      kor: async () => { const g = await ctx.genvagar(); return g.length ? g.map(x => `- ${x}`).join('\n') : tx('lib.verktyg.ingaGenvagar'); } },
  ];
  if (ctx.underlag?.length && ctx.lasUnderlag) {
    v.push({ namn: 'las_underlag', om: tx('lib.verktyg.om.las_underlag'),
      parametrar: { type: 'object', properties: { nr: { type: 'integer', description: tx('lib.verktyg.param.nr') }, fran: { type: 'integer', description: tx('lib.verktyg.param.fran') } }, required: ['nr'] },
      kor: async ({ nr = 1, fran = 0 }) => {
        const k = ctx.underlag[Math.trunc(Number(nr)) - 1];
        if (!k) return fel('lib.verktyg.fel.ingetUnderlag', { n: ctx.underlag.length });
        if (k.pakallande) return fel('lib.verktyg.fel.underlagetStyrde');
        const text = rensaPakallande(String(await ctx.lasUnderlag(k) || '')).text;
        const start = Math.max(0, Math.min(text.length, Math.trunc(Number(fran)) || 0));
        const bit = text.slice(start, start + UNDERLAGSBIT);
        const kvar = text.length - start - bit.length;
        return minns(await genom(`${k.titel}\n\n${bit}${kvar > 0 ? `\n\n${tx('lib.verktyg.underlagKvar', { n: kvar, fran: start + bit.length })}` : ''}`,
          { verktyg: 'las_underlag', kalla: tx('lib.smitta.kalla.underlag', { titel: String(k.titel || '').slice(0, 60) }), huvud: String(k.titel || '') }));
      } });
  }
  for (const t of ctx.mcpVerktyg || []) {
    v.push({ namn: t.namn, om: t.beskrivning,
      parametrar: t.parametrar, mcp: true, kor: arg => ctx.mcpKor(t, arg || {}).then(minns) });
  }
  if (ctx.hittaKoppling) {
    v.push({ namn: 'hitta_koppling', om: tx('lib.verktyg.om.hitta_koppling'),
      parametrar: { type: 'object', properties: { tjanst: { type: 'string', description: tx('lib.verktyg.param.tjanst') } }, required: ['tjanst'] },
      kor: async ({ tjanst }) => ctx.hittaKoppling(String(tjanst || '')) });
  }
  if (ctx.foresla) {
    for (const [typ, h] of Object.entries(HANDLINGAR)) {
      v.push({ namn: h.verktyg, om: tx('lib.verktyg.handling', { om: h.om }),
        parametrar: h.parametrar, handling: true, kor: arg => {
          const g = smitta.granskaHandling(typ, arg || {});
          if (g.stopp) return `Fel: ${g.stopp}`;
          return ctx.foresla(typ, arg || {}, { smittad: smitta.smittad, harkomst: g.falt, kallor: smitta.kallor });
        } });
    }
  }
  return v;
}
