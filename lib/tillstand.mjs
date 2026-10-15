
import { tx } from './sprakstod.mjs';
import * as Konton from './konton.mjs';

export const TILLSTAND = [
  {
    id: 'epost',
    get namn() { return tx('lib.tillstand.epost.namn'); },
    get vad() { return tx('lib.tillstand.epost.vad'); },
    get fraga() { return tx('lib.tillstand.epost.fraga'); },
    behover: 'konto',
    ja: d => (Array.isArray(d.konton) && d.konton.length
      ? tx('lib.tillstand.epost.jaFlera', { konton: Konton.somText((Konton.epostUr({ konton: d.konton })?.konton || []).map(k => ({ namn: k.konto, etikett: k.etikett }))) })
      : tx('lib.tillstand.epost.ja', { lada: d.lada === 'INBOX' ? tx('lib.tillstand.epost.inkorgen') : d.lada, konto: d.konto })),
    get nej() { return tx('lib.tillstand.epost.nej'); },
  },
  {
    id: 'kalender',
    get namn() { return tx('lib.tillstand.kalender.namn'); },
    get vad() { return tx('lib.tillstand.kalender.vad'); },
    get fraga() { return tx('lib.tillstand.kalender.fraga'); },
    behover: null,
    ja: d => (Array.isArray(d.kalendrar) && d.kalendrar.length
      ? tx('lib.tillstand.kalender.jaValda', { kalendrar: Konton.somText(Konton.kalenderUr({ kalendrar: d.kalendrar }).kalendrar) })
      : tx('lib.tillstand.kalender.ja')),
    get nej() { return tx('lib.tillstand.kalender.nej'); },
  },
  {
    id: 'anteckningar',
    get namn() { return tx('lib.tillstand.anteckningar.namn'); },
    get vad() { return tx('lib.tillstand.anteckningar.vad'); },
    get fraga() { return tx('lib.tillstand.anteckningar.fraga'); },
    behover: 'mapp',
    ja: d => tx('lib.tillstand.anteckningar.ja', { mapp: `${d.mapp}${d.konto ? ` (${d.konto})` : ''}` }),
    get nej() { return tx('lib.tillstand.anteckningar.nej'); },
  },
  {
    id: 'meddelanden',
    get namn() { return tx('lib.tillstand.meddelanden.namn'); },
    get vad() { return tx('lib.tillstand.meddelanden.vad'); },
    get fraga() { return tx('lib.tillstand.meddelanden.fraga'); },
    behover: 'fda',
    ja: () => tx('lib.tillstand.meddelanden.ja'),
    get nej() { return tx('lib.tillstand.meddelanden.nej'); },
  },
  {
    id: 'paminnelser',
    get namn() { return tx('lib.tillstand.paminnelser.namn'); },
    get vad() { return tx('lib.tillstand.paminnelser.vad'); },
    get fraga() { return tx('lib.tillstand.paminnelser.fraga'); },
    behover: 'lov',
    ja: () => tx('lib.tillstand.paminnelser.ja'),
    get nej() { return tx('lib.tillstand.paminnelser.nej'); },
  },
  {
    id: 'samtal',
    forsta: false,
    get namn() { return tx('lib.tillstand.samtal.namn'); },
    get vad() { return tx('lib.tillstand.samtal.vad'); },
    get fraga() { return tx('lib.tillstand.samtal.fraga'); },
    behover: 'fda',
    ja: () => tx('lib.tillstand.samtal.ja'),
    get nej() { return tx('lib.tillstand.samtal.nej'); },
  },
  {
    id: 'mapp',
    forsta: false,
    get namn() { return tx('lib.tillstand.mapp.namn'); },
    get vad() { return tx('lib.tillstand.mapp.vad'); },
    get fraga() { return tx('lib.tillstand.mapp.fraga'); },
    behover: 'sokvag',
    ja: d => tx('lib.tillstand.mapp.ja', { mapp: d.namn || d.sokvag }),
    get nej() { return tx('lib.tillstand.mapp.nej'); },
  },
  {
    id: 'telefon',
    get namn() { return tx('lib.tillstand.telefon.namn'); },
    get vad() { return tx('lib.tillstand.telefon.vad'); },
    get fraga() { return tx('lib.tillstand.telefon.fraga'); },
    behover: 'telefon',
    ja: () => tx('lib.tillstand.telefon.ja'),
    get nej() { return tx('lib.tillstand.telefon.nej'); },
  },
];

export const tillstand = id => TILLSTAND.find(t => t.id === id) || null;

export function agentEfter(agent, id, svar, d = {}) {
  const a = { ...(agent || {}) };
  if (id === 'epost') {
    const fore = Konton.epostUr(a.epost)?.konton || [];
    if (svar === 'ja') {
      const nya = Array.isArray(d.konton) ? d.konton
        : [...fore.filter(k => k.konto !== d.konto), { konto: d.konto, lador: [d.lada || 'INBOX'], etikett: d.etikett ?? fore.find(k => k.konto === d.konto)?.etikett ?? null }];
      const e = Konton.epostUr({ konton: nya });
      if (e) a.epost = e; else delete a.epost;
    } else if (d.konto && fore.length > 1) {
      a.epost = Konton.epostUr({ konton: fore.filter(k => k.konto !== d.konto) });
    } else delete a.epost;
  }
  if (id === 'kalender') {
    if (svar === 'ja') a.kalender = Konton.kalenderUr({ kalendrar: Array.isArray(d.kalendrar) ? d.kalendrar : [] });
    else delete a.kalender;
  }
  if (id === 'anteckningar') {
    if (svar === 'ja') a.anteckningar = { konto: d.konto || '', mapp: d.mapp, skriv: false };
    else delete a.anteckningar;
  }
  if (id === 'meddelanden') { if (svar === 'ja') a.meddelanden = true; else delete a.meddelanden; }
  if (id === 'paminnelser') { if (svar === 'ja') a.paminnelser = true; else delete a.paminnelser; }
  if (id === 'samtal') { if (svar === 'ja') a.samtal = true; else delete a.samtal; }
  if (id === 'telefon') { if (svar === 'ja') a.telefon = { kanal: 'paminnelse', till: a.telefon?.till || null }; else delete a.telefon; }
  if (id === 'mapp') {
    if (svar === 'ja') {
      a.mappar = [...(a.mappar || (a.mapp ? [a.mapp] : [])).filter(m => m.sokvag !== d.sokvag), { sokvag: d.sokvag, namn: d.namn || null }];
      a.mapp = a.mapp || { sokvag: d.sokvag };
    } else if (d.sokvag) {
      a.mappar = (a.mappar || []).filter(m => m.sokvag !== d.sokvag);
      if (a.mapp?.sokvag === d.sokvag) { if (a.mappar[0]) a.mapp = { sokvag: a.mappar[0].sokvag }; else delete a.mapp; }
    } else { delete a.mapp; delete a.mappar; }
  }
  return a;
}

export function beslut(id, svar, d = {}) {
  const t = tillstand(id);
  if (!t) return { ok: false, fel: tx('lib.tillstand.fel.okant') };
  if (t.finns === false) return { ok: false, fel: t.inte };
  if (svar !== 'ja' && svar !== 'nej') return { ok: false, fel: tx('lib.tillstand.fel.jaNej') };
  if (svar === 'nej') return { ok: true, skal: t.nej };
  if (t.behover === 'konto' && !String(d.konto || '').trim() && !Konton.epostUr({ konton: d.konton })) return { ok: false, fel: tx('lib.tillstand.fel.konto') };
  if (t.behover === 'mapp' && !String(d.mapp || '').trim()) return { ok: false, fel: tx('lib.tillstand.fel.mapp') };
  if (t.behover === 'sokvag' && !String(d.sokvag || '').trim().startsWith('/')) return { ok: false, fel: tx('lib.tillstand.fel.mapp') };
  return { ok: true, skal: t.ja({ ...d, lada: d.lada || 'INBOX' }) };
}

export function lage(agent = {}) {
  return TILLSTAND.map(t => ({
    id: t.id, namn: t.namn, vad: t.vad, fraga: t.fraga || null, behover: t.behover || null, forsta: t.forsta !== false,
    finns: t.finns !== false, inte: t.inte || null,
    pa: t.id === 'epost' ? Boolean(Konton.epostUr(agent.epost))
      : t.id === 'kalender' ? Boolean(agent.kalender)
      : t.id === 'anteckningar' ? Boolean(agent.anteckningar?.mapp)
      : t.id === 'meddelanden' ? Boolean(agent.meddelanden)
      : t.id === 'paminnelser' ? Boolean(agent.paminnelser)
      : t.id === 'samtal' ? Boolean(agent.samtal)
      : t.id === 'telefon' ? Boolean(agent.telefon?.kanal)
      : t.id === 'mapp' ? Boolean(agent.mapp?.sokvag) : false,
  }));
}
